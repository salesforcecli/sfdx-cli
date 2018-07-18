// TODO: commented out until oclif supports the `plugins:preinstall` hook?
// import {
//     ConfigContext,
//     doInstallationCodeSigningVerification,
//     InstallationVerification,
//     NpmName,
//     VerificationConfig
// } from '@salesforce/sfdx-trust';
// import { NamedError, Optional } from '@salesforce/ts-json';
// import { CLI } from 'cli-ux';
// import _ = require('lodash');
import timedHook from '../timedHook';

const hook = timedHook<'plugins:preinstall'>('plugins:preinstall:signing', async options => {
    console.log('TODO: implement plugins:preinstall:signing hook');
    // const cliUx = new CLI();
    // cliUx.action.stop('Checking for digital signature.');
    // const vConfig = new VerificationConfig();

    // const npmName = NpmName.parse(options.plugin);
    // npmName.tag = options.tag;

    // const configContext: ConfigContext = {
    //     cacheDir: _.get(options.config, 'configDir'),
    //     configDir: _.get(options.config, 'cacheDir'),
    //     dataDir: _.get(options.config, 'dataDir')
    // };

    // vConfig.verifier = new InstallationVerification()
    //     .setPluginNpmName(npmName)
    //     .setConfig(configContext);

    // vConfig.log = cliUx.log.bind(cliUx);
    // vConfig.prompt = cliUx.prompt.bind(cliUx);

    // let namedError: Optional<NamedError>;
    // try {
    //     await doInstallationCodeSigningVerification(configContext, { plugin: options.plugin, tag: options.tag}, vConfig);
    // } catch (e) {
    //     if (e instanceof NamedError) {
    //         namedError = e;
    //     }
    //     throw e;
    // } finally {
    //     if (namedError) {
    //         cliUx.action.start('Finished digital signature check. Skipping');
    //     } else {
    //         cliUx.action.start('Finished digital signature check. Installing');
    //     }
    // }
});

export default hook;
