// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as Comlink from "comlink";

import type { RawImage, CompressedVideo } from "@foxglove/schemas";
import Logger from "@foxglove/log";
import { CompressedImageTypes } from "./ImageTypes";

import { decodeRawImage, RawImageOptions, decodeCompressedVideo } from "./decodeImage";
import type { Image as RosImage } from "../../ros";
import { VideoPlayer } from "@foxglove/den/video";
const log = Logger.getLogger(__filename);

declare global {
  // A lazily instantiated player for compressed video
  var videoPlayer: VideoPlayer | undefined;
}

function decode(image: RosImage | RawImage, options: Partial<RawImageOptions>): ImageData {
  const result = new ImageData(image.width, image.height);
  decodeRawImage(image, options, result.data);
  return Comlink.transfer(result, [result.data.buffer]);
}

function resetDecoder() {
  globalThis.videoPlayer?.resetForSeek();
}

async function decodeVideoFrame(image: CompressedVideo | CompressedImageTypes, baseTime: bigint): Promise<ImageData | {a: false}> {
  if (!globalThis.videoPlayer) {
    globalThis.videoPlayer = new VideoPlayer();
    globalThis.videoPlayer.on("error", (err) => {
      log.error(err);
    });
    globalThis.videoPlayer.on("warn", (msg) => {
      log.warn(msg);
    });
  }
  const decodedVideo = await decodeCompressedVideo(
    image,
    globalThis.videoPlayer,
    baseTime
  );
  return decodedVideo? decodedVideo : {a: false}
}

export const service = {
  decode, decodeVideoFrame, resetDecoder
};
Comlink.expose(service);
