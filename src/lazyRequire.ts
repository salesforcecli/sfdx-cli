/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { IConfig } from '@oclif/config';
import LazyRequire from '@salesforce/lazy-require';
import * as path from 'path';

export let lazyRequire: LazyRequire;

/**
 * Start lazy requiring type-compatible modules.
 */
export function start(config: IConfig, create = LazyRequire.create): void {
    getOrCreate(config, create).start();
}

/**
 * Return the lazy require type cache if it has been initialized.
 */
export function resetTypeCache(config: IConfig, create = LazyRequire.create): void {
    getOrCreate(config, create).resetTypeCache();
}

function getOrCreate(config: IConfig, create: typeof LazyRequire.create): LazyRequire {
    if (lazyRequire) {
        return lazyRequire;
    }
    const typeCacheFile = path.join(config.cacheDir, 'module-types.json');
    return lazyRequire = create(typeCacheFile);
}
