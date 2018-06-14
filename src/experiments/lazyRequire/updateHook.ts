import { Config } from 'cli-engine-config';
import timedHook from '../../hooks/timedHook';
import { resetTypeCache } from '.';

function run(config: Config) {
    // Reset the type cache on CLI or plugin updates in case a dependency has changed types
    resetTypeCache();
}

export = timedHook('update:lazy-require', run);
