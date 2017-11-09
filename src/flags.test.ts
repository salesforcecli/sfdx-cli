import { assert, expect } from 'chai';
import { processCliFlags } from './flags';

describe('CLI flags', () => {
    let process;

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
    });

    it('should convert --dev-debug to envars', () => {
        process.argv = ['--dev-debug'];
        processCliFlags(process);
        expect(process.argv).not.to.include('--dev-debug');
        expect(process.env.DEBUG).to.equal('*');
        expect(process.env.SFDX_DEBUG).to.equal('1');
    });

    it('should convert --x-lazy-load to envars', () => {
        process.argv = ['--x-lazy-load'];
        processCliFlags(process);
        expect(process.argv).not.to.include('--x-lazy-load');
        expect(process.env.SFDX_LAZY_LOAD_MODULES).to.equal('true');
    });

    it('should convert --x-lazy-load-trace to envars', () => {
        process.argv = ['--x-lazy-load-trace'];
        processCliFlags(process);
        expect(process.argv).not.to.include('--x-lazy-load-trace');
        expect(process.env.SFDX_LAZY_LOAD_MODULES).to.equal('true');
        expect(process.env.SFDX_LAZY_LOAD_MODULES_TRACE).to.equal('true');
        expect(process.env.DEBUG).to.equal('sfdx:lazy-modules');
    });
});
