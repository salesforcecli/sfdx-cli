# Building and releasing CLI installers

Build and release of the CLI platform and standalone installers (which double as updater tarballs) are controlled by the use of the scripts in this directory.

## Directory overview

```
.
├── _vars               determines environmental variables like channel and version
├── build               builds releasable artifacts
│   └── installers      builds platform-specific installers
├── clean               various clean operations
├── lint                various linting operations
├── release             uploads of various artifacts to S3
│   └── installers      uploads platform-specific installers
└── test                tests of both sources and build output
```

## Shortcuts for invoking build and/or release scripts

The most useful scripts can be run from `yarn`:

* `yarn build`: Alias for `yarn build-standalone`
* `yarn build-mac`: Builds the macOS installer executable `sfdx-cli.pkg`
  * Include `OSX_KEYCHAIN` containing the keychain to search for a valid signing identity if a signed installer is required (optional)
* `yarn build-standalone`: Builds standalone installer/updater tarballs for all platforms
* `yarn build-windows`: Builds the Windows installer executables `sfdx-cli-x64.exe` and `sfdx-cli-x86.exe`
  * Include `WINDOWS_SIGNING_KEY` and `WINDOWS_SIGNING_PASS` envars (required, see below for details on generating test values)
* `yarn clean`: Both `yarn clean-dist` and `yarn clean-test`
* `yarn clean-build`: Removes `node_modules`, `tmp`, and `release` dirs
* `yarn clean-all`: Both `yarn clean` and `yarn clean-build`
* `yarn clean-dist`: Removes the `dist` dir
* `yarn clean-test`: Removes all artifacts produced by running tests
* `yarn compile`: Runs the TypeScript compilation of `src` to `dist`
* `yarn coverage-report`: Generates a UT coverage report
* `yarn lint`: Runs `eslint` and `tslint` on the `src` dir
* `yarn lint-all`: Lints all the things, including scripts
* `yarn lint-with-style`: Runs `eslint` and `tslint` with checkstyle enabled on the `src` dir
* `yarn prepare`: Same as `yarn compile`
* `yarn release`: Same as `yarn release-standalone`
* `yarn release-debug`: Same as `yarn release-standalone`, but with fake S3 uploads
* `yarn release-mac`: Builds the macOS installer executable and uploads to S3
* `yarn release-mac-debug`: Same as `yarn release-mac`, but with fake S3 uploads
* `yarn release-standalone`: Builds all standalone installer tarballs and uploads to S3
* `yarn release-standalone-debug`: Same as `yarn release-standalone`, but with fake S3 uploads
* `yarn release-windows`: Builds all Windows installer executables and uploads to S3
* `yarn release-windows-debug`: Same as `yarn release-windows`, but with fake S3 uploads
* `yarn test`: Runs unit tests
* `yarn typings`: Runs typings tests
* `yarn unit`: Runs unit tests with coverage
* `yarn watch`: Runs the TypeScript compiler in watch mode

## Optional git pre-push hook

It is recommended to copy the git `pre-push` hook found in `scripts/pre-push` to `.git/hooks/pre-push`.  This script will run all lint and unit-test-with-coverage tasks, which can help detect errors earlier in development than when you go to create a PR.

## Local build requirements

In order to run all scripts locally on macOS, you'll need the following:

