import {
    ConfigContext,
    doInstallationCodeSigningVerification,
    InstallationVerification,
    NpmName,
    VerificationConfig
} from '@salesforce/sfdx-trust';
import { NamedError } from '@salesforce/ts-json';
import { cli } from 'cli-ux';
import * as Debug from 'debug';
import timedHook from '../timedHook';
import { PreinstallOptions } from './preinstall';

const debug = Debug('sfdx:plugins:trust:signing');

// TODO: for some reason oclif seems to fire hooks twice, so this ensures we run this hook once
let hasFired = false;

const hook = timedHook<'plugins:preinstall'>('plugins:preinstall:signing', async function(options) {
    if (hasFired) return;
    hasFired = true;

    cli.action.stop('Checking for digital signature.');
    const vConfig = new VerificationConfig();

    // TODO: hopefully this is temporary until oclif adds a real preinstall hook
    const opts = options as PreinstallOptions;
    const plugin = opts.plugin;

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
