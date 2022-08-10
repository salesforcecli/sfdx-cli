/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Config } from '@oclif/core';
import { resetTypeCache } from '../lazyRequire';

const hook: (options: { config: Config }) => void = (options: { config: Config }) => {
  // Reset the type cache on CLI or plugin updates in case a dependency has changed types
  resetTypeCache(options.config);
};

export default hook;
