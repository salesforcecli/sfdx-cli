/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Hook } from '@oclif/config';
import { compareVersions, isVersion } from '../versions';

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
const hook: Hook.PluginsPreinstall = async function(options) {
    const plugin = options.plugin;
    if (FORCE_PLUGINS.includes(plugin.name) && isVersion(plugin.tag) && compareVersions(plugin.tag, MIN_VERSION) < 0) {
        this.error(
            `The ${plugin.name} plugin can only be installed using a specific version when ` +
            `the version is greater than or equal to ${MIN_VERSION}.`
        );
    }
};

export default hook;
