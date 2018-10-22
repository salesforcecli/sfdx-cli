/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// tslint:disable:no-unused-expression

import * as Config from '@oclif/config';
import { expect } from 'chai';
import * as sinon from 'sinon';
import {
    configureAutoUpdate,
    create,
    UPDATE_DISABLED_DEMO,
    UPDATE_DISABLED_INSTALLER,
    UPDATE_DISABLED_NPM
} from './cli';
import { Env } from './util/env';

describe('cli', () => {
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('create', () => {
        it('should create a runnable CLI instance', async () => {
            sandbox.stub(Config.Config.prototype, 'load').callsFake(() => { });
            let config: Config.LoadOptions;
            const exec = async (argv?: string[], opts?: Config.LoadOptions) => { config = opts; };
            const env = new Env({ [Env.LAZY_LOAD_MODULES]: 'false' });
            await create('test', 'test', exec, env).run();
            expect(config).to.exist;
            expect(config).to.have.property('options');
            expect(config).to.have.nested.property('options.version').and.equal('test');
            expect(config).to.have.nested.property('options.channel').and.equal('test');
        });
    });

    describe('flags', () => {
        let env: Env;

        beforeEach(() => {
            env = new Env({});
        });

        it('should default to autoupdate disabled for local dev or npm installs', () => {
            configureAutoUpdate(env);

            expect(env.getBoolean('SFDX_AUTOUPDATE_DISABLE')).to.be.true;
            expect(env.getString(Env.UPDATE_INSTRUCTIONS)).to.equal(UPDATE_DISABLED_NPM);
        });

        it('should allow autoupdate to be explicitly enabled for local dev (for testing autoupdates)', () => {
            env.setBoolean('SFDX_AUTOUPDATE_DISABLE', false);
            configureAutoUpdate(env);

            expect(env.getBoolean('SFDX_AUTOUPDATE_DISABLE')).to.be.false;
            expect(env.getString(Env.UPDATE_INSTRUCTIONS)).to.be.undefined;
        });

        it('should default to autoupdate enabled for binary installs', () => {
            env.setBoolean('SFDX_INSTALLER', true);
            configureAutoUpdate(env);

            expect(env.getBoolean('SFDX_AUTOUPDATE_DISABLE')).to.be.false;
            expect(env.getString(Env.UPDATE_INSTRUCTIONS)).to.be.undefined;
        });

        it('should have autoupdate disabled for binary installs when SFDX_AUTOUPDATE_DISABLE is set to true', () => {
            env.setBoolean('SFDX_INSTALLER', true);
            env.setBoolean('SFDX_AUTOUPDATE_DISABLE', true);
            configureAutoUpdate(env);

            expect(env.getBoolean('SFDX_AUTOUPDATE_DISABLE')).to.be.true;
            expect(env.getString(Env.UPDATE_INSTRUCTIONS)).to.equal(UPDATE_DISABLED_INSTALLER);
        });

        it('should have autoupdate disabled when in demo mode', () => {
            env.setString('SFDX_ENV', 'DEMO');
            configureAutoUpdate(env);

            expect(env.getBoolean('SFDX_AUTOUPDATE_DISABLE')).to.be.true;
            expect(env.getString(Env.UPDATE_INSTRUCTIONS)).to.equal(UPDATE_DISABLED_DEMO);
        });
    });
});
