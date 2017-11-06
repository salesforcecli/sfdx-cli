/* tslint:disable:no-unused-expression */

import { expect } from 'chai';
import { Env } from './env';

describe('Env', () => {
    let env;

    beforeEach(() => {
        env = new Env({
            FOO: 'BAR',
            BOOL: 'true'
        });
    });

    it('should get a simple string envar', () => {
        expect(env.get('FOO')).to.equal('BAR');
    });

    it('should get a default string when asked for a non-existent string envar', () => {
        expect(env.get('FOO2', 'BAR')).to.equal('BAR');
    });

    it('should get a simple boolean envar', () => {
        expect(env.getBoolean('BOOL')).to.be.true;
    });

    it('should get a default boolean when asked for a non-existent boolean envar', () => {
        expect(env.getBoolean('BOOL2', true)).to.be.true;
    });
});
