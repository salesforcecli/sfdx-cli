/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import * as path from 'path';
import { run as oclifRun, Config, settings } from '@oclif/core';
import { set } from '@salesforce/kit';
import { AnyJson, get } from '@salesforce/ts-types';
import * as Debug from 'debug';
import { default as nodeEnv, Env } from './util/env';

const debug = Debug('sfdx');

export const UPDATE_DISABLED_INSTALLER =
  'Manual and automatic CLI updates have been disabled by setting "SF_AUTOUPDATE_DISABLE=true". ' +
  'To check for a new version, unset that environment variable.';

export const UPDATE_DISABLED_NPM = 'Use "npm update --global sfdx-cli" to update npm-based installations.';

export const UPDATE_DISABLED_DEMO =
  'Manual and automatic CLI updates have been disabled in DEMO mode. ' +
  'To check for a new version, unset the environment variable SFDX_ENV.';

export function configureUpdateSites(config: Config, env = nodeEnv): void {
  const npmRegistry = env.getNpmRegistryOverride();
  if (npmRegistry) {
    // Override config value if set via envar
    set(config, 'pjson.oclif.warn-if-update-available.registry', npmRegistry);
  }
}

export function configureAutoUpdate(envars: Env): void {
  if (envars.isDemoMode()) {
    // Disable autoupdates in demo mode
    envars.setAutoupdateDisabled(true);
    envars.setUpdateInstructions(UPDATE_DISABLED_DEMO);
    return;
  }

  if (envars.isInstaller()) {
    envars.normalizeAutoupdateDisabled();
    if (envars.isAutoupdateDisabled()) {
      envars.setUpdateInstructions(UPDATE_DISABLED_INSTALLER);
    }
    return;
  }

  // Not an installer, so this must be running from an npm installation
  if (!envars.isAutoupdateDisabledSet()) {
    // Disable autoupdates if run from an npm install or in local dev, if not explicitly set
    envars.setAutoupdateDisabled(true);
  }

  if (envars.isAutoupdateDisabled()) {
    envars.setUpdateInstructions(UPDATE_DISABLED_NPM);
  }
}

function debugCliInfo(version: string, channel: string, env: Env, config: Config): void {
  function debugSection(section: string, items: Array<[string, string]>): void {
    const pad = 25;
    debug('%s:', section.padStart(pad));
    items.forEach(([name, value]) => debug('%s: %s', name.padStart(pad), value));
  }

  debugSection('OS', [
    ['platform', os.platform()],
    ['architecture', os.arch()],
    ['release', os.release()],
    ['shell', config.shell],
  ]);

  debugSection('NODE', [['version', process.versions.node]]);

  debugSection('CLI', [
    ['version', version],
    ['channel', channel],
    ['bin', config.bin],
    ['data', config.dataDir],
    ['cache', config.cacheDir],
    ['config', config.configDir],
  ]);

  debugSection(
    'ENV',
    [
      'NODE_OPTIONS',
      Env.DISABLE_AUTOUPDATE_LEGACY,
      'SFDX_BINPATH',
      'SFDX_COMPILE_CACHE',
      Env.DISABLE_AUTOUPDATE_OCLIF,
      Env.CLI_MODE,
      Env.CLI_INSTALLER,
      Env.NPM_REGISTRY,
      'SFDX_REDIRECTED',
      Env.UPDATE_INSTRUCTIONS,
    ].map((key): [string, string] => [key, env.getString(key, '<not set>')])
  );

  debugSection(
    'ARGS',
    process.argv.map((arg, i): [string, string] => [i.toString(), arg])
  );
}

export function create(
  version: string,
  channel: string,
  run: typeof oclifRun = oclifRun,
  env = nodeEnv
): { run: () => Promise<unknown> } {
  settings.performanceEnabled = true;
  const root = path.resolve(__dirname, '..');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pjson = require(path.resolve(__dirname, '..', 'package.json')) as AnyJson;
  const args = process.argv.slice(2);

  return {
    async run(): Promise<unknown> {
      const config = new Config({ name: get(pjson, 'oclif.bin') as string | undefined, root, version, channel });
      await config.load();
      configureUpdateSites(config, env);
      configureAutoUpdate(env);
      debugCliInfo(version, channel, env, config);
      // I think the run method is used in test.
      return run(args, config);
    },
  };
}
