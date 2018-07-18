import PluginMigrator from '../../legacy/PluginMigrator';
import timedHook from '../timedHook';

const hook = timedHook<'init'>('init:plugins:migrate', async options => {
    const corePlugins = options.config.plugins.filter(plugin => plugin.type === 'core');
    await PluginMigrator.run(corePlugins, options.config.dataDir);
});

export default hook;
