/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { run as oclifRun } from '@oclif/command';
import { Config } from '@oclif/config';
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

    debugCliInfo(version, channel, env);

    return {
        async run() {
            const config = new Config({ name: pjson.oclif.bin, root, version, channel });
            await config.load();
            configureAutoUpdate(env);
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

function debugCliInfo(version: string, channel: string, env: Env) {
    debug('node version:    %s', process.versions.node);
    debug('cli version:     %s', version);
    debug('cli channel:     %s', channel);
    debug('os platform:     %s', os.platform());
    debug('os architecture: %s', os.arch());
    debug('os release:      %s', os.release());

    [
        'NODE_OPTIONS',
        Env.DISABLE_AUTOUPDATE_LEGACY,
        'SFDX_BINPATH',
        'SFDX_COMPILE_CACHE',
        Env.DISABLE_AUTOUPDATE_OCLIF,
        Env.CLI_MODE,
        Env.CLI_INSTALLER,
        Env.LAZY_LOAD_MODULES,
        'SFDX_NPM_REGISTRY',
        'SFDX_REDIRECTED',
        Env.S3_HOST,
        Env.UPDATE_INSTRUCTIONS
    ].forEach(key => debug('cli env:         %s=%s', key, env.getString(key)));
}
