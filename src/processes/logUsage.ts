/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import Analytics from '../analytics';

try {
    const { config, plugin, commandId, time, status } = JSON.parse(process.argv[2]);
    /* tslint:disable-next-line no-floating-promises */
    new Analytics(config).record(plugin, commandId, time, status);
} catch (err) {
    // Do nothing. This prevents throwing an error on the
    // upgrade path. Can remove after all clients are off 6.0.10
}
