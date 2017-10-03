import { Config } from 'cli-engine-config';
import * as path from 'path';
import timedHook from '../timedHook';

import {
    doInstallationCodeSigningVerification,
    InstallationVerification,
    VerificationConfig
} from '../../codeSigning/installationVerification';

import { CLI } from 'cli-ux';

import * as _ from 'lodash';

async function run(config: Config, {plugin, tag}: {plugin: string, tag: string}) {
    const cliUx = new CLI();
    cliUx.action.stop();
    const vConfig = new VerificationConfig();
    vConfig.verifier = new InstallationVerification().setPluginName(plugin).setCliEngineConfig(config);
    vConfig.log = cliUx.log.bind(cliUx);
    vConfig.prompt = cliUx.prompt.bind(cliUx);

    await doInstallationCodeSigningVerification(config, {plugin, tag}, vConfig);
}

export = timedHook('plugins:preinstall:signing', run);
