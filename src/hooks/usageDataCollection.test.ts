/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Hook, IConfig } from '@oclif/config';
import { fs } from '@salesforce/core';
import { StubbedType, stubInterface } from '@salesforce/ts-sinon';
import { assert, expect } from 'chai';
import * as sinon from 'sinon';
import hook from './usageDataCollection';

// tslint:disable:no-unused-expression

describe('usageDataCollection prerun hook', () => {
    let sandbox: sinon.SinonSandbox;
    let context: StubbedType<Hook.Context>;
    let config: IConfig;
    let accessStub: sinon.SinonStub;
    let writeJsonStub: sinon.SinonStub;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        context = stubInterface<Hook.Context>(sandbox);
        config = stubInterface<IConfig>(sandbox);
        accessStub = sandbox.stub(fs, 'access');
        writeJsonStub = sandbox.stub(fs, 'writeJson').callsFake(async () => {});
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should display a warning and write the config file if the config file does not exist', async () => {
        accessStub.throws({ code: 'ENOENT' });
        // tslint:disable-next-line:no-any
        await hook.call(context, { Command: {} as any, argv: [''], config});
        expect(context.warn.called).to.be.true;
        expect(writeJsonStub.called).to.be.true;
        expect(writeJsonStub.firstCall.args[0]).to.contain('/.sfdx/acknowledgedUsageCollection.json');
        expect(writeJsonStub.firstCall.args[1]).to.deep.equal({ acknowledged: true });
    });

    it('should NOT display a warning when the config file exists', async () => {
        accessStub.callsFake(async () => {});
        // tslint:disable-next-line:no-any
        await hook.call(context, { Command: {} as any, argv: [''], config});
        expect(context.warn.called).to.be.false;
        expect(writeJsonStub.called).to.be.false;
    });

    it('should throw if there is any other error', async () => {
        accessStub.throws({ code: 'EACCES' });

        try {
            // tslint:disable-next-line:no-any
            await hook.call(context, { Command: {} as any, argv: [''], config});
            assert.fail('hook should have thrown an error for access failure.');
        } catch (err) {
            expect(context.warn.called).to.be.false;
            expect(writeJsonStub.called).to.be.false;
            expect(context.error.called).to.be.true;
            expect(err.code).to.equal('EACCES');
        }
    });
});
