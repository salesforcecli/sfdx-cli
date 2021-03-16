/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { join } from 'path';
import { readFileSync } from 'fs-extra';
import { expect } from 'chai';

describe('node version', () => {
  it('in NODE_VERSION.md and package.oclif.node are the same', () => {
    const packageJson = require(join(__dirname, '..', 'package.json'));
    const markdown = readFileSync(join(__dirname, '..', 'NODE_VERSION.md'), 'utf8');
    const markdownNodeVersion = /node=([0-9]+\.[0-9]+\.[0-9]+)/.exec(markdown);
    expect(packageJson.oclif.node).to.equal(markdownNodeVersion && markdownNodeVersion[1]);
  });
});
