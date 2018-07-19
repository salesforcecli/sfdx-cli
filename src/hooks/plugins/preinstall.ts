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

// TODO: for some reason oclif seems to fire hooks twice, so this ensures we run this hook once
let hasFired = false;

const hook = timedHook<'init'>('init:plugins:preinstall', async function(options) {
    if (options.id === 'plugins:install' && options.argv.length > 0) {
        if (hasFired) return;
        hasFired = true;
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
