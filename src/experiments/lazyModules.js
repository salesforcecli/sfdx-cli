/**
 * An override of the Node.js Module._load mechanism that replaces loaded modules with
 * JavaScript proxy objects.  These proxies defer the actual loading of required modules
 * until some aspect of the module is actually used.
 *
 * TODO:
 * - eliminate all "outages" modules by improving the proxy
 * - typescript-ify this
 *
 * References:
 * - http://fredkschott.com/post/2014/06/require-and-the-module-system/
 * - http://2ality.com/2014/12/es6-proxies.html
 * - https://hacks.mozilla.org/2015/07/es6-in-depth-proxies-and-reflect/
 * - http://exploringjs.com/es6/ch_proxies.html
 * - https://github.com/tvcutsem/harmony-reflect/blob/master/doc/traps.md
 * - https://github.com/getify/You-Dont-Know-JS/blob/master/es6%20%26%20beyond/ch7.md
 * - http://exploringjs.com/es6/ch_proxies.html#_pitfall-not-all-objects-can-be-wrapped-transparently-by-proxies
 * - https://esdiscuss.org/topic/calling-tostring-on-function-proxy-throws-typeerror-exception
 * - https://gist.github.com/tvcutsem/6536442
 * - http://soft.vub.ac.be/~tvcutsem/invokedynamic/js-membranes
 */

// Disable eslint until converted to typescript or removed
/* eslint-disable */

'use strict';

const NamedError = require('../util/NamedError').NamedError;
const env = require('../util/env').default;

// Loads a module using the original module loader if the module is undefined
const loadIfNeeded = (mod, realLoad, request, parent, isMain) => {
    if (mod === undefined) {
        trace('[lazy]', request);
        mod = realLoad(request, parent, isMain);
    }
    return mod;
}

// Reuse proxy objects rather than creating a new one for each require call
let proxyCache;

