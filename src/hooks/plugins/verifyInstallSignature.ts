import { Config } from 'cli-engine-config';
import timedHook from '../timedHook';
import { NamedError } from '../../util/NamedError';
import {
    doInstallationCodeSigningVerification,
    InstallationVerification,
    VerificationConfig
} from '../../codeSigning/installationVerification';

import { CLI } from 'cli-ux';

async function run(config: Config, {plugin, tag}: {plugin: string, tag: string}) {
    const cliUx = new CLI();
    cliUx.action.stop('Checking for digital signature.');
    const vConfig = new VerificationConfig();
    vConfig.verifier = new InstallationVerification()
        .setPluginName(plugin)
        .setPluginTag(tag)
        .setCliEngineConfig(config);

    vConfig.log = cliUx.log.bind(cliUx);
    vConfig.prompt = cliUx.prompt.bind(cliUx);

    let namedError: NamedError | undefined;
    try {
        await doInstallationCodeSigningVerification(config, {plugin, tag}, vConfig);
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
