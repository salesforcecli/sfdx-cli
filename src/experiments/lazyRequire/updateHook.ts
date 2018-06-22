import { Config } from 'cli-engine-config';
import { resetTypeCache } from '.';
import timedHook from '../../hooks/timedHook';

function run(config: Config): void {
    // Reset the type cache on CLI or plugin updates in case a dependency has changed types
    resetTypeCache();
}

export = timedHook('update:lazy-require', run);
