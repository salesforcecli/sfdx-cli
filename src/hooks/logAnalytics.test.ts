import { assert, expect } from 'chai';
import * as cp from 'child_process';
import * as fs from 'fs';
import hook = require('./logAnalytics');
import * as sinon from 'sinon';

/* tslint:disable:no-unused-expression */

describe('prerun:analytics hook', () => {
    const sandbox = sinon.sandbox.create();
    let spawn;
    let on;
    let unref;

    beforeEach(() => {
        sandbox.stub(fs, 'openSync').callsFake(() => { });

        unref = sinon.stub();

        spawn = sandbox.stub(cp, 'spawn');
        spawn.callsFake(() => ({ unref }));

        on = sandbox.stub(process, 'on');
        on.callsFake((event, cb) => cb());
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should not run without command', async () => {
        await hook({}, {});

        expect(spawn.called).to.be.false;
        expect(on.called).to.be.false;
    });

    it('should not run without plugin', async () => {
        const command = {
            id: 'test'
        };

        await hook({}, { Command: command });

        expect(spawn.called).to.be.false;
        expect(on.called).to.be.false;
    });

    it('should not spawn with error', async () => {
        const command = {
            id: 'test',
            plugin: { name: 'root', version: '' }
        };

        on.onCall(0).throws();

        await hook({}, { Command: command });

        expect(spawn.called).to.be.false;
        expect(on.called).to.be.true;
    });

    it('should spawn with command and plugin', async () => {
        const command = {
            id: 'test',
            plugin: { name: 'root', version: '' }
        };

        await hook({ cacheDir: 'tmp', shell: 'zsh' }, { Command: command });

        expect(spawn.called).to.be.true;
        expect(on.called).to.be.true;
        expect(unref.called).to.be.true;

        const pastInScriptArgs2 = JSON.parse(spawn.getCall(0).args[1][1]);
        expect(pastInScriptArgs2.commandId).to.equal('test');
        expect(pastInScriptArgs2.config.shell).to.equal('zsh');

        expect(spawn.getCall(0).args[2].detached).to.be.true;
    });

    it('should spawn without detached on windows', async () => {
        const command = {
            id: 'test',
            plugin: { name: 'root', version: '' }
        };

        await hook({ cacheDir: 'tmp', windows: true }, { Command: command });

        expect(spawn.called).to.be.true;
        expect(spawn.getCall(0).args[2].detached).to.be.false;
    });
});
