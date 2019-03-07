/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { run as oclifRun } from '@oclif/command';
import { Config, IConfig } from '@oclif/config';
import { set } from '@salesforce/kit';
import * as Debug from 'debug';
import * as os from 'os';
import * as path from 'path';
import * as lazyRequire from './lazyRequire';
import { default as nodeEnv, Env } from './util/env';

const debug = Debug('sfdx');

export function create(version: string, channel: string, run = oclifRun, env = nodeEnv) {
    const root = path.resolve(__dirname, '..');
    const pjson = require(path.resolve(__dirname, '..', 'package.json'));
    const args = process.argv.slice(2);

    return {
        async run() {
            const config = new Config({ name: pjson.oclif.bin, root, version, channel });
            await config.load();
            configureUpdateSites(config, env);
            configureAutoUpdate(env);
            debugCliInfo(version, channel, env, config);
            if (args[1] !== 'update' && env.isLazyRequireEnabled()) {
                lazyRequire.start(config);
            }
            return await run(args, config);
        }
    };
}

export const UPDATE_DISABLED_INSTALLER =
    'Manual and automatic CLI updates have been disabled by setting "SFDX_AUTOUPDATE_DISABLE=true". ' +
    'To check for a new version, unset that environment variable.';

export const UPDATE_DISABLED_NPM =
    'Use "npm update --global sfdx-cli" to update npm-based installations.';

export const UPDATE_DISABLED_DEMO =
    'Manual and automatic CLI updates have been disabled in DEMO mode. ' +
    'To check for a new version, unset the environment variable SFDX_ENV.';

export function configureUpdateSites(config: IConfig, env = nodeEnv) {
    const s3Host = env.getS3HostOverride();
    if (s3Host) {
        // Override config value if set via envar
        set(config, 'pjson.oclif.update.s3.host', s3Host);
    }

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

function debugCliInfo(version: string, channel: string, env: Env, config: IConfig) {
    const pad = 25;
    debug('os platform:'.padStart(pad), os.platform());
    debug('os architecture:'.padStart(pad), os.arch());
    debug('os release:'.padStart(pad), os.release());
    debug('os shell:'.padStart(pad), config.shell);
    debug('node version:'.padStart(pad), process.versions.node);
    debug('cli version:'.padStart(pad), version);
    debug('cli channel:'.padStart(pad), channel);
    debug('cli bin:'.padStart(pad), config.bin);
    debug('cli data dir:'.padStart(pad), config.dataDir);
    debug('cli config dir:'.padStart(pad), config.configDir);
    debug('cli cache dir:'.padStart(pad), config.cacheDir);

    debug('cli env:'.padStart(pad));
    // TODO: maybe env.getKnown()?
    [
        'NODE_OPTIONS',
        Env.DISABLE_AUTOUPDATE_LEGACY,
        'SFDX_BINPATH',
        'SFDX_COMPILE_CACHE',
        Env.DISABLE_AUTOUPDATE_OCLIF,
        Env.CLI_MODE,
        Env.CLI_INSTALLER,
        Env.LAZY_LOAD_MODULES,
        Env.NPM_REGISTRY,
        'SFDX_REDIRECTED',
        Env.S3_HOST,
        Env.UPDATE_INSTRUCTIONS
    ].forEach(key => debug('%s: %s', key.toString().padStart(pad - 1), env.getString(key) || ''));

    debug('cli args:'.padStart(pad));
    process.argv.forEach(arg => debug('  %s', arg));
}
