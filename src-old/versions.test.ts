import { assert, expect } from 'chai';
import { compareVersions, isVersion } from './versions';

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
            '1.2.3-alpha.10.beta.0+build.unicorn.rainbow'
        ];

        versions.forEach(v => {
            assert(isVersion(v), v);
        });
    });

    it('should reject invalid semantic versions', () => {
        const versions = [
            null,
            '',
            '0.88',
            '1.0.08',
            '1.08.0',
            '01.8.0',
            'foo 0.0.0 bar 0.0.0'
        ];

        versions.forEach(v => {
            assert(!isVersion(v), String(v));
        });
    });
});

describe('compareVersions', () => {
    it('should return 0 when a and b are both 1.1.1', () => {
        expect(compareVersions('1.1.1', '1.1.1')).to.equal(0);
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
