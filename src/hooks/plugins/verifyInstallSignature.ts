/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { NamedError } from '@salesforce/kit';
import {
    ConfigContext,
    doInstallationCodeSigningVerification,
    InstallationVerification,
    NpmName,
    VerificationConfig
} from '@salesforce/sfdx-trust';
import { cli } from 'cli-ux';
import * as Debug from 'debug';
import timedHook from '../timedHook';

const debug = Debug('sfdx:plugins:trust:signing');

const hook = timedHook<'plugins:preinstall'>('plugins:preinstall:signing', async function(options) {
    cli.action.stop('Checking for digital signature.');
    const vConfig = new VerificationConfig();

    const plugin = options.plugin;

    const npmName = NpmName.parse(plugin.name);
    npmName.tag = plugin.tag || 'latest';

    if (/^v[0-9].*/.test(npmName.tag)) {
        npmName.tag = npmName.tag.slice(1);
    }

    const configContext: ConfigContext = {
        cacheDir: options.config.configDir,
        configDir: options.config.cacheDir,
        dataDir: options.config.dataDir
    };

    vConfig.verifier = new InstallationVerification()
        .setPluginNpmName(npmName)
        .setConfig(configContext);

    vConfig.log = cli.log.bind(cli);
    vConfig.prompt = cli.prompt.bind(cli);

    try {
        await doInstallationCodeSigningVerification(configContext, { plugin: plugin.name, tag: plugin.tag}, vConfig);
        cli.action.start('Finished digital signature check. Installing');
    } catch (err) {
        if (err instanceof NamedError && err.name === 'CanceledByUser') {
            debug(err.message);
            cli.action.start('Finished digital signature check. Skipping');
        } else {
            this.error(err.message);
            this.exit(1);
        }
    }
});

export default hook;
