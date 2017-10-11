import { Config } from 'cli-engine-config';
import PluginMigrator from '../../legacy/PluginMigrator';
import timedHook from '../timedHook';

async function run(config: Config) {
    return await PluginMigrator.run(config);
}

export = timedHook('init:plugins:migrate', run);
