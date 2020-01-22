# CLI for sfdx

This is the `sfdx` CLI application, based on Heroku's
[oclif](https://oclif.io).  By default it comes installed with the `salesforcedx` plugin, which contributes all commands in the `force` namespace.

## Installation and Development

### Requirements

To get started, you'll need to install `node` v8.4 or greater, though we recommend using the latest v10 (LTS) for the best experience.  While this can be done using an installer from [nodejs.com](nodejs.com) or via an OS-specific package manager, we recommend using [nvm](https://github.com/creationix/nvm) to easily manage multiple `node` versions.

If using `nvm`, be sure that you've selected the appropriate version with something like `nvm use v10.x.y`, where `x` and `y` are specific to the version that you installed. If you want to use this version by default run `nvm alias default node` -- otherwise, when you restart your shell `nvm` will revert to whatever version configured prior to installing the latest.

You'll also need [yarn](https://yarnpkg.com/en/docs/install).  If you did decide to use `nvm`, be sure to follow the `nvm`-specific install instructions.

### Up and running as a CLI-only developer

1. From within this repository's root directory, run `yarn` (short for `yarn install`).
1. Run `bin/run` to view the CLI's root help.

When you make changes to this project's `.ts`. sources, you will need to recompile.  Use `yarn compile` to rebuild.  Linting and tests will run as git hooks before pushing.

### Developer CLI flags

#### `bin/run` flags

The following flags are supported by the `bin/run` script, and can be combined as desired.

* *--dev-debug*: Sets the `SFDX_DEBUG=1`, `SFDX_ENV=development`, and `DEBUG=\*` envars for the CLI's `node` process, which enables full debug output from both `sfdx` and the oclif CLI engine.

#### `bin/run.sh` or `bin\run.cmd` flags

The following flags are supported by the `bin/run.sh` script, which wraps the `bin/run` script referenced in the rest of this document, and can be combined as desired.  They are stripped from the args passed to the CLI application itself.

* *--dev-suspend*: Starts the `node` binary with the `--inspect-brk` flag to allow a remote debugger to attach before running.  _Does not work with npm-based installs.  For this case, you can set the environment variable `NODE_OPTIONS='--inspect-brk'`. You may also need to set the variable `OCLIF_TS_NODE=0` for debugger break points to stop on the correct lines._
* To set other Node executable flags, the use of the `NODE_OPTIONS` environment variable is required.

### Developer notes

* To manually install a specific version of the `salesforcedx` plugin from an internal npm registry, you can set `SFDX_NPM_REGISTRY` with the internal URL (e.g. `registry "http://10.252.156.164:4880"`).
* If you are using a locally linked `cli-engine` and making changes, you may want to set up its compile watch with `yarn run watch`.

## Build and release

The CLI can be built and released to S3 on various channels by using the [jobs](http://10.252.156.172:8080/job) available on Jenkins.

For more information about how to locally run or modify the build and release scripts, see the [SCRIPTS](SCRIPTS.md) document.
