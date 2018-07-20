import * as cp from 'child_process';
import * as Debug from 'debug';
import * as fs from 'fs';
import * as path from 'path';
import timedHook from './timedHook';

const debug = Debug('sfdx:analytics');

const hook = timedHook<'prerun'>('prerun:log-analytics', async options => {
    try {
        const start = Date.now();
        const command = options.Command;

        // Only log usage for commands with plugins
        if (command && command.plugin) {
            debug('setting up exit handler');
            process.on('exit', status => {
                const logFile = path.join(options.config.cacheDir as string, 'analytics.log');
                debug(`using ${logFile} for usage error logging`);

                const fd = fs.openSync(logFile, 'a');

                cp.spawn(process.argv[0], [
                    path.join(__dirname, '../processes/logUsage'),
                    JSON.stringify({
                        // TODO
                        // config: options.config,
                        plugin: command.plugin ? { name: command.plugin.name, version: command.plugin.version } : undefined,
                        commandId: command.id,
                        time: Date.now() - start,
                        status
                    })
                ], {
                    detached: !options.config.windows,
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
});

export default hook;
