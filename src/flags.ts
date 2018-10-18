/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import env from './util/env';

export function preprocessCliFlags(envars = env): void {
    process.argv = process.argv.filter((arg: string) => {
        let match = true;
        switch (arg) {
            case '--dev-debug': {
                envars.setString('DEBUG', '*');
                envars.setString('SFDX_DEBUG', '1');
                envars.setString('SFDX_ENV', 'development');
                envars.setString('NODE_ENV', 'development');
                break;
            }
            default: {
                match = false;
            }
        }
        return !match;
    });
}
