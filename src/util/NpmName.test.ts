import { NpmName } from './NpmName';
import { expect } from 'chai';
import {getNpmRegistry} from '../codeSigning/installationVerification';

describe('NpmName Tests', () => {
    describe('parse', () => {
        it ('empty name should throw', () => {
            expect(() => NpmName.parse('')).to.throw().and.have.property('name', 'MissingOrInvalidNpmName');
        });

        it ('just name is allowed', () => {
            const npmName: NpmName = NpmName.parse('foo');
            expect(npmName).to.have.property('name', 'foo');
            expect(npmName).to.have.property('tag', 'latest');
            expect(npmName).to.not.have.property('scope');
        });

        it ('scope and name are allowed', () => {
            const npmName: NpmName = NpmName.parse('@test/foo');
            expect(npmName).to.have.property('name', 'foo');
            expect(npmName).to.have.property('scope', 'test');
            expect(npmName).to.have.property('tag', 'latest');
        });

        it ('scope and name are allowed', () => {
            const npmName: NpmName = NpmName.parse('@test/foo@1.2.3');
            expect(npmName).to.have.property('name', 'foo');
            expect(npmName).to.have.property('scope', 'test');
            expect(npmName).to.have.property('tag', '1.2.3');
        });

        it ('just a scope isn\'t allowed', () => {
            expect(() => NpmName.parse('@test ')).to.throw().and.have.property('name', 'MissingNameForScope');
        });

        it ('Scope without a name isn\'t allowd', () => {
            expect(() => NpmName.parse('@test/ ')).to.throw().and.have.property('name', 'InvalidNpmName');
        });

        it ('Should parse heroku style package name', () => {
            const npmName: NpmName = NpmName.parse('salesforce/foo');
            expect(npmName).to.have.property('scope', 'salesforce');
            expect(npmName).to.have.property('name', 'foo');
        });

    });

    describe('toFilename', () => {
        it ('Should return .tgz', () => {
            const npmName: NpmName = NpmName.parse('@test/foo@1.2.3');
            expect(npmName.toFilename()).to.be.equal('test-foo-1.2.3.tgz');
        });

        it ('Should return .tgz', () => {
            const npmName: NpmName = NpmName.parse('@test/foo@1.2.3');
            expect(npmName.toFilename('.tgz')).to.be.equal('test-foo-1.2.3.tgz');
        });

        it ('Should return .sig', () => {
            const npmName: NpmName = NpmName.parse('@test/foo@1.2.3');
            expect(npmName.toFilename('.sig')).to.be.equal('test-foo-1.2.3.sig');
        });
    });
});
