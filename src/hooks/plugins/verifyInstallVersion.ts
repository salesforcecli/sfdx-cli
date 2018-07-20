import { compareVersions, isVersion } from '../../versions';
import timedHook from '../timedHook';
import { PreinstallOptions } from './preinstall';

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
const hook = timedHook<'plugins:preinstall'>('plugins:preinstall:version', async function(options) {
    // TODO: hopefully this is temporary until oclif adds a real preinstall hook
    const opts = options as PreinstallOptions;

    const plugin = opts.plugin;
    if (FORCE_PLUGINS.includes(plugin.name) && isVersion(plugin.tag) && compareVersions(plugin.tag.slice(1), MIN_VERSION) < 0) {
        this.error(
            `The ${plugin.name} plugin can only be installed using a specific version when ` +
            `the version is greater than or equal to ${MIN_VERSION}.`
        );
        this.exit(1);
    }
});

export default hook;
