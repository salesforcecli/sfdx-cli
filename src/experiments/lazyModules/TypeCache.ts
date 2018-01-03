import fs = require('fs');

import { debug, trace } from './debug';

export default class TypeCache {
    private hasChanged = false;

    constructor(
        private fsLib: typeof fs,
        private cacheFile: string,
        private values: {[key: string]: string} = {}
    ) {
    }

    public load() {
        let json;
        try {
            debug('loading type cache from %s', this.cacheFile);
            json = this.fsLib.readFileSync(this.cacheFile).toString('utf8');
            debug('loaded type cache');
        } catch (err) {
            if (err.code === 'ENOENT') {
                debug('type cache not found');
                return;
            }
            throw err;
        }
        try {
            debug('parsing type cache');
            const values = JSON.parse(json);
            this.values = Object.assign(this.values, values);
            debug('parsed type cache');
        } catch (err) {
            debug('removing corrupted type cache');
            this.fsLib.unlinkSync(this.cacheFile);
        }
    }

    public save() {
        debug('saving type cache to %s', this.cacheFile);
        if (!this.hasChanged) {
            debug('no changes to save');
            return;
        }
        const json = JSON.stringify(this.values);
        this.fsLib.writeFileSync(this.cacheFile, json);
        debug('saved type cache');
    }

    public reset() {
        try {
            this.values = {};
            this.fsLib.unlinkSync(this.cacheFile);
        } catch (err) {
            debug(err.message);
        }
        debug('type cache reset');
    }

    public hasType(filename) {
        return !!this.values[filename];
    }

    public hasProxiableType(filename) {
        const type = this.values[filename];
        return type === 'function' || type === 'object';
    }

    public getType(filename) {
        return this.values[filename];
    }

    public getTargetForProxiableType(filename) {
        const type = this.getType(filename);
        switch (type) {
            // MUST return a function expression, not an arrow function
            case 'function': return function() {}; // tslint:disable-line:only-arrow-functions
            case 'object': return {};
            default: throw new Error(`Unexpected module proxy target type: ${type}`);
        }
    }

    public setTypeIfUnknown(filename, type) {
        if (this.values[filename]) {
            return;
        }
        this.values[filename] = type;
        this.hasChanged = true;
    }

    public clearType(filename) {
        delete this.values[filename];
        this.hasChanged = true;
    }
}
