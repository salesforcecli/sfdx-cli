/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { join } from 'path';
import { existsSync } from 'fs-extra';
import { expect } from 'chai';

describe('node version', () => {
  it('node version file does not exist', () => {
    expect(existsSync(join(__dirname, '..', 'NODE_VERSION.md'))).to.be.false;
  });
  it('does not have oclif version in the old pjson location', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment
    const packageJson = require(join(__dirname, '..', 'package.json')) as { oclif: { node: string } };
    expect(packageJson.oclif.node).to.be.undefined;
  });
});