// Wraps the original module loading function with the lazy proxy functionality
const makeLazy = (realLoad) => {
    // Modules from the excludes list will disable lazy loading for themselves and
    // an require calls made within their require subtrees.
    let disabled = false;

    // The lazy loading wrapper
    return (request, parent, isMain) => {
        // Skip the main module, since there's not point to proxying it
        if (isMain) {
            trace('[main]', request);
            return realLoad(request, parent, isMain);
        }

        // Skip modules when a subtree has been disabled via excludes matches
        if (disabled) {
            trace('[skip]', request);
            return realLoad(request, parent, isMain);
        }

        // Test for exclusions and disable require in that subtree when there's a match
        if (exports._excludesRe.test(request)) {
            try {
                disabled = true;
                trace('[real]', request);
                return realLoad(request, parent, isMain);
            } finally {
                disabled = false;
            }
        }

        // Return from cache if it exists rather than creating a new proxy
        let filename = Module._resolveFilename(request, parent, isMain);
        const cachedProxy = proxyCache[filename];
        if (cachedProxy) {
            return cachedProxy;
        }

        // Create a new lazy loading module proxy
        let mod;
        const proxy = new Proxy(function () {}, {
            apply: (target, thisArg, argumentsList) => {
                mod = loadIfNeeded(mod, realLoad, request, parent, isMain);
                try {
                    if (typeof mod !== 'function') {
                        throw new NamedError('LazyModuleProxyTypeError', `Module ${request} is not a function: possible typeof error`);
                    }
                    return Reflect.apply(mod, thisArg, argumentsList);
                } catch (err) {
                    trace('error:apply', request, mod, err);
                    throw err;
                }
            },

            construct: (target, argumentsList, newTarget) => {
                mod = loadIfNeeded(mod, realLoad, request, parent, isMain);
                try {
                    if (typeof mod !== 'function') {
                        throw new NamedError('LazyModuleProxyTypeError', `Module ${request} is not a constructor: possible typeof error`);
                    }
                    return Reflect.construct(mod, argumentsList, newTarget);
                } catch (err) {
                    trace('error:construct', request, mod, err);
                    throw err;
                }
            },

            defineProperty: (target, propertyKey, attributes) => {
                mod = loadIfNeeded(mod, realLoad, request, parent, isMain);
                try {
                    return Reflect.defineProperty(mod, propertyKey, attributes);
                } catch (err) {
                    trace('error:defineProperty', request, mod, err);
                    throw err;
                }
            },

            deleteProperty: (target, propertyKey) => {
                mod = loadIfNeeded(mod, realLoad, request, parent, isMain);
                try {
                    let modDesc = Reflect.getOwnPropertyDescriptor(mod, propertyKey);
                    if (modDesc && !modDesc.configurable) {
                        return false;
                    }
                    return Reflect.deleteProperty(mod, propertyKey);
                } catch (err) {
                    trace('error:deleteProperty', request, mod, propertyKey, err);
                    throw err;
                }
            },

            get: (target, propertyKey, receiver) => {
                mod = loadIfNeeded(mod, realLoad, request, parent, isMain);
                if (propertyKey === 'toString') {
                    // The JS proxy spec has an annoying gap that causes toString on proxied functions
                    // to throw an error, so we override the proxy's built-in toString function
                    // with our own as a workaround. To see the root issue, try the following:
                    //     > node -e 'new Proxy(function () {}, {}).toString()'
                    return (...args) => mod.toString(...args);
                }
                if (mod[propertyKey] !== undefined) {
                    return mod[propertyKey];
                }
                // Invariant constraints require that we return a value for any non-configurable, non-writable
                // property that exists on the target, so the following satisfies that constraint should there not
                // be an equivalent value on the target module; this can happen if the proxy target, which is always
                // a function, is asked for a value for its `arguments` or `caller` properties, which are discoverable
                // dynamically through the use of Object.getOwnPropertyNames, for example
                const targetDesc = Object.getOwnPropertyDescriptor(target, propertyKey);
                if (targetDesc && !targetDesc.configurable && !targetDesc.writable) {
                    return target[propertyKey];
                }
            },

            getOwnPropertyDescriptor: (target, propertyKey) => {
                mod = loadIfNeeded(mod, realLoad, request, parent, isMain);
                const targetDesc = Object.getOwnPropertyDescriptor(target, propertyKey);
                let modDesc;
                try {
                    modDesc = typeof mod === 'string' ? targetDesc : Reflect.getOwnPropertyDescriptor(mod, propertyKey);
                } catch (err) {
                    trace('error:getOwnPropertyDescriptor', request, mod, propertyKey, err);
                    throw err;
                }
                if (targetDesc && !modDesc) {
                    return targetDesc;
                }
                if (!targetDesc && modDesc && !modDesc.configurable) {
                    modDesc.configurable = true;
                    return modDesc;
                }
                if (targetDesc && modDesc && modDesc.configurable != targetDesc.configurable) {
                    modDesc.configurable = targetDesc.configurable;
                }
                return modDesc;
            },

            getPrototypeOf: (target) => {
                mod = loadIfNeeded(mod, realLoad, request, parent, isMain);
                try {
                    return Object.getPrototypeOf(mod);
                } catch (err) {
                    getPrototypeOf('error:defineProperty', request, mod, err);
                    throw err;
                }
            },

            has: (target, propertyKey) => {
                mod = loadIfNeeded(mod, realLoad, request, parent, isMain);
                try {
                    return Reflect.has(mod, propertyKey);
                } catch (err) {
                    trace('error:has', request, mod, propertyKey, err);
                    throw err;
                }
            },

            isExtensible: (target) => {
                mod = loadIfNeeded(mod, realLoad, request, parent, isMain);
                try {
                    const isExtensible = Reflect.isExtensible(mod);
                    if (!isExtensible && Object.isExtensible(target)) {
                        Object.freeze(target);
                    }
                    return isExtensible;
                } catch (err) {
                    trace('error:isExtensible', request, mod, err);
                    throw err;
                }
            },

            ownKeys: (target) => {
                mod = loadIfNeeded(mod, realLoad, request, parent, isMain);
                // Target keys need to filter out configurable properties
                const targetKeys = Object.getOwnPropertyNames(target)
                    .filter((k) => !Object.getOwnPropertyDescriptor(target, k).configurable);
                if (typeof mod === 'string') {
                    // You can't reflect own keys from a string, and its property names are ArrayLike,
                    // which don't tend to seem to make sense to forward in this context, but I'm not
                    // 100% sure on that point
                    return targetKeys;
                }
                try {
                    // Due to the potential for type mismatches between the target and module,
                    // we need to make sure the target keys are included in this result in order
                    // to satisfy possible property invariant constraint checks; doing so can
                    // in turn foil the ability to freeze the module through the proxy, however,
                    // but the workaround to that issue is for now to not allow freezing across the
                    // proxy membrane, which is hopefully a very rare need anyway
                    const modKeys = Reflect.ownKeys(mod);
                    return Array.from(new Set(modKeys.concat(targetKeys)));
                } catch (err) {
                    trace('error:ownKeys', request, mod, err);
                    throw err;
                }
            },

            preventExtensions: (target) => {
                // See notes in ownKeys, but in short, freezing modules across the proxy membrane is
                // fraught with peril due to type mismatches, and I have not found a way to make it work
                // while not either breaking or severely complicating other use cases; since it's rare,
                // we just don't support it at this time
                throw new TypeError(`Proxied modules cannot properly support freezing; add '${request}' to the excludes list`);
            },

            set: (target, propertyKey, value, receiver) => {
                mod = loadIfNeeded(mod, realLoad, request, parent, isMain);
                try {
                    return Reflect.set(mod, propertyKey, value, receiver);
                } catch (err) {
                    trace('error:set', request, mod, propertyKey, err);
                    throw err;
                }
            },

            setPrototypeOf: (target, prototype) => {
                mod = loadIfNeeded(mod, realLoad, request, parent, isMain);
                try {
                    return Reflect.setPrototypeOf(mod, prototype);
                } catch (err) {
                    trace('error:setPrototypeOf', request, mod, err);
                    throw err;
                }
            }
        });

        proxyCache[filename] = proxy;

        return proxy;
    };
};

