// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Mutex, withTimeout } from "async-mutex";
import EventEmitter from "eventemitter3";
import Logger from "@foxglove/log";
import * as H264 from "./h264";

// foxglove-depcheck-used: @types/dom-webcodecs

const MAX_DECODE_WAIT_MS = 15;

export type VideoPlayerEventTypes = {
  frame: (frame: ImageData) => void;
  debug: (message: string) => void;
  warn: (message: string) => void;
  error: (error: Error) => void;
};

const options = {
  format: "RGBA",
  colorSpace: "srgb",
} as VideoFrameCopyToOptions;

const log = Logger.getLogger(__filename);

/**
 * A wrapper around the WebCodecs VideoDecoder API that is safe to use from
 * multiple asynchronous contexts, is keyframe-aware, exposes a simple decode
 * method that takes a chunk of encoded video bitstream representing a single
 * frame and returns the decoded VideoFrame, and emits events for debugging
 * and error handling.
 */
export class VideoPlayer extends EventEmitter<VideoPlayerEventTypes> {
  #decoderInit: VideoDecoderInit;
  #decoder: VideoDecoder;
  #decoderConfig: VideoDecoderConfig | undefined;
  naluStreamInfo: H264.NaluStreamInfo | undefined;
  #mutex = withTimeout(new Mutex(), MAX_DECODE_WAIT_MS);
  // Stores the last decoded frame as an ImageBitmap, should be set after decode()
  lastFrameData: ImageData | undefined;
  lastSubmittedTimestamp = 0;

  /** Reports whether video decoding is supported in this browser session */
  public static IsSupported(): boolean {
    return self.isSecureContext && "VideoDecoder" in globalThis;
  }

  private getNaluStreamInfo(imgData: Uint8Array) {
    if (this.naluStreamInfo == undefined) {
      const streamInfo = H264.identifyNaluStreamInfo(imgData);
      if (streamInfo.type !== "unknown") {
        this.naluStreamInfo = streamInfo;
        console.debug(
          `Stream identified as ${streamInfo.type} with box size: ${streamInfo.boxSize}`,
        );
      }
    }
    return this.naluStreamInfo;
  }

  private getAnnexBFrame(frameData: Uint8Array) {
    const streamInfo = this.getNaluStreamInfo(frameData);
    if (streamInfo?.type === "packet") {
      const res = new H264.NALUStream(frameData, {
        type: "packet",
        boxSize: streamInfo.boxSize,
      }).convertToAnnexB().buf;
      return res;
    }
    return frameData;
  }

