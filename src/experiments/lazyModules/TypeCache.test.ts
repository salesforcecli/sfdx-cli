/* tslint:disable:no-unused-expression */

import { expect } from 'chai';
import { sandbox as Sandbox } from 'sinon';
import TypeCache from './TypeCache';
import { Config } from 'cli-engine-config';
import fs = require('fs');

describe('lazy module loader', () => {
    let sandbox;
    let typeCache: TypeCache;
    let fsLib: typeof fs;

    beforeEach(() => {
        sandbox = Sandbox.create();

        typeCache = sandbox.mock(typeCache);

        fsLib = sandbox.mock(fs);

        // modLib = {};
        // sandbox.stub(modLib, '_load').callsFake((request, parent, isMain) => {
        //     realLoadTime = Date.now();
        //     return testModule;
        // });
        // sandbox.stub(modLib, '_resolveFilename').callsFake((request) => {
        //     return `/some/path/to/${request}.js`;
        // });

        // lazy = new LazyModules('/tmp', typeCache, modLib, fsLib);
        // sandbox.stub(lazy, 'getExcludes').value(/^(?:.+\.json|excluded)$/);
        // lazy.enable();

        // lazyLoadTime = Date.now();

        // expect(lazy.isEnabled()).to.be.true;
    });

    describe('basic behaviors', () => {
        // it('should lazy load modules', (done) => {
        //     testModule = { foo: 'bar' };
        //     lazyLoadTime = Date.now();
        //     const test = require('test');
        //     setTimeout(() => {
        //         expect(test.foo).to.equal('bar');
        //         expect(realLoadTime - lazyLoadTime).to.be.gte(100);
        //         done();
        //     }, 100);
        // });
    });

});
