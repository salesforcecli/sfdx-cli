# CLI for sfdx

This is the `sfdx` CLI application, based on Heroku's v6
[cli-engine](https://github.com/heroku/cli-engine).  By default it comes installed with the `salesforcedx` plugin, which contributes all commands in the `force` namespace.

## Installation and Development

### Requirements

To get started, you'll need to install `node` v8.4 or greater.  While this can be done using an installer from [nodejs.com](nodejs.com), we recommend using [nvm](https://github.com/creationix/nvm) to easily manage multiple node versions.

If using `nvm`, be sure that you've selected the v8.4+ version with `nvm use v8.x.y`, where `x` and `y` are specific to the version that you installed. If you want to use this version by default run `nvm alias default node`. Otherwise, when you restart your shell nvm will revert to whatever version configured prior to installing v8.4.

You'll also need [yarn](https://yarnpkg.com/en/docs/install).  If you did decide to use `nvm`, be sure to follow the `nvm`-specific install instructions.

### Up and running as a CLI-only developer

1. From within this repository's root directory, run `yarn` (short for `yarn install`).
1. Run `bin/run` to view the CLI's root help.

### Up and running as a `force` namespace plugin developer

1. Make sure you have the any of the following dependencies that you need to work on cloned locally as sibling directories to this repository:
    * [salesforcedx](https://git.soma.salesforce.com/salesforcedx/salesforcedx)
    * [salesforce-alm](https://git.soma.salesforce.com/ALMSourceDrivenDev/force-com-toolbelt)
    * [force-language-services](https://git.soma.salesforce.com/DevTools/force-language-services)
    * [salesforce-lightning-cli](https://git.soma.salesforce.com/aura/lightning-cli)
1. Prior to v6 being the official CLI engine, you will also need to checkout the `pre-release` branch, or a derivative thereof, in each (except `salesforce-lightning-cli`, which can remain on master).
    * Until GA, you will also probably want `salesforcedx` to be on the `v6` branch, or a derivative.
1. Also be sure that each has been built, as necessary (e.g. using the repository-specific build, such as `gulp compile`)
1. Set up the `salesforcedx` aggregate plugin for development by running `yarn run setup`.  Note that this script creates various types of links between the above packages and this one.
    * If you don't like scripts messing with your projects, you can recreate the actions of the script by running something like the following commands, depending on your exact needs:
        1. `yarn install`
        1. `bin/run plugins:link ../salesforcedx`
        1. `cd ../salesforcedx`
        1. `npm link ../force-com-toolbelt`
        1. `npm link ../force-language-services`
        1. `npm link ../lightning-cli`
        1. `cd -`
        1. `bin/run plugins`
1. If everything worked, you should see something like `salesforcedx 41.1.0 (link)` (the exact version should be anything `41` or later).
1. (OPTIONAL) If you need to make modifications to the Heroku `cli-engine` upon which this is based, also clone and run `yarn` in each of these repositories as sibling directories of this repository:
    * [cli-engine](https://github.com/heroku/cli-engine)
    * [cli-engine-command](https://github.com/heroku/cli-engine-command)
    * [cli-engine-config](https://github.com/heroku/cli-engine-config)
1. Run `yarn run setup with-engine` to have all necessary npm links created for you.  You can revert the effects of this command by running `yarn run setup without-engine`.

You can now run the CLI using the `bin/run` script to test your CLI and plugin changes.

### Developer CLI flags

The following flags are supported by the `bin/run` script, and can be combined as desired.  They are stripped from the args passed to the CLI application itself.

* *--dev-suspend*: Starts the `node` binary with the `--inspect-brk` flag to allow a remote debugger to attach before running.
* *--dev-debug*: Sets the `SFDX_DEBUG=1` and `DEBUG=\*` envars for the CLI's `node` process, which enables full debug output from the v6 `cli-engine`.
* *--dev-config*: Sets the `CLI_ENGINE_SHOW_CONFIG=1` envar for the CLI's `node` process, which causes the cli-engine to dump it's runtime configuration value at startup.

### Scripts

A few additional convenience scripts are available to help with common development tasks:

* `yarn run build [PLATFORM] [CHANNEL]` - Builds a release package into the `./tmp` directory.  For example, `yarn run build darwin-x64 alpha` will create a macOS build for the `alpha` channel.
* `yarn run clean-dev` - Uninstalls the salesforcedx plugin and then deletes all node\_modules directories for the CLI and its linked plugin dependencies.
* `yarn run clean-cache` - Deletes the v6 CLI's plugin cache.
* `yarn run clean-all` - Runs both `clean-dev` and `clean-cache`
* `yarn run downgrade` - For testing the v5-\>v6 CLI migration, this removes both the v6 caches and the v6 installation and all plugins!  Use with care.
* `yarn run release-all` - Builds and releases all distributions to the channel configured in `package.json`'s `cli.channel` property.

### Developer notes

* If you change this project's `package.json` to reference a new core plugin, or change the `package.json` of any referenced plugins, you may need to delete `cli-engine`'s plugin cache to force it to reload.
    * Use `yarn run clear-cache`
* If you are using a locally linked `cli-engine` and making changes, you may want to set up its compile watch with `yarn run watch`.
* The `build` and `release-all` scripts currently require [Docker](https://www.docker.com/get-docker) to run.
* To manually install a specific version of the `salesforcedx` plugin before v6 builds of it start getting published publicly, you can edit `~/.local/share/sfdx/plugins/.yarnrc` to point to the internal v6 npm registry (i.e. `registry "http://10.252.156.164:4876"`).  You can then install v6 builds of salesforcedx as a user plugin pinned to a specific version like so: `sfdx plugins:install salesforcedx@41.2.0-v6.0`, or from the `alpha` dist tag like this`sfdx plugins:install salesforcedx@alpha`.

## Releasing

Building and publishing a release manually currently requires [Docker](https://www.docker.com/get-docker).  You will also need salesforcedx S3 bucket write credentials stored in a standard AWS config file in `./.aws/credentials`.  Then, you should be able to build and release by running `yarn run release-all`.
