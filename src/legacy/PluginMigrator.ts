import * as Debug from 'debug';
import * as fs from 'fs-extra';
import * as path from 'path';
import Lock from 'cli-engine/lib/lock';
import { Config } from 'cli-engine-config';
import { CLI as CliUx } from 'cli-ux';

const debug = Debug('sfdx:plugins:migrate');

export default class PluginMigrator {
    public static run(config: Config) {
        const cliUx = new CliUx();
        if (!config.dataDir) {
            return;
        }
        const userPluginsDir = path.join(config.dataDir, 'plugins');
        const userPluginsPjsonV5Path = path.join(userPluginsDir, 'plugins.json');
        const userPluginsPjsonV6Path = path.join(userPluginsDir, 'package.json');
        return new PluginMigrator(
            config,
            cliUx,
            userPluginsPjsonV5Path,
            userPluginsPjsonV6Path,
            new Lock(config)
        ).run();
    }

    private readonly corePlugins: string[];
    private readonly cliUx: CliUx;
    private readonly userPluginsPjsonV5Path: string;
    private readonly userPluginsPjsonV6Path: string;
    private readonly lock: Lock;

    public constructor(
        config: Config,
        cliUx: CliUx,
        userPluginsPjsonV5Path: string,
        userPluginsPjsonV6Path: string,
        lock: Lock
    ) {
        this.corePlugins = ((config.pjson || {})['cli-engine'] || {}).plugins || [];
        this.cliUx = cliUx;
        this.userPluginsPjsonV5Path = userPluginsPjsonV5Path;
        this.userPluginsPjsonV6Path = userPluginsPjsonV6Path;
        this.lock = lock;
    }

    public async run() {
        // Short circuit quickly without having to acquire the writer lock
        if (fs.existsSync(this.userPluginsPjsonV6Path) || !fs.existsSync(this.userPluginsPjsonV5Path)) {
            debug('nothing to do');
            return;
        }

        const pluginsJson = this.readPluginsJson();
        if (!pluginsJson) {
            return false;
        }

        const downgrade = await this.lock.upgrade();
        try {
            this.migratePlugins(pluginsJson);
        } finally {
            await downgrade();
        }
    }

    public migratePlugins(pluginsJson: any[]) {
        // Prevent two parallel migrations from happening in case of a race
        if (fs.existsSync(this.userPluginsPjsonV6Path)) {
            return;
        }

        debug('migrating %s plugin%s', pluginsJson.length, pluginsJson.length === 1 ? '' : 's');

        if (pluginsJson.length > 0) {
            this.cliUx.warn(new Error('v5 plug-ins found -- Complete your update to v6:'));
            for (const plugin of pluginsJson) {
                this.migratePlugin(plugin.name, plugin.tag);
            }
        }

        // Remove the old v5 plugins file to prevent the migrator from running again
        if (fs.existsSync(this.userPluginsPjsonV5Path)) {
            try {
                debug('removing v5 plugins file');
                fs.removeSync(this.userPluginsPjsonV5Path);
            } catch (err) {
                this.cliUx.error(err);
            }
        }
    }

    private migratePlugin(name: string, tag: string) {
        let message;
        if (tag === 'symlink') {
            message = `${name} -- To re-link, run "sfdx plugins:link <path>"`;
        } else if (this.corePlugins.includes(name)) {
            message = `${name} is now a core plug-in -- From now on, use "sfdx plugins --core" to view its version`;
        } else {
            message = `${name} -- To re-install, run "sfdx plugins:install ${name}${tag ? '@' : ''}${tag}"`;
        }
        this.cliUx.warn(new Error(`${message}`));
    }

    private readPluginsJson() {
        try {
            const plugins = fs.readJsonSync(this.userPluginsPjsonV5Path);
            if (!Array.isArray(plugins)) {
                throw new Error('plugins.json does not contain an array');
            }
            if (plugins.length === 0) {
                return;
            }
            return plugins;
        } catch (err) {
            debug(err.message);
        }
    }
}
