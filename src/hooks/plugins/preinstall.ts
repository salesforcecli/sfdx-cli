/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Config } from '@oclif/config';
import timedHook from '../timedHook';

// TODO: hopefully this whole file is only temporary, to be replaced by a real preinstall hook in oclif

export interface PreinstallOptions {
    plugin: {
        name: string,
        tag: string
    };
    config: Config;
}

const hook = timedHook<'init'>('init:plugins:preinstall', async function(options) {
    if (options.id === 'plugins:install' && options.argv.length > 0) {
        let plugin = options.argv[0];
        const scoped = plugin.includes('/');
        if (scoped) plugin = plugin.slice(1);
        const [name, tag] = plugin.split('@');
        await this.config.runHook('plugins:preinstall', {
            plugin: {
                name: `${scoped ? '@' : ''}${name}`,
                tag: tag || ''
            },
            config: options.config
        });
    }
});

export default hook;
