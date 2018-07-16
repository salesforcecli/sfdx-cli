import { AnyDictionary } from '@salesforce/ts-json';
import { Config } from 'cli-engine-config';
import * as fs from 'fs-extra';
import * as path from 'path';

interface AnalyticsJSONCommand {
    command: string;
    version: string | undefined;
    plugin: string;
    plugin_version: string;
    os: string | undefined;
    shell: string | undefined;
    language: string;
    valid: true;
    runtime: number;
    status: number;
}

interface AnalyticsJSON {
    schema: 1;
    commands: AnalyticsJSONCommand[];
}

export default class AnalyticsCommand {
    private config: Config;

    constructor(config: Config) {
        this.config = config;
    }

    get analyticsPath(): string {
        return path.join(this.config.cacheDir as string, 'analytics.json');
    }

    public async record(plugin: AnyDictionary | undefined, commandId: string, runtime: number, status: number): Promise<void> {
        if (!plugin) {
            return;
        }

        const analyticsJSON = await this.readJSON();

        analyticsJSON.commands.push({
            command: commandId,
            language: 'node',
            os: this.config.platform,
            plugin: plugin && plugin.name,
            plugin_version: plugin && plugin.version,
            shell: this.config.shell,
            valid: true,
            version: this.config.version,
            runtime,
            status
        });

        await this.writeJSON(analyticsJSON);
    }

    public async clear(): Promise<void> {
        await this.writeJSON(this.initialAnalyticsJSON());
    }

    public async readJSON(): Promise<AnalyticsJSON> {
        try {
            const analytics = await fs.readJSON(this.analyticsPath);
            analytics.commands = analytics.commands || [];
            return analytics;
        } catch (err) {
            if (err.code !== 'ENOENT') {
                throw err;
            }
            return this.initialAnalyticsJSON();
        }
    }

    private initialAnalyticsJSON(): AnalyticsJSON {
        return {
            commands: [],
            schema: 1
        };
    }

    private async writeJSON(analyticsJSON: AnalyticsJSON): Promise<void> {
        await fs.outputJson(this.analyticsPath, analyticsJSON);
    }
}
