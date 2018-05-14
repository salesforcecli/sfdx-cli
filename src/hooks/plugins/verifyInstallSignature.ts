import { Config } from 'cli-engine-config';

import _ = require('lodash');
import timedHook from '../timedHook';
import { NamedError } from '../../util/NamedError';
import {
    doInstallationCodeSigningVerification,
    InstallationVerification,
    VerificationConfig,
    ConfigContext
} from '@salesforce/sfdx-trust';

import { CLI } from 'cli-ux';
import {NpmName} from '../../util/NpmName';

async function run(config: Config, {plugin, tag}: {plugin: string, tag: string}) {
    const cliUx = new CLI();
    cliUx.action.stop('Checking for digital signature.');
    const vConfig = new VerificationConfig();

    const npmName: NpmName = NpmName.parse(plugin);
    npmName.tag = tag;

    const configContext: ConfigContext = {
        cacheDir: _.get(config, 'configDir'),
        configDir: _.get(config, 'cacheDir'),
        dataDir: _.get(config, 'dataDir')
    };

    vConfig.verifier = new InstallationVerification()
        .setPluginNpmName(npmName)
        .setConfig(configContext);

    vConfig.log = cliUx.log.bind(cliUx);
    vConfig.prompt = cliUx.prompt.bind(cliUx);

    let namedError: NamedError | undefined;
    try {
        await doInstallationCodeSigningVerification(configContext, {plugin, tag}, vConfig);
    } catch (e) {
        if (e instanceof NamedError) {
            namedError = e;
        }
        throw e;
    } finally {
        if (namedError) {
            cliUx.action.start('Finished digital signature check. Skipping');
        } else {
            cliUx.action.start('Finished digital signature check. Installing');
        }
    }
}

export = timedHook('plugins:preinstall:signing', run);
