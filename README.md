<h1 align="center">Lichtblick</h1>

<div align="center">
  <a href="https://github.com/bmw-software-engineering/lichtblick/stargazers"><img src="https://img.shields.io/github/stars/bmw-software-engineering/lichtblick" alt="Stars Badge"/></a>
  <a href="https://github.com/bmw-software-engineering/lichtblick/network/members"><img src="https://img.shields.io/github/forks/bmw-software-engineering/lichtblick" alt="Forks Badge"/></a>
  <a href="https://github.com/bmw-software-engineering/lichtblick/pulls"><img src="https://img.shields.io/github/issues-pr/bmw-software-engineering/lichtblick" alt="Pull Requests Badge"/></a>
  <a href="https://github.com/bmw-software-engineering/lichtblick/issues"><img src="https://img.shields.io/github/issues/bmw-software-engineering/lichtblick" alt="Issues Badge"/></a>
  <a href="https://github.com/bmw-software-engineering/lichtblick/issues"><img src="https://img.shields.io/github/issues/bmw-software-engineering/lichtblick" alt="Version"/></a>
  <a href="https://github.com/bmw-software-engineering/lichtblick/graphs/contributors"><img alt="GitHub contributors" src="https://img.shields.io/github/contributors/bmw-software-engineering/lichtblick?color=2b9348"></a>
  <a href="https://github.com/bmw-software-engineering/lichtblick/blob/master/LICENSE"><img src="https://img.shields.io/github/license/bmw-software-engineering/lichtblick?color=2b9348" alt="License Badge"/></a>

  <br />
<p  align="center">
Lichtblick is an integrated visualization and diagnosis tool for robotics, available in your browser or as a desktop app on Linux, Windows, and macOS.
</p>
  <p align="center">
    <img alt="Lichtblick screenshot" src="resources/screenshot.png">
  </p>
</div>

**Dependencies:**

- [Node.js](https://nodejs.org/en/) v16.10+
- [Git LFS](https://git-lfs.github.com/)

<hr/>

## :rocket: Getting started

Clone the repository:

### Building the container

Please after cloning the repo you need to download some stuff from git lfs with:

```sh
$ git clone https://github.com/bmw-software-engineering/lichtblick.git
```

Pull large files with Git LFS:

```sh
$ git lfs pull
```

Enable corepack:

```sh
$ corepack enable
```

Install packages from `package.json`:

```sh
$ yarn install
```

Foxglove Studio originally began as a fork of [Webviz](https://github.com/cruise-automation/webviz), an open source project developed by [Cruise](https://getcruise.com/). Most of the Webviz code has been rewritten, but some files still carry a Cruise license header where appropriate.

## Using with Rosboard

We developed a new player compatible with also our own [fork of rosboard](https://github.com/kiwicampus/rosboard). To use it, you need to follow the instructions below:

1. **Use this Foxglove Fork**:
   You will need to use the [KiwiCampus fork for this project](https://github.com/kiwicampus/studio) or a derived version.

1. **Use our Rosboard Fork**:
   You will need to use the [KiwiCampus fork for Rosboard](https://github.com/kiwicampus/rosboard) on the robot you want to connect to.

1. **Connecting to Rosboard**:
   Similar to other available protocols (such as Rosbridge and Foxglove websocket), you can connect to Rosboard by following these steps:

   - Open the application.
   - Navigate to `File` -> `Open connection...`.
   - Select `Rosboard` from the list of available protocols.
   - Paste your websocket URL running Rosboard. Remeber it takes the form `ws://<ip>:<port>/rosboard/v1`.
   - Click `Open`.

- **Note**: Ensure that your Rosboard instance is running and accessible via the websocket URL you intend to use.
- If you still get errors about corepack after running `corepack enable`, try uninstalling and reinstalling Node.js. Ensure that Yarn is not separately installed from another source, but is installed _via_ corepack.

Launch the development environment:

```sh
# To launch the desktop app (run both scripts concurrently):
$ yarn desktop:serve        # start webpack
$ yarn desktop:start        # launch electron

# To launch the web app:
$ yarn run web:serve        # it will be avaiable in http://localhost:8080
```

## :hammer_and_wrench: Building Lichtblick

Build the application for production using these commands:

```sh
# To build the desktop apps:
$ yarn run desktop:build:prod   # compile necessary files

- yarn run package:win         # Package for windows
- yarn run package:darwin      # Package for macOS
- yarn run package:linux       # Package for linux

# To build the web app:
$ yarn run web:build:prod

# To build and run the web app using docker:
$ docker build . -t foxglove
$ docker run -p 8080:8080 foxglove

# It is possible to clean up build files using the following command:
$ yarn run clean
```

- The desktop builds are located in the `dist` directory, and the web builds are found in the `web/.webpack` directory.

## :pencil: License (Open Source)

Lichtblick follows an open core licensing model. Most functionality is available in this repository, and can be reproduced or modified per the terms of the [Mozilla Public License v2.0](/LICENSE).

## :handshake: Contributing

Contributions are welcome! Lichtblick is primarily built in TypeScript and ReactJS. All potential contributors must agree to the Contributor License Agreement outlined in [CONTRIBUTING.md](CONTRIBUTING.md).

## :star: Credits

Lichtblick originally began as a fork of [FoxGlove Studio](https://github.com/foxglove/studio), an open source project developed by [Foxglove](https://app.foxglove.dev/).
