/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
// the below, there's lots of un-awaited promises for testing
/* eslint-disable no-unused-expressions*/

import { assert, expect } from 'chai';
import * as sinon from 'sinon';
import { checkNodeVersion, compareVersions, isVersion } from './versions';

describe('versions', () => {
  describe('isVersion', () => {
    it('should recognize valid semantic versions', () => {
      const versions = [
        '0.0.0',
        '0.10.0',
        'v1.0.0',
        '0.0.0-foo',
        '1.2.3-4',
        '2.7.2+bar',
        '1.2.3-a.b.c.10.d.5',
        '2.7.2-foo+bar',
        '1.2.3-alpha.10.beta.0',
        '1.2.3-alpha.10.beta.0+build.unicorn.rainbow',
      ];

      versions.forEach((v) => {
        assert(isVersion(v), v);
      });
    });

    it('should reject invalid semantic versions', () => {
      const versions = ['', '0.88', '1.0.08', '1.08.0', '01.8.0', 'foo 0.0.0 bar 0.0.0'];

      versions.forEach((v) => {
        assert(!isVersion(v), String(v));
      });
    });
  });

  describe('compareVersions', () => {
    it('should handle empty args', () => {
      expect(compareVersions('', '')).to.equal(0);
    });

    it('should return 0 when a and b are both 1.1.1', () => {
      expect(compareVersions('1.1.1', '1.1.1')).to.equal(0);
    });

    it('should show .0 to be the same as the integer value.', () => {
      expect(compareVersions('41', '41.0')).to.be.equal(0);
    });

    it('should show .0 to be the same as the integer value.', () => {
      expect(compareVersions('41.0', '41')).to.be.equal(0);
    });

    it('should return < 0 when a is 41.0 and b is 41.0.1', () => {
      expect(compareVersions('41.0', '41.0.1')).to.be.lessThan(0);
    });

    it('should return <0 when a is 41.0.0.1 and b is 41.0.1', () => {
      expect(compareVersions('41.0.0.1', '41.0.1')).to.be.lessThan(0);
    });

    it('should return < 0 when a is 1.0.1 and b is 1.1.1', () => {
      expect(compareVersions('1.0.1', '1.1.1')).to.be.lessThan(0);
    });

    it('should return > 0 when a is 1.1.1 and b is 1.0.1', () => {
      expect(compareVersions('1.1.1', '1.0.1')).to.be.greaterThan(0);
    });

    it('should return > 0 when a is 2 and b is 1.1.1', () => {
      expect(compareVersions('2', '1.1.1')).to.be.greaterThan(0);
    });

    it('should return > 0 when a is 1.1.1 and b is 2', () => {
      expect(compareVersions('1.1.1', '2')).to.be.lessThan(0);
    });

    it('should ignore dash suffixes', () => {
      expect(compareVersions('1.1.1-2', '2-1.1.1')).to.be.lessThan(0);
    });
  });

  describe('checkNodeVersion', () => {
    let sandbox: sinon.SinonSandbox;
    let exit: sinon.SinonStub;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      exit = sandbox.stub(process, 'exit');
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('should exit on older versions', () => {
      checkNodeVersion('8.0.0', '8.4.0');
      expect(exit.calledOnce).to.be.true;
      expect(exit.getCall(0).args[0]).to.equal(1);
    });

    it('should not exit on the same version', () => {
      checkNodeVersion('8.4.0', '8.4.0');
      expect(exit.calledOnce).to.be.false;
    });

    it('should not exit on newer versions', () => {
      checkNodeVersion('10.0.0', '8.4.0');
      expect(exit.calledOnce).to.be.false;
    });
  });
});
