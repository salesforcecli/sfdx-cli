/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { IConfig } from '@oclif/config';
import LazyRequire from '@salesforce/lazy-require';
import path = require('path');

let lazyRequire: LazyRequire;

/**
 * Start lazy requiring type-compatible modules.
 */
export async function start(config: IConfig): Promise<void> {
    (await getOrCreate(config)).start();
}

/**
 * Return the lazy require type cache if it has been initialized.
 */
export async function resetTypeCache(config: IConfig): Promise<void> {
    (await getOrCreate(config)).resetTypeCache();
}

function getOrCreate(config: IConfig): LazyRequire {
    if (lazyRequire) {
        return lazyRequire;
    }
    const typeCacheFile = path.join(config.cacheDir, 'module-types.json');
    return lazyRequire = LazyRequire.create(typeCacheFile);
}
