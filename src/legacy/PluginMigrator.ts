import { ensureString, isJsonMap, JsonArray, Optional } from '@salesforce/ts-types';
import { color } from 'cli-engine-command/lib/color';
import { Config } from 'cli-engine-config';
import Lock from 'cli-engine/lib/lock';
import { CLI as Ux } from 'cli-ux';
import * as Debug from 'debug';
import * as fs from 'fs-extra';
import * as path from 'path';

const debug = Debug('sfdx:plugins:migrate');

export default class PluginMigrator {
    public static async run(config: Config): Promise<void> {
        const cliUx = new Ux();
        if (!config.dataDir) {
            return;
        }
        const userPluginsDir = path.join(config.dataDir, 'plugins');
        const userPluginsPjsonV5Path = path.join(userPluginsDir, 'plugins.json');
        const userPluginsPjsonV6Path = path.join(userPluginsDir, 'package.json');
        await new PluginMigrator(
            config,
            cliUx,
            userPluginsPjsonV5Path,
            userPluginsPjsonV6Path,
            new Lock(config)
        ).run();
    }

    private readonly corePlugins: string[];

    public constructor(
        config: Config,
        private ux: Ux,
        private userPluginsPjsonV5Path: string,
        private userPluginsPjsonV6Path: string,
        private lock: Lock
    ) {
        this.corePlugins = ((config.pjson || {})['cli-engine'] || {}).plugins || [];
    }

    public async run(): Promise<void> {
        // Short circuit quickly without having to acquire the writer lock
        if (fs.existsSync(this.userPluginsPjsonV6Path) || !fs.existsSync(this.userPluginsPjsonV5Path)) {
            debug('no v5 plugins need migration');
            return;
        }

        const pluginsJson = this.readPluginsJson();
        if (!pluginsJson) {
            debug('no v5 plugins read');
            return;
        }

        const downgrade = await this.lock.upgrade();
        try {
            this.migratePlugins(pluginsJson);
        } finally {
            await downgrade();
        }
    }

    public migratePlugins(pluginsJson: JsonArray): void {
        // Prevent two parallel migrations from happening in case of a race
        if (fs.existsSync(this.userPluginsPjsonV6Path)) {
            debug('migration race detected, nothing left to do');
            return;
        }

        debug('migrating %s plugin%s', pluginsJson.length, pluginsJson.length === 1 ? '' : 's');

        if (pluginsJson.length > 0) {
            if (pluginsJson.some(plugin => isJsonMap(plugin) && !this.corePlugins.includes(ensureString(plugin.name)))) {
                this.ux.warn(color.bold.blue('v5 plug-ins found -- Complete your update to v6:'));
            }
            for (const plugin of pluginsJson) {
                if (isJsonMap(plugin)) {
                    this.migratePlugin(ensureString(plugin.name), ensureString(plugin.tag));
                }
            }
        }

        // Remove the old v5 plugins file to prevent the migrator from running again
        if (fs.existsSync(this.userPluginsPjsonV5Path)) {
            try {
                debug('removing v5 plugins file');
                fs.removeSync(this.userPluginsPjsonV5Path);
            } catch (err) {
                this.ux.error(err);
            }
        }
    }

    private migratePlugin(name: string, tag: string): void {
        let message;
        if (tag === 'symlink') {
            message = `- ${color.bold(name)} -- To re-link, run ${color.green('sfdx plugins:link <path>')}`;
        } else if (this.corePlugins.includes(name)) {
            message = `- ${color.bold(name)} is now a core plug-in -- Use ${color.green('sfdx plugins --core')} to view its version`;
        } else {
            message = `- ${color.bold(name)} -- To re-install, run ${color.green(`sfdx plugins:install ${name}${tag ? '@' : ''}${tag}`)}`;
        }
        this.ux.warn(`${message}`);
    }

    // tslint:disable-next-line:no-any
    private readPluginsJson(): Optional<JsonArray> {
        try {
            debug('reading plugins.json');
            const plugins = fs.readJsonSync(this.userPluginsPjsonV5Path);
            if (!Array.isArray(plugins)) {
                throw new Error('plugins.json does not contain an array');
            }
            if (plugins.length === 0) {
                debug('zero length plugins array read');
                return;
            }
            return plugins;
        } catch (err) {
            debug(err.message);
        }
    }
}
