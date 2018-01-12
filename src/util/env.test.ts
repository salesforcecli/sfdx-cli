/* tslint:disable:no-unused-expression */

import { expect } from 'chai';
import { Env } from './env';

describe('Env', () => {
    let env: Env;

    beforeEach(() => {
        env = new Env({
            FOO: 'BAR',
            BOOL: 'true'
        });
    });

    it('should get a string envar', () => {
        expect(env.get('FOO')).to.equal('BAR');
    });

    it('should get a default string when asked for a non-existent string envar', () => {
        expect(env.get('FOO2', 'BAR')).to.equal('BAR');
    });

    it('should set a string envar', () => {
        env.set('FOO2', 'BAR2');
        expect(env.get('FOO2')).to.equal('BAR2');
    });

    it('should delete a string envar', () => {
        env.delete('FOO');
        expect(env.get('FOO')).to.be.undefined;
    });

    it('should get a boolean envar', () => {
        expect(env.get('BOOL')).to.equal('true');
        expect(env.getBoolean('BOOL')).to.be.true;
    });

    it('should get a default boolean when asked for a non-existent boolean envar', () => {
        expect(env.get('BOOL2', 'true')).to.equal('true');
        expect(env.getBoolean('BOOL2', true)).to.be.true;
    });

    it('should set a boolean envar', () => {
        env.setBoolean('BOOL2', true);
        expect(env.get('BOOL2')).to.equal('true');
        expect(env.getBoolean('BOOL2')).to.be.true;
    });

    it('should delete a boolean envar', () => {
        env.delete('BOOL');
        expect(env.get('BOOL')).to.be.undefined;
        expect(env.getBoolean('BOOL')).to.be.false;
    });
});
