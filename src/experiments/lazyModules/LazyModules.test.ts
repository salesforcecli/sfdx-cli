/* tslint:disable:no-unused-expression */

import { expect } from 'chai';
import { sandbox as Sandbox } from 'sinon';

import fs = require('fs');
import Module = require('module');
import { Config } from 'cli-engine-config';

import TypeCache from './TypeCache';
import LazyModules from './LazyModules';

describe('lazy module loader', () => {
    let origRequire = require;
    let sandbox;
    let testModule;
    let typeCache: TypeCache;
    let modLib;
    let fsLib: typeof fs;
    let lazyModules: LazyModules;
    let lazyLoadTime: number;
    let realLoadTime: number;

    beforeEach(() => {
        sandbox = Sandbox.create();

        modLib = {
            _load: (request, parent, isMain) => {
                realLoadTime = Date.now();
                return testModule;
            },
            _resolveFilename: (request) => {
                return `/fake/${request}.js`;
            }
        };

        origRequire = require;
        require = ((request: string) => {
            return modLib._load(request, {}, false);
        }) as any;

        fsLib = sandbox.mock(fs);

        // make sure the test type cache has values for all possible module requests, even if they wouldn't
        // be primed in the cache normally (i.e. for being non-objects or non-functions) so ensure that a
        // cache miss doesn't create a false positive when testing excludes
        typeCache = new TypeCache(fsLib, '/fake/cache.json', {
            '/fake/testFunction.js': 'function',
            '/fake/testObject.js': 'object',
            '/fake/testString.js': 'string',
            '/fake/excludedObject.js': 'object',
            '/fake/excludedString.json': 'string'
        });
        lazyModules = new LazyModules('/tmp', typeCache, modLib, fsLib);
        sandbox.stub(lazyModules, 'getExcludes').callsFake(() => /^(?:.+\.json|excludedObject|excludedString)$/);
        lazyModules.enable();

        lazyLoadTime = Date.now();

        expect(lazyModules.isEnabled()).to.be.true;
    });

    afterEach(() => {
        require = origRequire;
        sandbox.restore();
    });

    describe('basic behaviors', () => {
        it('should lazy load modules', (done) => {
            testModule = { foo: 'bar' };
            lazyLoadTime = Date.now();
            const test = require('testObject');
            setTimeout(() => {
                try {
                    expect(test.foo).to.equal('bar');
                    expect(realLoadTime - lazyLoadTime).to.be.gte(100);
                    done();
                } catch (err) {
                    done(err);
                }
            }, 100);
        });

        it('should immediately load excluded modules', (done) => {
            testModule = { foo: 'bar' };
            lazyLoadTime = Date.now();
            const test = require('excludedObject');
            setTimeout(() => {
                try {
                    expect(test.foo).to.equal('bar');
                    expect(realLoadTime - lazyLoadTime).to.be.lt(100);
                    done();
                } catch (err) {
                    done(err);
                }
            }, 100);
        });

        it('should immediately load json files', (done) => {
            testModule = '{"foo": "bar"}';
            lazyLoadTime = Date.now();
            const test = require('excludedString.json');
            setTimeout(() => {
                try {
                    expect(typeof test).to.equal('string');
                    expect(test).to.equal('{"foo": "bar"}');
                    expect(realLoadTime - lazyLoadTime).to.be.lt(100);
                    const parsed = JSON.parse(test);
                    expect(parsed.foo).to.equal('bar');
                    done();
                } catch (err) {
                    done(err);
                }
            }, 100);
        });

        it('should require an object that is cached idempotently', () => {
            testModule = { foo: 'bar' };
            const test = require('testObject');
            const test2 = require('testObject');
            expect(test).to.equal(test2);
        });
    });

    describe('module type use cases', () => {
        it('should require a usable object', () => {
            testModule = { foo: 'bar' };
            const test = require('testObject');
            expect(test.foo).to.equal('bar');
        });

        it('should require a usable constructor', () => {
            testModule = class {
                constructor(private _name: string) { }
                get name() { return this._name; }
            };
            const test = require('testFunction');
            expect(new test('foo').name).to.equal('foo');
        });

        it('should require a usable function', () => {
            let aReceived;
            let bReceived;
            testModule = (a, b) => {
                aReceived = a;
                bReceived = b;
            };
            const test = require('testFunction');
            test.apply(null, ['foo', 'bar']);
            expect(aReceived).to.equal('foo');
            expect(bReceived).to.equal('bar');
        });

        it('should require an object that allows properties to be defined', () => {
            testModule = {};
            const test = require('testObject');

            Object.defineProperties(test, {
                foo: {
                    configurable: true,
                    value: 'foo-value'
                },
                bar: {
                    enumerable: true,
                    value: 'bar-value'
                },
                baz: {
                    writable: true,
                    value: 'baz-value'
                }
            });

            const fooDesc = Object.getOwnPropertyDescriptor(testModule, 'foo')!;
            expect(fooDesc.configurable).to.be.true;
            expect(fooDesc.enumerable).to.be.false;
            expect(fooDesc.writable).to.be.false;
            expect(test.foo).to.equal('foo-value');

            const barDesc = Object.getOwnPropertyDescriptor(testModule, 'bar')!;
            expect(barDesc.configurable).to.be.false;
            expect(barDesc.enumerable).to.be.true;
            expect(barDesc.writable).to.be.false;
            expect(test.bar).to.equal('bar-value');

            const bazDesc = Object.getOwnPropertyDescriptor(testModule, 'baz')!;
            expect(bazDesc.configurable).to.be.false;
            expect(bazDesc.enumerable).to.be.false;
            expect(bazDesc.writable).to.be.true;
            expect(test.baz).to.equal('baz-value');
        });

        it('should require an object that disallows already non-configurable properties from being defined', () => {
            testModule = {};
            Object.defineProperty(testModule, 'foo', { configurable: false, value: 'bar' });
            const test = require('testObject');
            expect(() => Object.defineProperty(test, 'foo', { value: 'baz' })).to.throw(TypeError);
        });

        it('should require an object that allows property deletion', () => {
            testModule = { foo: 'bar' };
            const test = require('testObject');
            expect(test.foo).to.equal('bar');
            expect(delete test.foo).to.be.true;
            expect(test.foo).to.be.undefined;
        });

        it('should require an object that does not allow property deletion for a non-configurable property', () => {
            testModule = {};
            Object.defineProperty(testModule, 'foo', { configurable: false, value: 'bar' });
            const test = require('testObject');
            expect(test.foo).to.equal('bar');
            expect(() => delete test.foo).to.throw(TypeError);
        });

        it('should require an object with a usable property getter', () => {
            testModule = new (class {
                get name() { return 'foo'; }
            })();
            const test = require('testObject');
            expect(test.name).to.equal('foo');
        });

        it('should require an object with a functioning, non-enumerable toString', () => {
            testModule = { foo: 'bar' };
            Object.defineProperty(testModule, 'toString', {
                enumerable: false,
                value() {
                    return JSON.stringify(testModule);
                }
            });
            const test = require('testObject');
            expect(Object.keys(test)).to.deep.equal(['foo']);
            expect(test.toString()).to.equal('{"foo":"bar"}');
        });

        it('should require an object that satisfies invariant constraints', () => {
            testModule = {};
            const test = require('testObject');
            // properties that are non-configurable, non-writable and discoverable via Object.getOwnPropertyNames
            // must return a value; since the proxy target is actually a function, this means that we must minimally
            // support returning valid values for function properties that match these criteria, even if they do not
            // exist on the proxied module
            expect(test.arguments).to.be.undefined;
            expect(test.caller).to.be.undefined;
        });

        it('should require an object with a functioning, non-enumerable toString that accepts args', () => {
            testModule = { foo: 'bar' };
            Object.defineProperty(testModule, 'toString', {
                enumerable: false,
                value(key) {
                    return testModule[key];
                }
            });
            const test = require('testObject');
            expect(Object.keys(test)).to.deep.equal(['foo']);
            expect(test.toString('foo')).to.equal('bar');
        });

        it('should require an object that returns appropriate property descriptors', () => {
            testModule = {};
            Object.defineProperties(testModule, {
                foo: {
                    configurable: true,
                    value: 'foo-value'
                },
                bar: {
                    enumerable: true,
                    value: 'bar-value'
                },
                baz: {
                    writable: true,
                    value: 'baz-value'
                }
            });

            const test = require('testObject');

            const fooDesc = Object.getOwnPropertyDescriptor(test, 'foo')!;
            expect(fooDesc.configurable).to.be.true;
            expect(fooDesc.enumerable).to.be.false;
            expect(fooDesc.writable).to.be.false;
            expect(test.foo).to.equal('foo-value');

            const barDesc = Object.getOwnPropertyDescriptor(test, 'bar')!;
            // note: skipping check of configurable value, since the proxy intentionally lies about it
            expect(barDesc.enumerable).to.be.true;
            expect(barDesc.writable).to.be.false;
            expect(test.bar).to.equal('bar-value');

            const bazDesc = Object.getOwnPropertyDescriptor(test, 'baz')!;
            // note: skipping check of configurable value, since the proxy intentionally lies about it
            expect(bazDesc.enumerable).to.be.false;
            expect(bazDesc.writable).to.be.true;
            expect(test.baz).to.equal('baz-value');
        });

        it('should require an object with a prototype chain', () => {
            class A { }
            class B extends A { }
            class C extends B { }
            testModule = C;
            const test = require('testFunction');
            const instance = new test();
            expect(instance).is.instanceOf(A);
            expect(instance).is.instanceOf(B);
            expect(instance).is.instanceOf(C);
        });

        it('should require an object with enumerable properties', () => {
            testModule = { a: 'a', b: 'b', c: 'c' };
            const test = require('testObject');
            expect('a' in test).to.be.true;
            expect('b' in test).to.be.true;
            expect('c' in test).to.be.true;
            expect('d' in test).to.be.false;
        });

        it('should require an object that accurately reports that it is extensible', () => {
            testModule = { foo: 'bar' };
            const test = require('testObject');
            expect(Object.isExtensible(test)).to.be.true;
        });

        it('should require an object that accurately reports that it is not extensible', () => {
            testModule = { foo: 'bar' };
            Object.freeze(testModule);
            const test = require('testObject');
            expect(Object.isExtensible(test)).to.be.false;
        });

        it('should require a function that accurately reports its own keys', () => {
            // `function(){}` returns different keys than `()=>{}` and we need to match the proxy target type
            // tslint:disable-next-line:only-arrow-functions
            testModule = function () { };
            testModule.foo = 'bar';
            const test = require('testFunction');
            const testKeys = Reflect.ownKeys(test).map((k) => k.toString()).sort();
            expect(testKeys).to.deep.equal([
                'foo',
                'length',
                'name',
                'prototype'
            ]);
        });

        it('should require an object that allows normal properties to be set', () => {
            testModule = {};
            const test = require('testObject');
            test.foo = 'bar';
            expect(test.foo).to.equal('bar');
            expect(testModule.foo).to.equal('bar');
        });

        it('should require an object that does not allow non-writable properties to be set', () => {
            testModule = {};
            Object.defineProperty(testModule, 'foo', {
                writable: false,
                value: 'bar'
            });
            const test = require('testObject');
            expect(test.foo).to.equal('bar');
            expect(testModule.foo).to.equal('bar');
            expect(() => test.foo = 'baz').to.throw(TypeError);
        });

        it('should require an object that allows its prototype to be set', () => {
            testModule = {};
            const test = require('testObject');
            Object.setPrototypeOf(test, { foo: 'bar' });
            expect(test.foo).to.be.equal('bar');
        });
    });

    describe('module type cache', () => {
        it('should accurately report typeof tests', () => {
            testModule = 'foo';
            const test = require('testString');
            expect(test.toString()).to.equal('foo');
            expect(typeof test).to.equal('string');
        });
    });

    describe('known limitations', () => {
        it('should fail to allow object freezing', () => {
            // the algorithm backing Object.freeze on a proxied object is complex, and the fact that
            // we can have type mismatches between the target function and proxied module (which is often not
            // a function like the target) of type function, means that satisfying the extensive invariant
            // constraints of the algorithm while supporting all of our other use cases cleanly is at best
            // quite difficult, and at worst perhaps impossible; fortunately, freezing a module after it is
            // required appears to be a very rare use case, if it occurs at all
            testModule = { foo: 'bar' };
            const test = require('testObject');
            expect(() => Object.freeze(test)).to.throw(TypeError);
        });

        it('should lie about the configurability of properties that do not exist on the proxy target', () => {
            // to satisfy property invariant constraints between the proxy target and underlying module, whose
            // types do not always match, the proxy handler lies about the configurability of properties defined
            // on the module, always asserting that they are configurable; this is accounted for later by rejecting
            // deletions of the property if the underlying module's corresponding property is non-configurable
            testModule = {};
            Object.defineProperty(testModule, 'foo', {
                configurable: false,
                enumerable: true,
                writable: true,
                value: 'bar'
            });

            const test = require('testObject');

            const fooDesc = Object.getOwnPropertyDescriptor(test, 'foo')!;
            expect(fooDesc.configurable).to.be.true; // lie!
            expect(fooDesc.enumerable).to.be.true;
            expect(fooDesc.writable).to.be.true;
            expect(test.foo).to.equal('bar');
            // now, also make sure we can't delete it, despite the lie about its configurability
            expect(() => delete test.foo).to.throw(TypeError);
        });

        it('may lie about the configurability of properties that exist on both the module and the proxy target', () => {
            // to satisfy property invariant constraints between the proxy target and underlying module, whose
            // types do not always match, the proxy handler may lie about the configurability of properties defined
            // on both the module and the proxy target, always asserting the configurability of the target's property;
            // if the assertion is that a non-configurable module property is configurable, this is accounted for
            // later by rejecting deletions of the property from the module
            testModule = {};
            Object.defineProperties(testModule, {
                arguments: {
                    configurable: true,
                    value: null
                },
                length: {
                    configurable: false,
                    value: 0
                }
            });

            const test = require('testObject');

            const argsDesc = Object.getOwnPropertyDescriptor(test, 'arguments')!;
            expect(argsDesc.configurable).to.be.true;
            expect(argsDesc.enumerable).to.be.false;
            expect(argsDesc.writable).to.be.false;
            expect(test.arguments).to.be.null;

            expect(delete test.arguments).to.be.true;

            const lenDesc = Object.getOwnPropertyDescriptor(test, 'length')!;
            expect(argsDesc.configurable).to.be.true; // lie!
            expect(lenDesc.enumerable).to.be.false;
            expect(lenDesc.writable).to.be.false;
            expect(test.length).to.equal(0);

            expect(() => delete test.length).to.throw(TypeError);
        });
    });

});
