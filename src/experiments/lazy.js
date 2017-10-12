/**
 * An override of the Node.js Module._load mechanism that replaces loaded modules with
 * JavaScript proxy objects.  These proxies defer the actual loading of required modules
 * until some aspect of the module is actually used.
 *
 * TODO:
 * - eliminate all "snowflake" modules by improving the proxy
 * - try replacing all uses of Reflect.* with Object.* counterparts or direct mod
 *   manipulation, as it may in theory be able to reduce complexity and corner cases
 *   implemented in the proxy traps
 * - typescript-ify this file?
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

// Loads a module using the original module loader if the module is undefined
const loadIfNeeded = (mod, load, request, parent, isMain) => {
    if (mod === undefined) {
        trace('[lazy]', request);
        return load(request, parent, isMain);
    }
    return mod;
}

// Wraps the original module loading function with the lazy proxy functionality
const makeLazy = (load) => {
    // Modules from the excludes list will disable lazy loading for themselves and
    // an require calls made within their require subtrees.
    let disabled = false;

    // The lazy loading wrapper
    return (request, parent, isMain) => {
        if (disabled) {
            trace('[immediate]', request);
            return load(request, parent, isMain);
        }
        if (excludes.includes(request)) {
            try {
                disabled = true;
                trace('[immediate]', request);
                return load(request, parent, isMain);
            } finally {
                disabled = false;
            }
        }

        let mod;
        return new Proxy(function () {}, {
            apply: (target, thisArg, argumentsList) => {
                mod = loadIfNeeded(mod, load, request, parent, isMain);
                try {
                    return Reflect.apply(mod, thisArg, argumentsList);
                } catch (err) {
                    trace('error:apply', request, mod, err);
                    throw err;
                }
            },
            construct: (target, argumentsList, newTarget) => {
                mod = loadIfNeeded(mod, load, request, parent, isMain);
                try {
                    return Reflect.construct(mod, argumentsList, newTarget);
                } catch (err) {
                    trace('error:construct', request, mod, err);
                    throw err;
                }
            },
            defineProperty: (target, propertyKey, attributes) => {
                mod = loadIfNeeded(mod, load, request, parent, isMain);
                const desc = Object.getOwnPropertyDescriptor(mod);
                if (desc && !desc.configurable) {
                    return false;
                }
                try {
                    return Reflect.defineProperty(mod, propertyKey, attributes);
                } catch (err) {
                    trace('error:defineProperty', request, mod, err);
                    throw err;
                }
            },
            deleteProperty: (target, propertyKey) => {
                mod = loadIfNeeded(mod, load, request, parent, isMain);
                try {
                    return Reflect.deleteProperty(mod, propertyKey);
                } catch (err) {
                    trace('error:deleteProperty', request, mod, propertyKey, err);
                    throw err;
                }
            },
            get: (target, propertyKey, receiver) => {
                mod = loadIfNeeded(mod, load, request, parent, isMain);
                if (propertyKey === 'toString') {
                    // The JS proxy spec has an annoying gap that causes toString on proxied functions
                    // to throw an error, so we override the proxy's built-in toString function
                    // with our own as a workaround. To see the root issue, try the following:
                    //     > node -e 'new Proxy(function () {}, {}).toString()'
                    return (...args) => mod.toString(...args);
                }
                const targetDesc = Object.getOwnPropertyDescriptor(target, propertyKey);
                if (targetDesc && !targetDesc.configurable && !targetDesc.writable) {
                    return target[propertyKey];
                }
                return mod[propertyKey];
            },
            getOwnPropertyDescriptor: (target, propertyKey) => {
                mod = loadIfNeeded(mod, load, request, parent, isMain);
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
                if (!targetDesc && modDesc) {
                    modDesc.configurable = true;
                    return modDesc;
                }
                if (targetDesc && modDesc) {
                    modDesc.configurable = targetDesc.configurable;
                }
                return modDesc;
            },
            getPrototypeOf: (target) => {
                mod = loadIfNeeded(mod, load, request, parent, isMain);
                try {
                    return Object.getPrototypeOf(mod);
                    // return typeof mod === 'string' ? Object.getPrototypeOf(target) : Reflect.getPrototypeOf(mod);
                } catch (err) {
                    getPrototypeOf('error:defineProperty', request, mod, err);
                    throw err;
                }
            },
            has: (target, propertyKey) => {
                mod = loadIfNeeded(mod, load, request, parent, isMain);
                try {
                    return Reflect.has(mod, propertyKey);
                } catch (err) {
                    trace('error:has', request, mod, propertyKey, err);
                    throw err;
                }
            },
            isExtensible: (target) => {
                mod = loadIfNeeded(mod, load, request, parent, isMain);
                try {
                    return Reflect.isExtensible(mod);
                } catch (err) {
                    trace('error:isExtensible', request, mod, err);
                    throw err;
                }
            },
            ownKeys: (target) => {
                mod = loadIfNeeded(mod, load, request, parent, isMain);
                const targetKeys = Object.getOwnPropertyNames(target)
                    .filter((k) => !Object.getOwnPropertyDescriptor(target, k).configurable);
                if (typeof mod === 'string') {
                    return targetKeys;
                }
                try {
                    return Array.from(new Set(Reflect.ownKeys(mod).concat(targetKeys)));
                } catch (err) {
                    trace('error:ownKeys', request, mod, err);
                    throw err;
                }
            },
            preventExtensions: (target) => {
                mod = loadIfNeeded(mod, load, request, parent, isMain);
                try {
                    return Reflect.preventExtensions(mod);
                } catch (err) {
                    trace('error:preventExtensions', request, mod, err);
                    throw err;
                }
            },
            set: (target, propertyKey, value, receiver) => {
                mod = loadIfNeeded(mod, load, request, parent, isMain);
                try {
                    return Reflect.set(mod, propertyKey, value, receiver);
                } catch (err) {
                    trace('error:set', request, mod, propertyKey, err);
                    throw err;
                }
            },
            setPrototypeOf: (target, prototype) => {
                mod = loadIfNeeded(mod, load, request, parent, isMain);
                try {
                    return Reflect.setPrototypeOf(mod, prototype);
                } catch (err) {
                    trace('error:setPrototypeOf', request, mod, err);
                    throw err;
                }
            }
        });
    };
};

//
// Module exclusions
//

// Exclude Node SDK builtin modules, which already load hella quick; some of them,
// like `os`, have intractable incompatibility issues with proxying anyway...
const builtins = Object.keys(process.binding('natives'))
    .filter((el) => !/^_|^internal|\//.test(el));

// Some modules are not worth proxying, as they will be used in most runs of the CLI,
// so proxying them can only slow things down (not by much, but why incur the extra
// overhead or risk?). This list excludes such commonly required modules.
//
// NOTE: only add items to this list if they are known to work with the proxy first;
// that is, anything that is known to not work with the proxy should be listed in
// `snowflakes` to ensure we understand where the proxy still needs work.
const commons = [
    // todo: even though these are loaded all the time, execution is slightly faster
    // leaving them lazy... re-evaluate whether this is useful or not
    //
    // 'cli-engine',
    // 'cli-engine-command',
    // 'cli-engine-config',
    // 'cli-ux',
    // 'debug'
];

// Snowflakes are modules that do obnoxious or unusual things that are hard to support in the
// lazy proxy, so they are captured here for later addition to the excludes list; ideally
// we will improve the proxy traps to reduce this set to zero; commands known to exhibit
// the error follow in comments
const snowflakes = [
    // user-home is a string module that gets used in type-checked calls to `path`...
    // it's possible there's no fix for this scenario since the lazy proxies always
    // yield a typeof 'function'; user-home is used by yeomen
    'user-home',            // force:project:create
    // lodash craziness -- not entirely clear why this one blows up yet, but it's
    // doing some pretty wacky stuff; it's required downstream from the xmlbuilder module
    // it may be worth moving all of lodash into commons anyway, but let's dig deeper on
    // this one first
    './_defineProperty',    // force:source:pull
    // the following may belong in `commons` but are here for now as a reminder to
    // get the proxy working with them first -- they currently have at least one issue to
    // resolve before graduating them
    'jsforce',              // force:org:create
];

// The complete set of modules for which lazy loading should be disabled
const excludes = Array.from(new Set(builtins.concat(commons).concat(snowflakes)));

// Verbose debugging stub
let trace = () => {};

// Require a dark feature envar to enable this experiment
if ((process.env.SFDX_LAZY_LOAD_MODULES || '').toLowerCase() === 'true') {
    const debug = require('debug')('sfdx:lazy-modules');
    debug('lazy module loading enabled');
    if ((process.env.SFDX_LAZY_LOAD_MODULES_TRACE || '').toLowerCase() === 'true') {
        trace = debug;
    }
    const Module = require('module');
    Module._load = makeLazy(Module._load);
}
