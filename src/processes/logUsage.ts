
import Analytics from '../analytics';

process.on('message', ({ config, plugin, commandId, time, status }) => {
    new Analytics(config).record(plugin, commandId, time, status).catch(console.error);
});
