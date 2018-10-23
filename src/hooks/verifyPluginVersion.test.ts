/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Hook } from '@oclif/config';
import { StubbedType, stubInterface } from '@salesforce/ts-sinon';
import { Nullable } from '@salesforce/ts-types';
import { expect } from 'chai';
import * as sinon from 'sinon';
import hook from './verifyPluginVersion';

// tslint:disable:no-unused-expression

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

    it('should allow the salesforcedx plugin with tag "41.2.0" to be installed', async () => {
        await testHook('41.2.0');
    });

    it('should allow the salesforcedx plugin with tag "latest" to be installed', async () => {
        await testHook('latest');
    });

    it('should allow the salesforcedx plugin with tag "pre-release" to be installed', async () => {
        await testHook('pre-release');
    });

    it('should allow the salesforcedx plugin with tag "foo" to be installed', async () => {
        await testHook('foo');
    });

    it('should allow the salesforcedx plugin with no tag to be installed', async () => {
        await testHook('');
        await testHook(null);
        await testHook(undefined);
    });

    it('should not allow the salesforcedx plugin with tag "41.1.0" to be installed', async () => {
        await testHook('41.1.0');
        expect(context.error.getCalls().some(call => call.args[0].includes('can only be installed'))).to.be.true;
    });

    async function testHook(tag: Nullable<string>) {
        await hook.call(context, {
            config: { version: '6.0.0' },
            plugin: { name: 'salesforcedx', tag }
        });
    }
});
