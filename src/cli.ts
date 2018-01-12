import CLI from 'cli-engine';
import { Config } from 'cli-engine-config';
import * as path from 'path';
import env from './util/env';

const root = path.join(__dirname, '..');
const pjson = require(path.join(root, 'package.json')); // tslint:disable-line

export function create(version: string, channel: string) {
    return new CLI({
        argv: process.argv.slice(1),
        config: configureAutoUpdate(env, {
            channel, pjson, root, version
        })
    });
}

export const UPDATE_DISABLED_INSTALLER =
    'Manual and automatic CLI updates have been disabled by setting "SFDX_AUTOUPDATE_DISABLE=true". ' +
    'To check for a new version, unset that environment variable.';

export const UPDATE_DISABLED_OTHER =
    'Use "npm install --global sfdx-cli" to update npm-based installations.';

export function configureAutoUpdate(envars: typeof env, config: Config): Config {
    if (envars.getBoolean('SFDX_INSTALLER')) {
        if (envars.getBoolean('SFDX_AUTOUPDATE_DISABLE')) {
            config.updateDisabled = UPDATE_DISABLED_INSTALLER;
        }
        return config;
    }

    if (!envars.get('SFDX_AUTOUPDATE_DISABLE')) {
        // Disable autoupdates if run from an npm install or in local dev, if not explicitly set
        envars.setBoolean('SFDX_AUTOUPDATE_DISABLE', true);
    }

    if (envars.getBoolean('SFDX_AUTOUPDATE_DISABLE')) {
        config.updateDisabled = UPDATE_DISABLED_OTHER;
    }
    return config;
}
