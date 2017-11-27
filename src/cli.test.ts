/* tslint:disable:no-unused-expression */

import { assert, expect } from 'chai';
import { Env } from './util/env';
import {
    configureAutoUpdate,
    UPDATE_DISABLED_BINARY,
    UPDATE_DISABLED_OTHER
} from './cli';

describe('CLI flags', () => {
    let env: Env;

    beforeEach(() => {
        env = new Env({});
    });

    it('should default to autoupdate disabled for local dev or npm installs', () => {
        const config = configureAutoUpdate(env, {});

        expect(env.getBoolean('SFDX_AUTOUPDATE_DISABLE')).to.be.true;
        expect(config.updateDisabled).to.equal(UPDATE_DISABLED_OTHER);
    });

    it('should allow autoupdate to be explicitly enabled for local dev (for testing autoupdates)', () => {
        env.setBoolean('SFDX_AUTOUPDATE_DISABLE', false);
        const config = configureAutoUpdate(env, {});

        expect(env.getBoolean('SFDX_AUTOUPDATE_DISABLE')).to.be.false;
        expect(config.updateDisabled).to.be.undefined;
    });

    it('should default to autoupdate enabled for binary installs', () => {
        env.setBoolean('SFDX_BINARY', true);
        const config = configureAutoUpdate(env, {});

        expect(env.getBoolean('SFDX_AUTOUPDATE_DISABLE')).to.be.false;
        expect(config.updateDisabled).to.be.undefined;
    });

    it('should have autoupdate disabled for binary installs when SFDX_AUTOUPDATE_DISABLE is set to true', () => {
        env.setBoolean('SFDX_BINARY', true);
        env.setBoolean('SFDX_AUTOUPDATE_DISABLE', true);
        const config = configureAutoUpdate(env, {});

        expect(env.getBoolean('SFDX_AUTOUPDATE_DISABLE')).to.be.true;
        expect(config.updateDisabled).to.equal(UPDATE_DISABLED_BINARY);
    });
});
