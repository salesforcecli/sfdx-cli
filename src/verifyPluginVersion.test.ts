/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Hook, IConfig } from '@oclif/config';
import { StubbedType, stubInterface } from '@salesforce/ts-sinon';
import { getString } from '@salesforce/ts-types';
import { expect } from 'chai';
import * as sinon from 'sinon';
import hook from './hooks/verifyPluginVersion';

describe('verifyPluginVersion preinstall hook', () => {
  let sandbox: sinon.SinonSandbox;
  let context: StubbedType<Hook.Context>;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    context = stubInterface<Hook.Context>(sandbox);
  });

  afterEach(() => {
    sandbox.restore();
  });

  async function testHook(tag: string): Promise<void> {
    await hook.call(context, {
      config: stubInterface<IConfig>(sandbox, { version: '6.0.0' }),
      plugin: { name: 'salesforce-alm', tag, type: 'npm' },
    });
  }

  it('should allow the salesforce-alm plugin with tag "41.2.0" to be installed', async () => {
    await testHook('41.2.0');
  });

  it('should allow the salesforce-alm plugin with tag "latest" to be installed', async () => {
    await testHook('latest');
  });

  it('should allow the salesforce-alm plugin with tag "pre-release" to be installed', async () => {
    await testHook('pre-release');
  });

  it('should allow the salesforce-alm plugin with tag "foo" to be installed', async () => {
    await testHook('foo');
  });

  it('should allow the salesforce-alm plugin with no tag to be installed', async () => {
    await testHook('');
  });

  it('should not allow the salesforce-alm plugin with tag "41.1.0" to be installed', async () => {
    await testHook('41.1.0');
    // eslint-disable-next-line no-unused-expressions
    expect(context.error.getCalls().some((call) => getString(call, 'args[0]')?.includes('can only be installed'))).to.be
      .true;
  });
});
