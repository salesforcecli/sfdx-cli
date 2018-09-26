/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Hook } from '@oclif/config';
import { stubInterface } from '@salesforce/ts-sinon';
import { expect } from 'chai';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as sinon from 'sinon';
import hook from './logAnalytics';

/* tslint:disable:no-unused-expression */

describe('prerun:analytics hook', () => {
    const sandbox = sinon.createSandbox();
    let spawn: sinon.SinonStub;
    let on: sinon.SinonStub;
    let unref: sinon.SinonStub;
    let context: Hook.Context;

    beforeEach(() => {
        sandbox.stub(fs, 'openSync').callsFake(() => { });

        unref = sinon.stub();

        spawn = sandbox.stub(cp, 'spawn');
        spawn.callsFake(() => ({ unref }));

        on = sandbox.stub(process, 'on');
        on.callsFake((event, cb) => cb());

        context = stubInterface<Hook.Context>(sandbox);
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should not run without command', async () => {
        await hook.call(context, {});

        expect(spawn.called).to.be.false;
        expect(on.called).to.be.false;
    });

    it('should not run without plugin', async () => {
        const command = {
            id: 'test'
        };

        await hook.call(context, { Command: command });

        expect(spawn.called).to.be.false;
        expect(on.called).to.be.false;
    });

    it('should not spawn with error', async () => {
        const command = {
            id: 'test',
            plugin: { name: 'root', version: '' }
        };

        on.onCall(0).throws();

        await hook.call(context, { Command: command });

        expect(spawn.called).to.be.false;
        expect(on.called).to.be.true;
    });

    it('should spawn with command and plugin', async () => {
        const command = {
            id: 'test',
            plugin: { name: 'root', version: '' }
        };

        await hook.call(context, { Command: command, config: { cacheDir: 'tmp', shell: 'zsh' } });

        expect(spawn.called).to.be.true;
        expect(on.called).to.be.true;
        expect(unref.called).to.be.true;

        const passedInScriptArgs2 = JSON.parse(spawn.getCall(0).args[1][1]);
        expect(passedInScriptArgs2.commandId).to.equal('test');
        expect(passedInScriptArgs2.config.shell).to.equal('zsh');

        expect(spawn.getCall(0).args[2].detached).to.be.true;
    });

    it('should spawn without detached on windows', async () => {
        const command = {
            id: 'test',
            plugin: { name: 'root', version: '' }
        };

        await hook.call(context, { Command: command, config: { cacheDir: 'tmp', windows: true } });

        expect(spawn.called).to.be.true;
        expect(spawn.getCall(0).args[2].detached).to.be.false;
    });
});
