/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// tslint:disable:no-unused-expression

import { expect } from 'chai';
import { preprocessCliFlags } from './flags';
import { Env } from './util/env';

describe('CLI flags', () => {
    let env: Env;

    beforeEach(() => {
        env = new Env();
    });

    it('should pass through args it does not recognize', () => {
        process.argv = ['force:some:command', '--dev-debug', '--foo', '-f', 'bar'];
        preprocessCliFlags(env);
        expect(process.argv).to.deep.equal(['force:some:command', '--foo', '-f', 'bar']);
    });

    it('should recognize --dev-debug', () => {
        process.argv = ['--dev-debug'];
        preprocessCliFlags(env);
        expect(process.argv).not.to.include('--dev-debug');
        expect(env.getString('DEBUG')).to.equal('*');
        expect(env.getString('SFDX_DEBUG')).to.equal('1');
        expect(env.getString('SFDX_ENV')).to.equal('development');
        expect(env.getString('NODE_ENV')).to.equal('development');
    });
});
