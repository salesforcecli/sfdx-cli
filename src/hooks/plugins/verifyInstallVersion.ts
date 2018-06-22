import { Config } from 'cli-engine-config';
import { compareVersions, isVersion } from '../../versions';
import timedHook from '../timedHook';

const FORCE_PLUGINS = [
    'salesforcedx',
    'salesforce-alm',
    'force-language-services'
];
const MIN_VERSION = '41.2.0';

/**
 * A v6 CLI plugin preinstall hook that checks that the plugin's version is v6-compatible,
 * if it is recognized as a force namespace plugin.
 */
async function run(config: Config, {plugin, tag}: {plugin: string, tag: string}) {
    if (FORCE_PLUGINS.includes(plugin) && isVersion(tag) && compareVersions(tag, MIN_VERSION) < 0) {
        throw new Error(
            `The ${plugin} plugin can only be installed using a specific version when ` +
            `the version is greater than or equal to ${MIN_VERSION}.`
        );
    }
}

export = timedHook('plugins:preinstall:version', run);
