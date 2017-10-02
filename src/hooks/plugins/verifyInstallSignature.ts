import { Config } from "cli-engine-config";
import * as path from "path";
import timedHook from "../timedHook";

import {
    doInstallationCodeSigningVerification,
    InstallationVerification,
    VerificationConfig
} from "../../codeSigning/installationVerification";

import * as cliUtil from "heroku-cli-util";

import * as _ from "lodash";

async function run(config: Config, {plugin, tag}: {plugin: string, tag: string}) {
    const vConfig = new VerificationConfig();
    vConfig.verifier = new InstallationVerification().setPluginName(plugin).setCliEngineConfig(config);
    vConfig.log = (cliUtil as any).log;
    vConfig.prompt = (cliUtil as any).prompt;

    await doInstallationCodeSigningVerification(config, {plugin, tag}, vConfig);
}

export = timedHook("plugins:preinstall:signing", run);
