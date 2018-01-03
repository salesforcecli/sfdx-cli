import { Config } from 'cli-engine-config';
import timedHook from '../../hooks/timedHook';
import * as lazyModules from './index';

function run(config: Config) {
    // Reset the type cache on CLI or plugin updates in case a dependency has changed types
    lazyModules.resetTypeCache();
}

export = timedHook('update:lazy-modules', run);