// exclusions
exports._excludesRe = (() => {
    // Exclude Node SDK builtin modules, which already load hella quick; some of them,
    // like `os`, have intractable incompatibility issues with proxying anyway...
    const builtins = Object.keys(process.binding('natives'))
        .filter((el) => !/^_|^internal|\//.test(el));

    // Some modules are not worth proxying, as they will be used in most runs of the CLI,
    // so proxying them can only slow things down (not by much, but why incur the extra
    // overhead or risk?). This list excludes such commonly required modules
    //
    // NOTE: only add items to this list if they are known to work with the proxy first;
    // that is, anything that is known to not work with the proxy should be listed in
    // `snowflakes` to ensure we understand where the proxy still needs work
    const commons = [
        '.+\\.json', // all .json requests
        'debug'
    ];

    // `snowflakes` are modules that do obnoxious or unusual things that are hard to support in the
    // lazy proxy, so they are captured here for later addition to the excludes list; ideally
    // we will improve the proxy traps to reduce this set to zero; commands known to exhibit
    // the error follow in comments
    const snowflakes = [
        // `user-home` is a string module that gets used in type-checked calls to `path`...
        // it's possible there's no fix for this scenario since the lazy proxies always
        // yield a typeof 'function'; it is required by yeomen
        'user-home',            // force:project:create
        // `joi` is sort of a type-checking object schema library that represents different types
        // in individual module files, and then performs dynamic dispatch on those loaded types
        // through typeof checks -- as with `user-home`, the module proxies erroneously
        // return `typeof m === 'function'`, which causes this library to break
        'joi',                  // force:auth:jwt:grant
    ];

    // `outages` are modules that are known to have problems with the lazy proxy, but for which
    // investigations and fixes (or classifications as snowflakes) have not yet been performed
    const outages = [
        'jsforce',              // force:org:create
        // `lodash` craziness -- not entirely clear why this one blows up yet, but it's
        // doing some pretty wacky stuff; it is required downstream from xmlbuilder
        '\\./_defineProperty',  // force:source:pull
    ];

    // The complete set of modules for which lazy loading should be disabled
    const excludes = exports.excludes = Array.from(new Set(
        builtins.concat(commons).concat(snowflakes).concat(outages)
    ));

    // A regex to match module exclusions
    return new RegExp(`^(?:${excludes.join('|')})\$`);
})();

// Verbose debugging stub
let trace = () => {};

// Initialize
const Module = require('module');
const debug = require('debug')('sfdx:lazy-modules');

// Overwrite Module._load with the lazy loading feature
exports.enable = function () {
    let origLoad = Module._load;
    Module._load = makeLazy(origLoad);
    Module._load._origLoad = origLoad;
    proxyCache = {};
    debug('lazy module loading enabled');
};

// Restore Module._load to disable lazy loading
exports.disable = function () {
    if (Module._load._origLoad) {
        Module._load = Module._load._origLoad;
        proxyCache = {};
    }
    debug('lazy module loading disabled');
};

// Check if the lazy loader is enabled
exports.isEnabled = function () {
    return !!Module._load._origLoad;
};

// Require a dark feature envar to enable this experiment
if (env.getBoolean('SFDX_LAZY_LOAD_MODULES')) {
    exports.enable();
    if (env.getBoolean('SFDX_LAZY_LOAD_MODULES_TRACE')) {
        trace = debug;
    }
}
