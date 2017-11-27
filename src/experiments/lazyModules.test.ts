/* tslint:disable:no-unused-expression */
import { expect } from 'chai';
import { sandbox as Sandbox } from 'sinon';
import Module = require('module');
import * as lazy from './lazyModules';

describe('lazy module loader', () => {
    let sandbox;
    let testModule;
    let wasEnabled;
    let lazyLoadTime;
    let realLoadTime;

    before(() => {
        wasEnabled = lazy.isEnabled();
        if (wasEnabled) {
            lazy.disable();
        }
    });

    after(() => {
        if (wasEnabled) {
            lazy.enable();
        }
    });

    beforeEach(() => {
        sandbox = Sandbox.create();
        sandbox.stub(lazy, '_excludesRe').value(/^(?:.+\.json|excluded)$/);
        lazyLoadTime = Date.now();
        sandbox.stub(Module, '_load').callsFake((request, parent, isMain) => {
            realLoadTime = Date.now();
            return testModule;
        });
        sandbox.stub(Module, '_resolveFilename').callsFake((request) => {
            return `/some/path/to/${request}.js`;
        });
        lazy.enable();
        expect(lazy.isEnabled()).to.be.true;
    });

    afterEach(() => {
        lazy.disable();
        expect(lazy.isEnabled()).to.be.false;
        sandbox.restore();
    });

    describe('basic behaviors', () => {
        it('should return proxy objects', () => {
            testModule = { foo: 'bar' };
            const test = require('test');
            expect(test.foo).to.equal('bar');
            // an easy way to test that the module is a proxy in this case is to observe that `typeof`
            // yields 'function' rather than 'object', according to the origin module type; see the
            // 'known limitations' tests for more information
            expect(typeof test).to.equal('function');
        });

        it('should lazy load modules', (done) => {
            testModule = { foo: 'bar' };
            lazyLoadTime = Date.now();
            const test = require('test');
            setTimeout(() => {
                expect(test.foo).to.equal('bar');
                expect(realLoadTime - lazyLoadTime).to.be.gte(100);
                done();
            }, 100);
        });

        it('should immediately load excluded modules', (done) => {
            testModule = { foo: 'bar' };
            lazyLoadTime = Date.now();
            const test = require('excluded');
            setTimeout(() => {
                expect(test.foo).to.equal('bar');
                expect(realLoadTime - lazyLoadTime).to.be.lte(100);
                done();
            }, 100);
        });

        it('should immediately load json files', (done) => {
            testModule = '{"foo": "bar"}';
            lazyLoadTime = Date.now();
            const test = require('test.json');
            setTimeout(() => {
                expect(typeof test).to.equal('string');
                expect(test).to.equal('{"foo": "bar"}');
                expect(realLoadTime - lazyLoadTime).to.be.lte(100);
                const parsed = JSON.parse(test);
                expect(parsed.foo).to.equal('bar');
                done();
            }, 100);
        });

        it('should require an object that is cached idempotently', () => {
            testModule = { foo: 'bar' };
            const test = require('test');
            const test2 = require('test');
            expect(test).to.equal(test2);
        });
    });

    describe('module type use cases', () => {
        it('should require a usable object', () => {
            testModule = { foo: 'bar' };
            const test = require('test');
            expect(test.foo).to.equal('bar');
        });

        it('should require a usable constructor', () => {
            testModule = class {
                constructor(private _name: string) { }
                get name() { return this._name; }
            };
            const test = require('test');
            expect(new test('foo').name).to.equal('foo');
        });

        it('should require a usable function', () => {
            let aReceived;
            let bReceived;
            testModule = (a, b) => {
                aReceived = a;
                bReceived = b;
            };
            const test = require('test');
            test.apply(null, ['foo', 'bar']);
            expect(aReceived).to.equal('foo');
            expect(bReceived).to.equal('bar');
        });

        it('should require an object that allows properties to be defined', () => {
            testModule = {};
            const test = require('test');

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

            const fooDesc = Object.getOwnPropertyDescriptor(testModule, 'foo');
            expect(fooDesc.configurable).to.be.true;
            expect(fooDesc.enumerable).to.be.false;
            expect(fooDesc.writable).to.be.false;
            expect(test.foo).to.equal('foo-value');

            const barDesc = Object.getOwnPropertyDescriptor(testModule, 'bar');
            expect(barDesc.configurable).to.be.false;
            expect(barDesc.enumerable).to.be.true;
            expect(barDesc.writable).to.be.false;
            expect(test.bar).to.equal('bar-value');

            const bazDesc = Object.getOwnPropertyDescriptor(testModule, 'baz');
            expect(bazDesc.configurable).to.be.false;
            expect(bazDesc.enumerable).to.be.false;
            expect(bazDesc.writable).to.be.true;
            expect(test.baz).to.equal('baz-value');
        });

        it('should require an object that disallows already non-configurable properties from being defined', () => {
            testModule = {};
            Object.defineProperty(testModule, 'foo', { configurable: false, value: 'bar' });
            const test = require('test');
            expect(() => Object.defineProperty(test, 'foo', { value: 'baz' })).to.throw(TypeError);
        });

        it('should require an object that allows property deletion', () => {
            testModule = { foo: 'bar' };
            const test = require('test');
            expect(test.foo).to.equal('bar');
            expect(delete test.foo).to.be.true;
            expect(test.foo).to.be.undefined;
        });

        it('should require an object that does not allow property deletion for a non-configurable property', () => {
            testModule = {};
            Object.defineProperty(testModule, 'foo', { configurable: false, value: 'bar' });
            const test = require('test');
            expect(test.foo).to.equal('bar');
            expect(() => delete test.foo).to.throw(TypeError);
        });

        it('should require an object with a usable property getter', () => {
            testModule = new (class {
                get name() { return 'foo'; }
            })();
            const test = require('test');
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
            const test = require('test');
            expect(Object.keys(test)).to.deep.equal(['foo']);
            expect(test.toString()).to.equal('{"foo":"bar"}');
        });

        it('should require an object that satisfies invariant constraints', () => {
            testModule = {};
            const test = require('test');
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
            const test = require('test');
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

            const test = require('test');

            const fooDesc = Object.getOwnPropertyDescriptor(test, 'foo');
            expect(fooDesc.configurable).to.be.true;
            expect(fooDesc.enumerable).to.be.false;
            expect(fooDesc.writable).to.be.false;
            expect(test.foo).to.equal('foo-value');

            const barDesc = Object.getOwnPropertyDescriptor(test, 'bar');
            // note: skipping check of configurable value, since the proxy intentionally lies about it
            expect(barDesc.enumerable).to.be.true;
            expect(barDesc.writable).to.be.false;
            expect(test.bar).to.equal('bar-value');

            const bazDesc = Object.getOwnPropertyDescriptor(test, 'baz');
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
            const test = require('test');
            const instance = new test();
            expect(instance).is.instanceOf(A);
            expect(instance).is.instanceOf(B);
            expect(instance).is.instanceOf(C);
        });

        it('should require an object with enumerable properties', () => {
            testModule = { a: 'a', b: 'b', c: 'c' };
            const test = require('test');
            expect('a' in test).to.be.true;
            expect('b' in test).to.be.true;
            expect('c' in test).to.be.true;
            expect('d' in test).to.be.false;
        });

        it('should require an object that accurately reports that it is extensible', () => {
            testModule = { foo: 'bar' };
            const test = require('test');
            expect(Object.isExtensible(test)).to.be.true;
        });

        it('should require an object that accurately reports that it is not extensible', () => {
            testModule = { foo: 'bar' };
            Object.freeze(testModule);
            const test = require('test');
            expect(Object.isExtensible(test)).to.be.false;
        });

        it('should require a function that accurately reports its own keys', () => {
            // `function(){}` returns different keys than `()=>{}` and we need to match the proxy target type
            // tslint:disable-next-line:only-arrow-functions
            testModule = function() { };
            testModule.foo = 'bar';
            const test = require('test');
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
            const test = require('test');
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
            const test = require('test');
            expect(test.foo).to.equal('bar');
            expect(testModule.foo).to.equal('bar');
            expect(() => test.foo = 'baz').to.throw(TypeError);
        });

        it('should require an object that allows its prototype to be set', () => {
            testModule = {};
            const test = require('test');
            Object.setPrototypeOf(test, { foo: 'bar' });
            expect(test.foo).to.be.equal('bar');
        });
    });

    describe('known limitations', () => {
        it('should fail to trap typeof tests', () => {
            // proxies do not trap `typeof` operations, unfortunately; for example, a string module
            // will still yield `typeof module === 'function'`; the only solution to this that I can
            // imagine is to change the lazy module loader to act in more of a caching fashion,
            // wherein the first time a module is required, it is done so normally, but the type of the
            // module (at its fully resolved path) is recorded in a file for future use; proxies would
            // then be able to instantiate the correct type for a module it was about to create...
            // that said, the time to load and parse a cache file that large would probably defeat the
            // value of the lazy loader, and in practice this is a problem in only a few, rare cases that
            // we can easily exclude from the set of modules to be lazy loaded
            testModule = 'foo';
            const test = require('test');
            expect(test.toString()).to.equal('foo');
            expect(typeof test).to.equal('function');
        });

        it('should fail to allow object freezing', () => {
            // the algorithm backing Object.freeze on a proxied object is complex, and the fact that
            // we can have type mismatches between the target function and proxied module (which is often not
            // a function like the target) of type function, means that satisfying the extensive invariant
            // constraints of the algorithm while supporting all of our other use cases cleanly is at best
            // quite difficult, and at worst perhaps impossible; fortunately, freezing a module after it is
            // required appears to be a very rare use case, if it occurs at all
            testModule = { foo: 'bar' };
            const test = require('test');
            expect(() => Object.freeze(test)).to.throw(TypeError);
        });

        it('should require an object that reports its own keys along with target keys to satisfy invariant constraints', () => {
            // in order to satisfy property invariant constraints for several proxied operations, both the
            // target and proxied module property names must be returned when the proxied module is not of
            // type function
            testModule = { foo: 'bar' };
            // tslint:disable-next-line:only-arrow-functions
            const test = require('test');
            const testKeys = Reflect.ownKeys(test).sort();
            expect(testKeys).to.deep.equal([
                'foo',
                'prototype'
            ]);
        });

        it('should require a string that reports the target keys that satisfy invariant constraints', () => {
            // in order to satisfy property invariant constraints for several proxied operations, both the
            // target and proxied module property names must be returned when the proxied module is not of
            // type function
            testModule = 'foo';
            const test = require('test');
            const keys = Object.getOwnPropertyNames(test);
            expect(keys).to.deep.equal(['prototype']);
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

            const test = require('test');

            const fooDesc = Object.getOwnPropertyDescriptor(test, 'foo');
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

            const test = require('test');

            const argsDesc = Object.getOwnPropertyDescriptor(test, 'arguments');
            expect(argsDesc.configurable).to.be.true;
            expect(argsDesc.enumerable).to.be.false;
            expect(argsDesc.writable).to.be.false;
            expect(test.arguments).to.be.null;

            expect(delete test.arguments).to.be.true;

            const lenDesc = Object.getOwnPropertyDescriptor(test, 'length');
            expect(argsDesc.configurable).to.be.true; // lie!
            expect(lenDesc.enumerable).to.be.false;
            expect(lenDesc.writable).to.be.false;
            expect(test.length).to.equal(0);

            expect(() => delete test.length).to.throw(TypeError);
        });
    });

});
