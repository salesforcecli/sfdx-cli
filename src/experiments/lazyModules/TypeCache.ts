import fs = require('fs');

import { NamedError } from '../../util/NamedError';
import { debug, trace } from './debug';

export default class TypeCache {
    private changed = false;

    constructor(
        private fsLib: typeof fs,
        private cacheFile: string,
        private values: { [key: string]: string } = {}
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
                return false;
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
            return false;
        }
        return true;
    }

    public save() {
        debug('saving type cache to %s', this.cacheFile);
        if (!this.changed) {
            debug('no changes to save');
            return false;
        }
        const json = JSON.stringify(this.values);
        try {
            this.fsLib.writeFileSync(this.cacheFile, json);
        } catch (err) {
            debug(err.message);
            return false;
        }
        debug('saved type cache');
        return true;
    }

    public reset() {
        try {
            this.values = {};
            this.fsLib.unlinkSync(this.cacheFile);
        } catch (err) {
            debug(err.message);
            return false;
        }
        debug('type cache reset');
        return true;
    }

    public hasChanged() {
        return this.changed;
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
            case 'function': return function () { }; // tslint:disable-line:only-arrow-functions
            case 'object': return {};
            default: throw new NamedError('LazyModuleProxyTypeError', `Unexpected module proxy target type: ${type}`);
        }
    }

    public setType(filename, type) {
        if (this.values[filename] === type) {
            return false;
        } else if (this.values[filename]) {
            trace('module type change: %s from %s to %s', filename, this.values[filename], type);
        }
        this.values[filename] = type;
        this.changed = true;
        return true;
    }

    public clearType(filename) {
        if (this.values[filename]) {
            delete this.values[filename];
            this.changed = true;
            return true;
        }
        return false;
    }
}
