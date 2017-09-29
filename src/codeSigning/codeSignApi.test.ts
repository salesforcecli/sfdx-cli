import {
    CodeSignInfo,
    CodeVerifierInfo,
    verify,
    validateRequestCert,
    validSalesforceDomain,
    default as sign
} from './codeSignApi';

import { Readable, Writable } from 'stream';
import { expect } from 'chai';
import { CERTIFICATE, PRIVATE_KEY, TEST_DATA } from './testCert';
import * as events from 'events';

describe('Sign Tests', () => {

    describe('validSalesforceDomain', () => {
        it ('falsy url', () => {
            expect(validSalesforceDomain(null)).to.be.equal(false);
        });

        it ('salesforce http url', () => {
            expect(validSalesforceDomain('http://www.salesforce.com')).to.be.equal(false);
        });

        it ('salesforce https url', () => {
            expect(validSalesforceDomain('https://www.salesforce.com')).to.be.equal(true);
        });
        it ('jibber', () => {
            expect(validSalesforceDomain('jj')).to.be.equal(false);
        });
    });

    describe('validateRequestCert', () => {
        it ('invalid finger print', () => {
            try {
                class Request extends events.EventEmitter {}
                const request = new Request();

                class Socket extends events.EventEmitter {
                    public getPeerCertificate() {
                        return { fingerprint: '123456' };
                    }
                }
                const socket = new Socket();

                validateRequestCert(request, 'https://www.salesforce.com');
                request.emit('socket', socket);
                socket.emit('secureConnect');
                throw new Error('Shouldn\'t Get Here!');
            } catch (err) {
                expect(err).to.have.property('name', 'CertificateFingerprintNotMatch');
            }
        });
    });

    it ('steel thread',  async () => {

        const info = new CodeSignInfo();

        info.dataToSignStream = new Readable({
            read() {
                this.push(TEST_DATA);
                this.push(null);
            }
        });

        info.privateKeyStream = new Readable({
            read() {
                this.push(PRIVATE_KEY);
                this.push(null);
            }
        });
        const signature = await sign(info).then();

        const verifyInfo = new CodeVerifierInfo();
        verifyInfo.publicKeyStream = new Readable({
            read() {
                this.push(CERTIFICATE);
                this.push(null);
            }
        });

        verifyInfo.signatureStream = new Readable({
            read() {
                this.push(signature);
                this.push(null);
            }
        });

        verifyInfo.dataToVerify = new Readable({
            read() {
                this.push(TEST_DATA);
                this.push(null);
            }
        });

        const valid = await verify(verifyInfo);
        expect(valid).to.be.equal(true);
    });

    it ('invalid private key', async () => {
        const info = new CodeSignInfo();

        info.dataToSignStream = new Readable({
            read() {
                this.push(TEST_DATA);
                this.push(null);
            }
        });

        info.privateKeyStream = new Readable({
            read() {
                this.push('key');
                this.push(null);
            }
        });
        return sign(info)
            .then(() => {
                throw new Error('This should reject');
            })
            .catch((err: any) => {
                expect(err).to.have.property('name', 'InvalidKeyFormat');
            });
    });

    it ('invalid signature', async () => {

        const verifyInfo = new CodeVerifierInfo();
        verifyInfo.publicKeyStream = new Readable({
            read() {
                this.push(CERTIFICATE);
                this.push(null);
            }
        });

        verifyInfo.signatureStream = new Readable({
            read() {
                this.push('');
                this.push(null);
            }
        });

        verifyInfo.dataToVerify = new Readable({
            read() {
                this.push(TEST_DATA);
                this.push(null);
            }
        });

        return verify(verifyInfo)
            .then(() => {
                throw new Error('This should reject');
            })
            .catch((err) => {
                expect(err).to.have.property('name', 'InvalidSignature');
            });
    });
});
