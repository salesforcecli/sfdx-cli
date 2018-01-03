import Module = require('module');
import path = require('path');
import fs = require('fs');
import Debug = require('debug');
import { buildConfig, Config } from 'cli-engine-config';

import LazyModules from './LazyModules';
import TypeCache from './TypeCache';

const pjson = require('../../../package.json'); // tslint:disable-line no-var-requires
const cacheDir = buildConfig({bin: pjson['cli-engine'].bin}).cacheDir!;
const typeCacheFile = path.join(cacheDir, 'module-types.json');

export const typeCache = new TypeCache(fs, typeCacheFile);

const lazyModules = new LazyModules(cacheDir, typeCache, Module as any);

/**
 * Start lazy loading type-compatible modules.
 */
export function start() {
    if (lazyModules.isEnabled()) {
        return;
    }
    typeCache.load();
    process.on('exit', () => typeCache.save());
    lazyModules.enable();
}

/**
 * Reset the current type cache data and file store.
 */
export function resetTypeCache() {
    typeCache.reset();
}