* Xcode
* p7zip (`brew install p7zip`)
* [optional] shellcheck (`brew install shellcheck`)
* [optional] [Docker for Mac](https://www.docker.com/docker-mac)
* [optional] osslsigncode (`brew install osslsigncode`)
* [optional] makensis (`brew install makensis`)

`shellcheck` is not strictly required, but is strongly encouraged, especially if you are going to modify the `bash` scripts.

If you install Docker, you can skip `osslsigncode` and `makensis`, or vice versa.  The former uses Docker to avoid the requirement of the latter two.  The Docker build runs substantially slower on macOS than running the scripts directly, though, so if you need to run the Windows installer build frequently it makes sense to skip Docker and install the other dependencies.

## Build

Due to issues with the physical and logical resources available to us in our CI environments, the build is broken down into two logical parts: the main build of the platform-specific standalone installers (also known as updater tarballs) and the platform-specific installer executables.

### Standalone installer/updater tarballs

The build produces a set of platform-specific tarballs that are used by the CLI updater to fetch new versions of the CLI as a CLI command or when the autoupdater is enabled.  These tarballs also serve as standalone installers.  If downloaded directly for either macOS or linux platforms, one can unpack the tarball and run the `install` script found in the root of directory to install it globally (in either `/usr/local/bin` or `/usr/bin` as appropriate for the target platform).

The standalone installers are typically built using the `build\standalone` script in a CI job as the first step of running the `release/standalone` script.  `build\standalone` builds the standalone installer tarballs for each supported OS/architecture combination, as follows:

* darwin (x64)
* windows (x64)
* windows (x86)
* linux (x64)
* linux (x86)
* linux (arm)

Both versioned and unversioned copies of each OS/arch tarball is produced and placed in the `release` directory upon completion.

#### Release metadata

In addition to the tarballs themselves, a number of version and checksum JSON files are produced that guide the CLI updater toward the latest version when executing an update.  A `manifest.json` file is also created to help humans find download URLs for the latest versioned tarballs.

##### Version

Each S3 channel folder contains a current `version` file that contains the latest version identifier for that channel.  This is a simple JSON file containing just the channel name and latest build version.

For example, see https://developer.salesforce.com/media/salesforce-cli/sfdx-cli/channels/release/version

##### Manifest

Each S3 channel folder contains a current `manifest.json` file that contains a full list of all download URLs for the latest version's tarballs and checksums for each OS/arch combination.  When releasing to the `stable` channel, this manifest will also be copied to the root of the S3 bucket to help guide humans

For example, see https://developer.salesforce.com/media/salesforce-cli/sfdx-cli/channels/release/manifest.json

##### Platform version

Each S3 channel additionally contains a platform-specific metadata file named int he format `<os>-<arch>` which contains the latest version, channel name, and checksums for each of the gzip and xz tarballs.

### Executable installers

Additional installer executables can be produced using separate build scripts for both Windows and macOS platforms.  The

#### Windows

In order to build the Windows installers, you can proceed in one of two ways -- using Docker or by manually installing the necessary dependencies and building directly.  If building as a one-off, using Docker may be more effective.  If building regularly, building directly without Docker will be more time efficient.

The installer executables will be output to the `release` directory by both methods.

##### Direct

You will need the following software installed on your machine:

* osslsigncode (`brew install osslsigncode`)
* makensis (`brew install makensis`)

Then, you can run `yarn build-windows` to simply build the executables, assuming you have created a test signing kay and set the necessary envars as described below, before running the command.

##### Docker

Using [Docker](https://www.docker.com/docker-mac), you can run `yarn release-windows` or `yarn release-windows-debug` (using the latter if you only want to generate the installers locally without uploading to S3 -- probably what you want, if you are not a CI machine!).  These `yarn` conveniences run the `scripts/release/installers/windows_docker` script under the hood.

In order for these to complete successfully, you will need to generate a testable signing key, as described below, and then set the envars as indicated before running the script.

##### Generating a testable signing key

In Windows PowerShell, run the following commands:

```
New-SelfSignedCertificate -DnsName "developer.salesforce.com"
$pwd = ConvertTo-SecureString -String "SfdxCliRox!" -Force -AsPlainText
Export-PfxCertificate -cert cert:\localMachine\my\<hash>
```

The value of `<hash>` required by the third command is output by the first command.  Copy the resulting `.pfx` file to your host machine and base64 encode it.  Put the base64 value into an envar named `WINDOWS_SIGNING_KEY` and put the password you used in the second command above as the value of the envar `WINDOWS_SIGNING_PASS`.  You can then run either method of building the Windows installer executables in a shell that has these envars set.

#### macOS

The macOS installer must be built on Mac hardware (whether in a VM or not), as required by the Xcode tool chain.

In order to build the installer, you can simply run `yarn build-mac`.  By default, this will produce an unsigned `.pkg` file in the `release` directory.

To build a signed installer, you will need a valid Apple developer signing identity installed in a keychain on the machine your using to run the build.  You must then put the name of the keychain to search for the signing identity in an envar named `OSX_KEYCHAIN` before running the build script.

#### Debian Linux

Debian/apt-get installer scripts are not yet complete, and the work to finish them is not currently a priority.

#### Homebrew

While we'd like to create a Homebrew installer, this work is not currently a priority.

### Build verification checks

The `build/verify` script contains several sanity checks that ensure we don't repeat build errors that have been shipped to customers in the past.  These simply check for known regressions and fail the build should any recur, so they are mostly reactive checks rather than proactive ones.  The one proactive check built into this script, however, checks for suspected regressions in Windows path lengths in the candidate release artifacts.

Any known regressions in CLI artifact stability should have verification tests added here to help ensure they don't recur in the future.

## Release

The suite of release scripts primarily uploads the artifacts produced by the build scripts to S3 (or an S3-like internal service, such as `minio`).  Releases are uploaded to named channels, depending on which git branch is being released.

## Channels

The following release channels are in active use:

* `stable`: Publicly released builds available to all customers
* `master`: The next planned release to the stable channel
* `release`: Development releases

The `master` and `release` branches track the state of their respective git branches.  The flow of channel progression is first to `release` as nightlies or on-demand builds, then to `master` as release candidates, and finally as a promotion from `master` to `stable` when releasing to customers.

### Internal and test releases using `minio` instead of S3

_TODO_

### Rolling back a release

_TODO_
