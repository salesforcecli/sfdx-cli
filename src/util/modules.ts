// A simple utility for gathering module loading statistics for diagnostic purposes.

// tslint:disable:no-any
// tslint:disable:no-var-requires
// tslint:disable:variable-name

type AnyDictionary = { [key: string]: any };

const debug = process.env.SFDX_DEBUG_MODULES === 'true';
const list: AnyDictionary = { };
let node: AnyDictionary = { };

if (debug) {
    const paths = require('path');
    const Module = require('module');
    const origLoad = Module._load;
    let path = '';
    Module._load = (request: string, parent: object, isMain: boolean) => {
        const lastPath = path;
        path = paths.resolve(path, request);
        const lastNode = node;
        if (!lastNode[request]) lastNode[request] = {};
        node = lastNode[request];

        const mark = Date.now();
        const mod = origLoad.call(Module, request, parent, isMain);
        const elapsed = Date.now() - mark;

        if (!list[path]) list[path] = elapsed;
        if (node.elapsed == null) node.elapsed = elapsed;
        node = lastNode;
        path = lastPath;
        return mod;
    };
}

export function start(): { dump: (arg: any) => void } {
    return {
        dump(arg: any): void {
            if (debug) {
                console.log(JSON.stringify({ list, node }, null, 2));
            }
            return arg;
        }
    };
}
