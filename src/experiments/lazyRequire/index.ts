import LazyRequire from '@salesforce/lazy-require';
import { buildConfig } from 'cli-engine-config';
import path = require('path');

let lazyRequire: LazyRequire;

/**
 * Start lazy requiring type-compatible modules.
 */
export function start(): void {
    getOrCreate().start();
}

/**
 * Return the lazy require type cache if it has been initialized.
 */
export function resetTypeCache(): void {
    getOrCreate().resetTypeCache();
}

function getOrCreate(): LazyRequire {
    if (lazyRequire) {
        return lazyRequire;
    }
    const pjson = require('../../../package.json'); // tslint:disable-line no-var-requires
    const cacheDir = buildConfig({ bin: pjson['cli-engine'].bin }).cacheDir!;
    const typeCacheFile = path.join(cacheDir, 'module-types.json');
    return lazyRequire = LazyRequire.create(typeCacheFile);
}
