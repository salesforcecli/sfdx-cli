import { resetTypeCache } from '../lazyRequire';
import timedHook from './timedHook';

const hook = timedHook<'update'>('update:lazy-require', async options => {
    // Reset the type cache on CLI or plugin updates in case a dependency has changed types
    await resetTypeCache(options.config);
});

export default hook;
