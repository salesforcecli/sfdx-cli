import Analytics from '../analytics';

try {
    const { config, plugin, commandId, time, status } = JSON.parse(process.argv[2]);
    /* tslint:disable-next-line no-floating-promises */
    new Analytics(config).record(plugin, commandId, time, status);
} catch (err) {
    // Do nothing. This prevents throwing an error on the
    // upgrade path. Can remove after all clients are off 6.0.10
}
