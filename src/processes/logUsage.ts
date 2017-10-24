
import Analytics from '../analytics';

const { config, plugin, commandId, time, status } = JSON.parse(process.argv[2]);

new Analytics(config).record(plugin, commandId, time, status);
