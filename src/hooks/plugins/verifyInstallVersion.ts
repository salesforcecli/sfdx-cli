import { Config } from 'cli-engine-config';
import { compareVersions } from '../../versions';
import timedHook from '../timedHook';

const FORCE_PLUGINS = [
    'salesforcedx',
    'salesforce-alm',
    'force-language-services'
];
const MIN_VERSION = '41.2.0';
const PRE_RELEASE_TAG = 'pre-release';

/**
 * A v6 CLI plugin preinstall hook that checks that the plugin's version is v6-compatible,
 * if it is recognized as a force namespace plugin.
 */
async function run(config: Config, {plugin, tag}: {plugin: string, tag: string}) {
    if (FORCE_PLUGINS.includes(plugin) && tag !== PRE_RELEASE_TAG) {
        if (compareVersions(tag, MIN_VERSION) < 0) {
            throw new Error(
                `The '${plugin}' plugin can only be installed as a user plugin using a specific version, ` +
                `greater than or equal to '${MIN_VERSION}', or the tag '${PRE_RELEASE_TAG}'. For example try, ` +
                `'sfdx plugins:install salesforcedx@${MIN_VERSION}' to pin the plugin to the given version.`
            );
        }
    }
}

export = timedHook('plugins:preinstall:version', run);
