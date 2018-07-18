// TODO: commented out until oclif supports the `plugins:preinstall` hook?
// import { Config } from '@oclif/config';
// import { compareVersions, isVersion } from '../../versions';
import timedHook from '../timedHook';

// const FORCE_PLUGINS = [
//     'salesforcedx',
//     'salesforce-alm',
//     'force-language-services'
// ];

// const MIN_VERSION = '41.2.0';

/**
 * A v6 CLI plugin preinstall hook that checks that the plugin's version is v6-compatible,
 * if it is recognized as a force namespace plugin.
 */
const hook = timedHook<'plugins:preinstall'>('plugins:preinstall:version', async options => {
    console.log('TODO: implement plugins:preinstall:version hook');
    // if (FORCE_PLUGINS.includes(options.plugin) && isVersion(options.tag) && compareVersions(options.tag, MIN_VERSION) < 0) {
    //     throw new Error(
    //         `The ${options.plugin} plugin can only be installed using a specific version when ` +
    //         `the version is greater than or equal to ${MIN_VERSION}.`
    //     );
    // }
});

export default hook;
