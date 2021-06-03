/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as LintCommand from 'salesforce-lightning-cli/commands/lightning/lint';

class ForceLintCommand extends LintCommand {
  public static readonly deprecated = {
    message:
      'To lint Aura components, use the @salesforce/eslint-plugin-aura node package. See https://github.com/forcedotcom/eslint-plugin-aura for details.',
    name: 'force:lightning:lint',
    version: 52,
  };
}

module.exports = ForceLintCommand;
