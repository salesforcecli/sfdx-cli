# CLI for sfdx

This is the `sfdx` CLI application, based on Heroku's v6
[cli-engine](https://github.com/heroku/cli-engine).

## Installation and Development

To get started, you'll need to install `node` v8 or greater.  While this can be done using an installer from [nodejs.com](nodejs.com), we recommend using [nvm](https://github.com/creationix/nvm) to easily manage multiple node versions.

If using `nvm`, be sure that you've selected the v8+ version with `nvm use v8.x.y`, where `x` and `y` are specific to the version that you installed. If you want to use this version by default run `nvm alias default node`. Otherwise, when you restart your shell nvm will revert to whatever version configured prior to installing 8.

### Up and running as a user

1. From within this repository's root directory, run `npm install`.
1. Run `bin/run` to view the CLI's root help.

### Up and running as a `force` namespace plugin developer

1. Make sure you have the following dependencies cloned locally as sibling directories to this repository:
    * [salesforcedx](https://git.soma.salesforce.com/salesforcedx/salesforcedx)
    * [force-com-toolbelt](https://git.soma.salesforce.com/ALMSourceDrivenDev/force-com-toolbelt)
    * [force-language-services](https://git.soma.salesforce.com/DevTools/force-language-services)
1. Run `bin/setup-dev` to have all necessary npm links created for you.
1. Run `bin/run` to view the CLI's root help.

### Up and running as a developer contributing to cli-engine

1. If you need to make modifications to the Heroku `cli-engine` upon which this is based, also clone these repositories as sibling directories of this repository:
    * [cli-engine](https://github.com/heroku/cli-engine)
    * [cli-engine-command](https://github.com/heroku/cli-engine)
    * [cli-engine-config](https://github.com/heroku/cli-engine)
1. Run `bin/setup-dev +cli-engine` to have all necessary npm links created for you.

#### Developer flags

The following flags are supported by the `bin/run` script, and can be combined as desired.  They are stripped from the args passed to the CLI application itself.

* *--cli-suspend*: Starts the `node` binary with the `--inspect-brk` flag to allow a remote debugger to attach before running.
* *--cli-debug*: Sets the `SFDX_DEBUG=1` envar for the `node` process, which enables the v6 `cli-engine`'s debug output level.

#### Developer notes

* If you change this project's `package.json` to reference a new core plugin, or change the `package.json` of any referenced plugins, you may need to delete `cli-engine`'s plugin cache to force it to reload.
    * For macOS: `rm ~/Library/Caches/sfdx-cli/plugins.json`
* If you are using a locally linked `cli-engine` and making changes, you may want to set up its compile watch with `npm run watch`.
