import { run } from '@oclif/command';
import { Config } from '@oclif/config';
import * as path from 'path';
import * as lazyRequire from './lazyRequire';
import { default as env, Env } from './util/env';

export interface AsyncRunnable {
    run: () => Promise<any>; // tslint:disable-line:no-any
}

export function create(version: string, channel: string): AsyncRunnable {
    const root = path.resolve(__dirname, '..');
    const pjson = require(path.resolve(__dirname, '..', 'package.json'));
    const args = process.argv.slice(2);

    return {
        async run() {
            // Oclif's config loader contains logic that sets version and channel using build assumptions we don't
            // follow, so we start by loading the config ourselves and then overriding those values with our own
            // TODO: PR oclif to allow us to set these more cleanly without this awkward workaround
            const config = new Config({ name: pjson.oclif.bin, root });
            // Require a dark feature envar to enable the lazy loading experiment, and disable during update commands
            if (env.getBoolean('SFDX_LAZY_LOAD_MODULES') && args[1] !== 'update') {
                await lazyRequire.start(config);
            }
            await config.load();
            config.version = version;
            config.channel = channel;
            configureAutoUpdate(env);
            return run(args, config);
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

    return;
}
