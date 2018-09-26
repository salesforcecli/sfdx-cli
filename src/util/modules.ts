/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// A simple utility for gathering module loading statistics for diagnostic purposes.

// tslint:disable:no-any
// tslint:disable:no-var-requires
// tslint:disable:variable-name

// -------------------------------------------------------------------------------
// No requires or imports so we can instrument as much module loading as possible.
// -------------------------------------------------------------------------------

type Dictionary = { [key: string]: any };

export function start(): { dump: (arg: any) => void } {
    const enabled = process.env.SFDX_DEBUG_MODULES === 'true';
    const list: Dictionary = {};
    let tree: Dictionary = {};
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