  public constructor() {
    super();
    this.#decoderInit = {
      output: (videoFrame: VideoFrame) => {
        const size = videoFrame.allocationSize(options);
        const buffer = new ArrayBuffer(size);
        videoFrame.copyTo(buffer, options).then(() => {
          const img = new ImageData( new Uint8ClampedArray(buffer), videoFrame.displayWidth, videoFrame.displayHeight);
          videoFrame.close();
          this.lastFrameData = img;
          this.emit("frame", img);
        });
      },
      error: (error) => this.emit("error", error),
    };
    this.#decoder = new VideoDecoder(this.#decoderInit);
  }

  private getDecoderConfig(frameData: Uint8Array): VideoDecoderConfig | null {
    const nalus = H264.getNalus(frameData);
    const spsNalu = nalus.find((n) => n.type === H264.NaluTypes.SPS);
    if (spsNalu) {
      const sps = new H264.SPS(spsNalu.nalu.nalu);
      const decoderConfig: VideoDecoderConfig = {
        codec: sps.MIME,
        codedHeight: sps.picHeight,
        codedWidth: sps.picWidth,
      };
      return decoderConfig;
    }
    return null;
  }

  private isKeyFrame(frameData: Uint8Array): boolean {
    const nalus = H264.getNalus(frameData);
    return nalus.find((n) => n.type === H264.NaluTypes.IDR) != undefined;
  }

  /**
   * Configures the VideoDecoder with the given VideoDecoderConfig. This must
   * be called before decode() will return a VideoFrame.
   */
  public async init(frame: Uint8Array): Promise<boolean> {
    const decoderConfig = this.getDecoderConfig(frame);    
    if (!decoderConfig) {
      return false;
    }
    // Optimize for latency means we do not have to call flush() in every decode() call
    // See <https://github.com/w3c/webcodecs/issues/206>
    decoderConfig.optimizeForLatency = true;
    // Try with 'prefer-hardware' first
    let modifiedConfig = { ...decoderConfig };
    modifiedConfig.hardwareAcceleration = "prefer-hardware";

    let support = await VideoDecoder.isConfigSupported(modifiedConfig);
    if (support.supported !== true) {
      log.warn(`VideoDecoder does not support configuration ${JSON.stringify(modifiedConfig)}. Trying without 'prefer-hardware'`);
      // If 'prefer-hardware' is not supported, try without it
      modifiedConfig = { ...decoderConfig };
      support = await VideoDecoder.isConfigSupported(modifiedConfig);
    }

    if (support.supported !== true) {
      const err = new Error(
        `VideoDecoder does not support configuration ${JSON.stringify(decoderConfig)}`,
      );
      this.emit("error", err);
      return false;
    }

    if (this.#decoder.state === "closed") {
      this.emit("debug", "VideoDecoder is closed, creating a new one");
      this.#decoder = new VideoDecoder(this.#decoderInit);
    }

    this.emit("debug", `Configuring VideoDecoder with ${JSON.stringify(decoderConfig)}`);
    this.#decoder.configure(decoderConfig);
    this.#decoderConfig = decoderConfig;

    return true;
  }

  /** Returns true if the VideoDecoder is open and configured, ready for decoding. */
  public isInitialized(): boolean {
    return this.#decoder.state === "configured";
  }

  /** Returns the VideoDecoderConfig given to init(), or undefined if init() has not been called. */
  public decoderConfig(): VideoDecoderConfig | undefined {
    return this.#decoderConfig;
  }

  /**
   * Takes a chunk of encoded video bitstream, sends it to the VideoDecoder,
   * and returns a Promise that resolves to the decoded VideoFrame. If the
   * VideoDecoder is not yet configured, we are waiting on a keyframe, or we
   * time out waiting for the decoder to return a frame, this will return
   * undefined.
   *
   * @param data A chunk of encoded video bitstream
   * @param timestampMicros The timestamp of the chunk of encoded video
   *   bitstream in microseconds relative to the start of the stream
   * @param type "key" if this chunk contains a keyframe, "delta" otherwise
   * @returns A VideoFrame or undefined if no frame was decoded
   */
  public async decode(
    data: Uint8Array,
    timestampMicros: number,
  ): Promise<ImageData | undefined> {
    let frameHandler: (img: ImageData) => void | undefined;
    return await this.#mutex.runExclusive(async () => {
        // the decoder, as it is configured, expects 'annexB' style h264 data.
        const frame = this.getAnnexBFrame(data);
        if (!this.isInitialized()) {
          if (!await this.init(frame)) {
            return undefined;
          }
        }
        const keyframe = this.isKeyFrame(data) ? "key" : "delta";

        const ret = await new Promise<ImageData | undefined>((resolve) => {
          frameHandler = (img: ImageData) => {
            resolve(img);
          }
          this.once("frame", frameHandler);
          try {
            this.#decoder.decode(
              new EncodedVideoChunk({
                type: keyframe,
                data: frame,
                timestamp: timestampMicros,
              }),
            );
          } catch (e) {
            this.removeListener("frame", frameHandler);

            const error = new Error(
              `Failed to decode ${data.byteLength} byte chunk at time ${timestampMicros}: ${
                (e as Error).message
              }`,
            );
            this.emit("error", error);
            resolve(undefined);        
          }
        });
        return ret;
      }).catch(() => {
        if (frameHandler) this.removeListener("frame", frameHandler);
        this.emit(
          "warn",
          `Timed out decoding ${data.byteLength} byte chunk at time ${timestampMicros}`,
        );
        this.#mutex.release();
        return undefined;
      });
  }

  /**
   * Reset the VideoDecoder and clear any pending frames, but do not clear any
   * cached stream information or decoder configuration. This should be called
   * when seeking to a new position in the stream.
   */
  public resetForSeek(): void {
    if (this.#decoder.state === "configured") {
      this.#decoder.reset();
    }
    this.#mutex.cancel();
  }

  /**
   * Close the VideoDecoder and clear any pending frames. Also clear any cached
   * stream information or decoder configuration.
   */
  public close(): void {
    if (this.#decoder.state !== "closed") {
      this.#decoder.close();
    }
    this.#mutex.cancel();
  }
}
