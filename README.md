# Salesforce CLI

This is the latest `sfdx` CLI application, based on the
[oclif](https://oclif.io) CLI engine. By default it comes installed with the [salesforcedx](https://www.npmjs.com/package/salesforcedx) plugin, which contributes all commands from the `force` command namespace.

## Releases

We publish the `latest` CLI on Thursdays. At the same time we also publish the `latest-rc` release candidate CLI. The release candidates contain changes that will likely be in the final official version for the next release.
To Install the `latest-rc` version, run `npm install sfdx-cli@latest-rc`. We suggest having your CI/CD pipeline use the `latest-rc` in addition to the `latest` release tags.

Run `sfdx version` to display the version of Salesforce CLI installed on your computer. Run `sfdx plugins --core` to display the versions of the installed plug-ins.

Run `sfdx update` to update the CLI to the latest available version.

## Installation

You can install this by either using an OS-specific installer [available here](https://developer.salesforce.com/tools/sfdxcli), by directly installing it with `npm` or `yarn` (see the instructions below), or if using macOS or linux by running the `install` script in a standalone installer (links to which can be found in the latest tarball [manifest](https://developer.salesforce.com/media/salesforce-cli/manifest.json)).

### Installing with `npm` or `yarn`

To get started, you'll need to install `node` v8.4 or greater, though we recommend using the latest v12 (LTS) for the best experience. While this can be done using an installer from [nodejs.com](nodejs.com) or via an OS-specific package manager, we recommend using [nvm](https://github.com/creationix/nvm) to easily manage multiple `node` versions.

If using `nvm`, be sure that you've selected the appropriate version with something like `nvm use v10.x.y`, where `x` and `y` are specific to the version that you installed. If you want to use this version by default run `nvm alias default node` -- otherwise, when you restart your shell `nvm` will revert to whatever version configured prior to installing the latest.

### `npm`

`npm` is installed automatically with Node.js. Install the CLI using `npm` as follows:

```bash
> npm install --global sfdx-cli
```

### `yarn`

`yarn` is another popular Node.js package manager that can be used to install the CLI, but it needs to be [installed separately](https://yarnpkg.com/en/docs/install) from Node.js if you choose to use it.

Note that by default `yarn` will attempt to install the binary in a location that may conflict with the location used by the installers, so you may additionally want to run the following command to avoid collision should you want to maintain two separate installations: `yarn config set prefix ~/.yarn` (macOS and Linux). Then, use the following:

```bash
> yarn global add sfdx-cli
```

## Development

If you would like to contribute, please see also the internal [developer documentation](./DEVELOPER.md).
