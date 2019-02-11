/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Hook } from '@oclif/config';
import { fs, Global } from '@salesforce/core';
import { constants as fsConstants } from 'fs';
import * as path from 'path';

/**
 * A hook that runs before every command that warns the user about usage data collection
 * the CLI does unless they have already acknowledged the warning.
 */
const hook: Hook.Prerun = async function() {
    const acknowledgementFilePath = path.join(Global.DIR, 'acknowledgedUsageCollection.json');
    try {
        await fs.access(acknowledgementFilePath, fsConstants.R_OK);
    } catch (err) {
        if (err.code === 'ENOENT') {
            this.warn('You acknowledge and agree that the CLI tool may collect usage information, ' +
                'user environment, and crash reports for the purposes of providing services or functions that are relevant ' +
                'to use of the CLI tool and product improvements.');
            await fs.writeJson(acknowledgementFilePath, { acknowledged: true });
        } else {
            this.error(`Could not access ${acknowledgementFilePath} DUE TO: ${err}`);
            throw err;
        }
    }
};

export default hook;
