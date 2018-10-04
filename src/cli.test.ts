/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// tslint:disable:no-unused-expression

import { expect } from 'chai';
import {
    configureAutoUpdate,
    create,
    UPDATE_DISABLED_DEMO,
    UPDATE_DISABLED_INSTALLER,
    UPDATE_DISABLED_NPM
} from './cli';
import { Env } from './util/env';

describe('cli', () => {
    describe('create', () => {
        it('should create a runnable CLI instance', () => {
            const cli = create('test', 'test');
            expect(cli).to.have.property('run');
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
