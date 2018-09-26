/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Dictionary } from '@salesforce/ts-types';

export interface ProcessLike {
    argv: string[];
    env: Dictionary<string>;
}

export function processCliFlags(process: ProcessLike): void {
    process.argv = process.argv.filter((arg: string) => {
        let match = true;
        switch (arg) {
            case '--dev-debug': {
                process.env.DEBUG = '*';
                process.env.SFDX_DEBUG = '1';
                process.env.SFDX_ENV = 'development';
                process.env.NODE_ENV = 'development';
                break;
            }
            default: {
                match = false;
            }
        }
        return !match;
    });
}
