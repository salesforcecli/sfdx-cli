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
 */

// The JS proxy spec has an annoying gap in the spec that causes toString on proxied
// functions to throw an error, so we override the proxy's built-in toString function
// to return the following as a workaround. To see the root issue, try the following:
//     > node -e 'new Proxy(function () {}, {}).toString()'
const proxyToString = 'function LazyProxy() {}';

// Loads a module using the original module loader if the module is undefined
const loadIfNeeded = (mod, load, name, parent, isMain) => {
    return mod === undefined ? load(name, parent, isMain) : mod;
}

// Wraps the original module loading function with the lazy proxy functionality
const makeLazy = (load) => {
    // Modules from the excludes list will disable lazy loading for themselves and
    // an require calls made within their require subtrees.
    let disabled = false;

    // The lazy loading wrapper
    return (request, parent, isMain) => {
        if (disabled) {
            return load(request, parent, isMain);
        }
        if (excludes.includes(request)) {
            try {
                disabled = true;
                return load(request, parent, isMain);
            } finally {
                disabled = false;
            }
        }

        let mod;
        return new Proxy(function () {}, {
            apply: (target, thisArg, argumentsList) => {
                mod = loadIfNeeded(mod, load, request, parent, isMain);
                return Reflect.apply(mod, thisArg, argumentsList);
            },
            construct: (target, argumentsList, newTarget) => {
                mod = loadIfNeeded(mod, load, request, parent, isMain);
                return Reflect.construct(mod, argumentsList, newTarget);
            },
            defineProperty: (target, propertyKey, attributes) => {
                mod = loadIfNeeded(mod, load, request, parent, isMain);
                const desc = Object.getOwnPropertyDescriptor(mod);
                if (desc && !desc.configurable) {
                    return false;
                }
                return Reflect.defineProperty(mod, propertyKey, attributes);
            },
            deleteProperty: (target, propertyKey) => {
                mod = loadIfNeeded(mod, load, request, parent, isMain);
                return Reflect.deleteProperty(mod, propertyKey);
            },
            get: (target, propertyKey, receiver) => {
                mod = loadIfNeeded(mod, load, request, parent, isMain);
                if (propertyKey === 'toString') {
                    return () => proxyToString;
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
                const modDesc = typeof mod === 'string' ? targetDesc : Reflect.getOwnPropertyDescriptor(mod, propertyKey);
                if (targetDesc && !modDesc) {
                    return targetDesc;
                }
                if (!targetDesc && modDesc) {
                    modDesc.configurable = true;
                    return modDesc;
                }
                if (targetDesc && modDesc) {
                    modDesc.configurable = targetDesc.configurable;
                    return modDesc;
                }
                return modDesc;
            },
            getPrototypeOf: (target) => {
                mod = loadIfNeeded(mod, load, request, parent, isMain);
                return typeof mod === 'string' ?
                    Object.getPrototypeOf(target) : Reflect.getPrototypeOf(mod);
            },
            has: (target, propertyKey) => {
                mod = loadIfNeeded(mod, load, request, parent, isMain);
                return Reflect.has(mod, propertyKey);
            },
            isExtensible: (target) => {
                mod = loadIfNeeded(mod, load, request, parent, isMain);
                return Reflect.isExtensible(mod);
            },
            ownKeys: (target) => {
                mod = loadIfNeeded(mod, load, request, parent, isMain);
                const targetKeys = Object.getOwnPropertyNames(target)
                    .filter((k) => !Object.getOwnPropertyDescriptor(target, k).configurable);
                if (typeof mod === 'string') {
                    return targetKeys;
                }
                return Array.from(new Set(Reflect.ownKeys(mod).concat(targetKeys)));
            },
            preventExtensions: (target) => {
                mod = loadIfNeeded(mod, load, request, parent, isMain);
                return Reflect.preventExtensions(mod);
            },
            set: (target, propertyKey, value, receiver) => {
                mod = loadIfNeeded(mod, load, request, parent, isMain);
                return Reflect.set(mod, propertyKey, value, receiver);
            },
            setPrototypeOf: (target, prototype) => {
                mod = loadIfNeeded(mod, load, request, parent, isMain);
                return Reflect.setPrototypeOf(mod, prototype);
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
// `snowflakes` to ensure we understand where the proxy still need work.
const commons = [
    'cli-engine',
    'cli-engine-command',
    'cli-engine-config',
    'cli-ux',
    'debug'
];

// Snowflakes are modules that do obnoxious things that are hard to support in the
// lazy proxy, so they are captured here for later addition to the excludes list; ideally
// we will improve the proxy traps to reduce this set to zero.
const snowflakes = [
    'user-home',
    // `jsforce` maybe belongs in `commons` but is here for now as a reminder to
    // get the proxy working with it first -- it currently has at least one issue to
    // resolve before graduating it
    'jsforce'
];

// The complete set of modules for which lazy loading should be disabled
const excludes = Array.from(new Set(builtins.concat(commons).concat(snowflakes)));

// Require a dark feature envar to enable this experiment
if ((process.env.SFDX_LAZY_LOAD_MODULES || '').toLowerCase() === 'true') {
    const Module = require('module');
    Module._load = makeLazy(Module._load);
}
