import * as path from "path";
import { compareVersions } from "../versions";

import { InstallationVerification, NpmMeta } from "../codeSigning/installationVerification";
import { _ } from "lodash";
import heroku = require("heroku-cli-util");
import { NamedError } from "../util/NamedError";

const PLUGIN = "salesforcedx";
const MIN_VERSION = "41.2.0";

/**
 * A v6 CLI plugin preinstall hook that checks that the plugin's version is v6-compatible,
 * if it is recognized as a force namespace plugin.
 */
async function preinstall(config: any, {plugin, tag}: {plugin: any, tag: string}) {
    if (PLUGIN === plugin) {
        if (compareVersions(tag, MIN_VERSION) < 0) {
            throw new Error(
                `The ${PLUGIN} plugin can only be installed as a user plugin using a specific version, ` +
                `greater than or equal to '${MIN_VERSION}'. For example try, ` +
                `'sfdx plugins:install salesforcedx@${MIN_VERSION}' to pin the plugin to the given version.`,
            );
        }
    }

    const verification = new InstallationVerification().setPluginName(plugin).setCliEngineConfig(config);

    try {
        const meta = await verification.verify();
        if (!meta.verified) {
            const _continue = await heroku.prompt("This plugin is not provided by salesforce and it's authenticity cannot be verified? Continue y/n?");
            switch (_.toLower(_continue)) {
                case "y":
                    return;
                default:
                    throw new NamedError("CanceledByUser", "The plugin installation has been cancel by the user.");
            }
        }

        console.log(`Successfully validated signature for ${plugin}`);
    } catch (err) {
        console.error(`ERROR: ${err.message}`);

    }
}

export = preinstall;
