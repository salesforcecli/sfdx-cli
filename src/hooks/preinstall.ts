import * as path from "path";
import { compareVersions } from "../versions";

const PLUGIN = "salesforcedx";
const MIN_VERSION = "41.2.0";

/**
 * A v6 CLI plugin preinstall hook that checks that the plugin's version is v6-compatible,
 * if it is recognized as a force namespace plugin.
 */
function preinstall(config: any, {plugin, tag}: {plugin: any, tag: string}) {
    if (PLUGIN === plugin) {
        if (compareVersions(tag, MIN_VERSION) < 0) {
            throw new Error(
                `The ${PLUGIN} plugin can only be installed as a user plugin using a specific version, ` +
                `greater than or equal to '${MIN_VERSION}'. For example try, ` +
                `'sfdx plugins:install salesforcedx@${MIN_VERSION}' to pin the plugin to the given version.`,
            );
        }
    }
}

export = preinstall;
