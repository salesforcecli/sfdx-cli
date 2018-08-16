// A simple utility for gathering module loading statistics for diagnostic purposes.

// tslint:disable:no-any
// tslint:disable:no-var-requires
// tslint:disable:variable-name

import env from './env';

type AnyDictionary = { [key: string]: any };

const enabled = env.getBoolean('SFDX_DEBUG_MODULES', false);
const list: AnyDictionary = { };
let tree: AnyDictionary = {};
let loading = false;
let time = 0;

if (enabled) {
    const paths = require('path');
    const Module = require('module');
    const origLoad = Module._load;
    let path = '';
    Module._load = (request: string, parent: object, isMain: boolean) => {
        const wasLoading = loading;
        loading = true;

        const lastPath = path;
        path = paths.resolve(path, request);
        const lastTree = tree;
        if (!lastTree[request]) lastTree[request] = {};
        tree = lastTree[request];

        const mark = Date.now();
        const mod = origLoad.call(Module, request, parent, isMain);
        const elapsed = Date.now() - mark;

        if (!list[path]) list[path] = elapsed;
        if (tree.elapsed == null) tree.elapsed = elapsed;
        tree = lastTree;
        path = lastPath;

        if (!wasLoading) {
            loading = false;
            time += elapsed;
        }

        return mod;
    };
}

export function start(): { dump: (arg: any) => void } {
    return {
        dump(arg: any): void {
            if (enabled) {
                const report = { time, list, tree, count: list.length };
                console.error(JSON.stringify(report, null, 2));
            }
            return arg;
        }
    };
}
