/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { resetTypeCache } from '../lazyRequire';
import timedHook from './timedHook';

const hook = timedHook<'update'>('update:lazy-require', async options => {
    // Reset the type cache on CLI or plugin updates in case a dependency has changed types
    await resetTypeCache(options.config);
});

export default hook;
