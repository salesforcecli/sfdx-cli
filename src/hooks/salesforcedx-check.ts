/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import Plugins from '@oclif/plugin-plugins';
import { Config, CliUx } from '@oclif/core';
import { AnyJson, get } from '@salesforce/ts-types';
import { compareVersions } from '../versions';

const salesforcedxError = `You still have the deprecated salesforcedx plugin installed in Salesforce CLI. If you continue using this plugin, you'll be running old and out-of-date versions of sfdx commands.
    Uninstall the plugin with this command: 'sfdx plugins:uninstall salesforcedx'.
    See https://github.com/forcedotcom/cli/blob/main/releasenotes/sfdx/README.md#71063-june-17-2021 for more information about this change.`;

const MAX_VERSION = '7.107.0';

const hook = async (): Promise<void> => {
  // PART 1: is the CLI recent enough that we don't allow salesforcedx?
  const root = path.resolve(__dirname, '..', '..');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pjson = require(path.resolve(root, 'package.json')) as AnyJson;
  const config = new Config({ name: get(pjson, 'oclif.bin') as string | undefined, root });
  await config.load();

  // early exit for old CLIs that shouldn't bother inspecting their plugins
  if (compareVersions(config.version, MAX_VERSION) < 0) {
    return;
  }

  // PART 2: is the salesforcedx plugin installed?
  // @ts-expect-error - Type errors because of the oclif/core v1/v2 migration. This can be removed once sfdx-cli is using oclif/core@2.x
  const plugins = new Plugins(config);

  const installedUserPlugins = (await plugins.list())
    .filter((plugin) => plugin.type === 'user')
    .map((plugin) => plugin.name);
  CliUx.ux.log(`user plugins are ${installedUserPlugins.join(', ')}`);

  if (installedUserPlugins.includes('salesforcedx')) {
    CliUx.ux.warn(salesforcedxError);
  }
};

export default hook;
