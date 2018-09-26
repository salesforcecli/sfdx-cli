/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { processCliFlags, ProcessLike } from './flags';

describe('CLI flags', () => {
    let process: ProcessLike;

    beforeEach(() => {
        process = {
            argv: [],
            env: {}
        };
    });

    it('should pass through args it does not recognize', () => {
        process.argv = ['force:some:command', '--dev-debug', '--foo', '-f', 'bar'];
        processCliFlags(process);
        expect(process.argv).to.deep.equal(['force:some:command', '--foo', '-f', 'bar']);
    });

    it('should recognize --dev-debug', () => {
        process.argv = ['--dev-debug'];
        processCliFlags(process);
        expect(process.argv).not.to.include('--dev-debug');
        expect(process.env.DEBUG).to.equal('*');
        expect(process.env.SFDX_DEBUG).to.equal('1');
        expect(process.env.SFDX_ENV).to.equal('development');
        expect(process.env.NODE_ENV).to.equal('development');
    });

    it('should convert --dev-debug to envars', () => {
        process.argv = ['--dev-debug'];
        processCliFlags(process);
        expect(process.argv).not.to.include('--dev-debug');
        expect(process.env.DEBUG).to.equal('*');
        expect(process.env.SFDX_DEBUG).to.equal('1');
    });
});
