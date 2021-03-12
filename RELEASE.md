# Building and releasing CLI installers

Build and release of the CLI platform and standalone installers (which double as updater tarballs) are controlled by the use of `oclif` pack and upload commands.

## Build and/or release scripts

The most useful scripts can be run from `yarn`. Look in the package.json for `pack` commands.

## Local build requirements

In order to run pack locally on macOS, you'll need the following:

- Xcode
- p7zip (`brew install p7zip`)
- [optional] osslsigncode (`brew install osslsigncode`)
- [optional] makensis (`brew install makensis`)

## Build verification checks

The `script/verify-tarballs` script contains several sanity checks that ensure we don't repeat build errors that have been shipped to customers in the past. These simply check for known regressions and fail the build should any recur, so they are mostly reactive checks rather than proactive ones. The one proactive check built into this script, however, checks for suspected regressions in Windows path lengths in the candidate release artifacts.

Any known regressions in CLI artifact stability should have verification tests added here to help ensure they don't recur in the future.

## Archive and installer Overview

TODO

### Homebrew

While we'd like to create a Homebrew installer, this work is not currently a priority.
