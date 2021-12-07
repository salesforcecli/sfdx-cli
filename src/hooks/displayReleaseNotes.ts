/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Hook } from '@oclif/config';
import { exec } from 'shelljs';

const hook: Hook.Update = () => {
  try {
    exec('sfdx whatsnew --hook');
  } catch (err) {
    return;
  }
};

export default hook;
