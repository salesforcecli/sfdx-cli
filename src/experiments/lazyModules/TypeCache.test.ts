/* tslint:disable:no-unused-expression */

import { expect } from 'chai';
import { sandbox as Sandbox, SinonSandbox } from 'sinon';

import fs = require('fs');

import TypeCache from './TypeCache';

type CacheValue = string | null;

const cacheNone: CacheValue = null;
const cacheInvalid: CacheValue = 'this is not json';
const cacheValid: CacheValue = JSON.stringify({
    '/fake/testObject.js': 'object',
    '/fake/testFunction.js': 'function'
});

const fsLib = {
    readFileSync: (path: string) => { },
    unlinkSync: (path: string) => { },
    writeFileSync: (path: string, data: string) => { }
};

class SystemError extends Error {
    public constructor(
        public code: string
    ) {
        super();
    }
}

describe('lazy module type cache', () => {
    let sandbox: SinonSandbox;
    let cacheValue: CacheValue;
    let typeCache: TypeCache;

    beforeEach(() => {
        sandbox = Sandbox.create();

        sandbox.stub(fsLib, 'readFileSync').callsFake(() => {
            if (!cacheValue) {
                throw new SystemError('ENOENT');
            }
            return Buffer.from(cacheValue);
        });

        sandbox.stub(fsLib, 'unlinkSync').callsFake(() => { });

        sandbox.stub(fsLib, 'writeFileSync').callsFake(() => { });

        typeCache = new TypeCache(fsLib as typeof fs, '/fake/cache.json');
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should create a new cache file when one does not already exist', () => {
        cacheValue = cacheNone;
        expect(typeCache.load()).to.be.false;
        expect((fsLib.readFileSync as any).calledOnce).to.be.true;
        expect((fsLib.unlinkSync as any).notCalled).to.be.true;
        expect(typeCache.hasType('/fake/testObject.js')).to.be.false;
        expect(typeCache.hasType('/fake/testFunction.js')).to.be.false;
    });

    it('should reset the cache file if found but is not parsable', () => {
        cacheValue = cacheInvalid;
        expect(typeCache.load()).to.be.false;
        expect((fsLib.readFileSync as any).calledOnce).to.be.true;
        expect((fsLib.unlinkSync as any).notCalled).to.be.false;
        expect(typeCache.hasType('/fake/testObject.js')).to.be.false;
        expect(typeCache.hasType('/fake/testFunction.js')).to.be.false;
    });

    it('should load an existing cache file if one is found and is valid', () => {
        cacheValue = cacheValid;
        expect(typeCache.load()).to.be.true;
        expect((fsLib.readFileSync as any).calledOnce).to.be.true;
        expect((fsLib.unlinkSync as any).notCalled).to.be.true;
        expect(typeCache.getType('/fake/testObject.js')).to.equal('object');
        expect(typeCache.getType('/fake/testFunction.js')).to.equal('function');
    });

    it('should report when the cache has changed', () => {
        cacheValue = cacheValid;
        typeCache.load();
        expect(typeCache.hasChanged()).to.be.false;
        typeCache.setTypeIfUnknown('/fake/foo.js', 'object');
        expect(typeCache.hasChanged()).to.be.true;
    });

    it('should not save when its values have not changed', () => {
        cacheValue = cacheValid;
        typeCache.load();
        expect(typeCache.hasChanged()).to.be.false;
        expect(typeCache.save()).to.be.false;
        expect((fsLib.writeFileSync as any).notCalled).to.be.true;
    });

    it('should save when its values have changed', () => {
        cacheValue = cacheValid;
        typeCache.load();
        typeCache.setTypeIfUnknown('/fake/foo.js', 'object');
        expect(typeCache.hasChanged()).to.be.true;
        expect(typeCache.save()).to.be.true;
        expect((fsLib.writeFileSync as any).calledOnce).to.be.true;
    });

    it('should not die when failing to write to the cache file when saved', () => {
        (fsLib.writeFileSync as any).restore();
        sandbox.stub(fsLib, 'writeFileSync').callsFake(() => { throw new Error('Fail!'); });
        cacheValue = cacheValid;
        typeCache.load();
        typeCache.setTypeIfUnknown('/fake/foo.js', 'object');
        expect(typeCache.save()).to.be.false;
        expect((fsLib.writeFileSync as any).calledOnce).to.be.true;
    });

    it('should clear entries and unlink an existing cache file when reset', () => {
        cacheValue = cacheValid;
        typeCache.load();
        typeCache.setTypeIfUnknown('/fake/foo.js', 'object');
        typeCache.reset();
        expect(typeCache.hasType('/fake/foo.js')).to.be.false;
        expect((fsLib.unlinkSync as any).calledOnce).to.be.true;
    });

    it('should not die when unlinking a non-existent cache file during reset', () => {
        cacheValue = cacheValid;
        typeCache.load();
        typeCache.reset();
        expect(typeCache.hasType('/fake/foo.js')).to.be.false;
        expect((fsLib.unlinkSync as any).calledOnce).to.be.true;
    });

    it('should report when it knows the type of a given module', () => {
        cacheValue = cacheValid;
        typeCache.load();
        expect(typeCache.hasType('/fake/testObject.js')).to.be.true;
    });

    it('should report when then type of a known module is proxiable', () => {
        cacheValue = cacheValid;
        typeCache.load();
        expect(typeCache.hasProxiableType('/fake/testObject.js')).to.be.true;
    });

    it('should report when then type of a known module is not proxiable', () => {
        cacheValue = cacheValid;
        typeCache.load();
        expect(typeCache.hasProxiableType('/fake/none.js')).to.be.false;
        typeCache.setTypeIfUnknown('/fake/foo.js', 'string');
        expect(typeCache.hasProxiableType('/fake/foo.js')).to.be.false;
    });

    it('should report the correct type of a known module', () => {
        cacheValue = cacheValid;
        typeCache.load();
        expect(typeCache.getType('/fake/testObject.js')).to.equal('object');
    });

    it('should return an appropriate proxy target for a known module', () => {
        cacheValue = cacheValid;
        typeCache.load();
        expect(typeof typeCache.getTargetForProxiableType('/fake/testObject.js')).to.equal('object');
        expect(typeof typeCache.getTargetForProxiableType('/fake/testFunction.js')).to.equal('function');
    });

    it('should report whether a module type is proxiable or not', () => {
        cacheValue = cacheValid;
        typeCache.load();
        expect(typeCache.hasProxiableType('/fake/testObject.js')).to.be.true;
        expect(typeCache.hasProxiableType('/fake/testFunction.js')).to.be.true;
        typeCache.setTypeIfUnknown('/fake/foo.js', 'string');
        expect(typeCache.hasProxiableType('/fake/foo.js')).to.be.false;
    });

    it('should throw an error when creating a proxy target for a module who\'s type is not proxiable', () => {
        cacheValue = cacheValid;
        typeCache.load();
        typeCache.setTypeIfUnknown('/fake/foo.js', 'string');
        expect(() => typeCache.getTargetForProxiableType('/fake/foo.js')).to.throw();
    });

    it('should set a module type if unknown', () => {
        cacheValue = cacheValid;
        typeCache.load();
        expect(typeCache.hasType('/fake/foo.js')).to.be.false;
        expect(typeCache.setTypeIfUnknown('/fake/foo.js', 'object')).to.be.true;
        expect(typeCache.hasType('/fake/foo.js')).to.be.true;
    });

    it('should not set a module type if already known', () => {
        cacheValue = cacheValid;
        typeCache.load();
        expect(typeCache.hasType('/fake/testObject.js')).to.be.true;
        expect(typeCache.setTypeIfUnknown('/fake/testObject.js', 'object')).to.be.false;
        expect(typeCache.hasType('/fake/testObject.js')).to.be.true;
    });

    it('should be able to clear the type of known module', () => {
        cacheValue = cacheValid;
        typeCache.load();
        expect(typeCache.hasType('/fake/testObject.js')).to.be.true;
        expect(typeCache.clearType('/fake/testObject.js')).to.be.true;
        expect(typeCache.hasType('/fake/testObject.js')).to.be.false;
    });

    it('should do nothing when clearing the type of an unknown module', () => {
        cacheValue = cacheValid;
        typeCache.load();
        expect(typeCache.hasType('/fake/foo.js')).to.be.false;
        expect(typeCache.clearType('/fake/foo.js')).to.be.false;
        expect(typeCache.hasType('/fake/foo.js')).to.be.false;
    });
});
