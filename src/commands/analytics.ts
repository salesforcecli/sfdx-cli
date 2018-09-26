/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Command } from '@oclif/command';
import Analytics from '../analytics';

export default class AnalyticsGet extends Command {
    public static hidden = true;

    public async run(): Promise<void> {
        this.log(JSON.stringify(await new Analytics(this.config).readJSON()));
    }
}
