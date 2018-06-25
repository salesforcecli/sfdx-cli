import { AnyDictionary } from '@salesforce/core';
import * as cp from 'child_process';
import { Config } from 'cli-engine-config';
import * as Debug from 'debug';
import * as fs from 'fs';
import * as path from 'path';
import timedHook from './timedHook';

const debug = Debug('sfdx:analytics');

function run(config: Config, opts: AnyDictionary) {
    try {
        const start = Date.now();
        const command = opts.Command;

        // Only log usage for commands with plugins
        if (command && command.plugin) {
            debug('setting up exit handler');
            process.on('exit', status => {
                const logFile = path.join(config.cacheDir as string, 'analytics.log');
                debug(`using ${logFile} for usage error logging`);

                const fd = fs.openSync(logFile, 'a');

                cp.spawn(process.argv[0], [
                    path.join(__dirname, '../processes/logUsage'),
                    JSON.stringify({
                        config,
                        plugin: command.plugin ? { name: command.plugin.name, version: command.plugin.version } : undefined,
                        commandId: command.id,
                        time: Date.now() - start,
                        status
                    })
                ], {
                    detached: !config.windows,
                    stdio: ['ignore', fd, fd]
                }).unref();
                debug(`spawned usage "${process.argv[0]} ${path.join(__dirname, '../processes/logUsage')}"`);
            });
        } else {
            debug('no plugin found for analytics');
        }
    } catch (err) {
        debug(`error tracking usage: ${err.message}`);
    }
}

export = timedHook('analytics', run);
