/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Hook, Errors } from '@oclif/core';

const hook: Hook.PluginsPreinstall = async function (options) {
  // Run individual hooks serially since oclif runs hooks in parallel, which causes UX problems in this case
  await this.config.runHook('plugins:preinstall:verify:version', options);

  const verifySignHookResult = await this.config.runHook('plugins:preinstall:verify:signature', options);
  const pluginTrustFailure = verifySignHookResult.failures.find(
    (failure) => failure.plugin.name === '@salesforce/plugin-trust'
  );

  if (pluginTrustFailure !== undefined) {
    Errors.handle(pluginTrustFailure.error);
  }
};

export default hook;
