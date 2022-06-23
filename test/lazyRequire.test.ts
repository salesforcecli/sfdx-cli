/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
// the below, there's lots of un-awaited promises for testing
/* eslint-disable no-unused-expressions*/
/* eslint-disable @typescript-eslint/require-await*/

import { join, sep } from 'path';
import { Config } from '@oclif/core';
import LazyRequire from '@salesforce/lazy-require';
import { StubbedCallableType, StubbedType, stubCallable, stubInterface } from '@salesforce/ts-sinon';
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as mod from '../src/lazyRequire';

describe('lazyRequire', () => {
  let sandbox: sinon.SinonSandbox;
  let config: Config;
  let mock: StubbedType<LazyRequire>;
  let create: StubbedCallableType<typeof LazyRequire.create>;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - you cannot pass a StubInterface<Config> as a Config into methods below
    config = stubInterface<Config>(sandbox, {
      cacheDir: '/test',
    });

    mock = stubInterface<LazyRequire>(sandbox);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    create = stubCallable(sandbox, LazyRequire.create, () => mock);
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    delete mod.lazyRequire;
  });

  it('should cache instances of the lazy require class', () => {
    mod.start(config, create);
    expect(create.calledOnce).to.be.true;
    const callPath = `${sep}${join('test', 'module-types.json')}`;
    expect(create.calledWith(callPath), callPath).to.be.true;
    expect(mod.lazyRequire).to.equal(mock);
    mod.start(config, create);
    expect(create.calledOnce).to.be.true;
    expect(mod.lazyRequire).to.equal(mock);
  });

  it('should start the lazy require instance', () => {
    mod.start(config, create);
    expect(mock.start.calledOnce).to.be.true;
  });

  it("should reset the lazy require instance's type cache file", () => {
    mod.resetTypeCache(config, create);
    expect(mock.resetTypeCache.calledOnce).to.be.true;
  });
});
