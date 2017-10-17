import child_process  = require('child_process');
import { EOL } from 'os';
import { Readable } from 'stream';
import fs = require('fs-extra');
import { CERTIFICATE, PRIVATE_KEY, TEST_DATA } from './testCert';
import * as _ from 'lodash';
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as _Promise from 'bluebird';
import * as request from 'request';
import * as events from 'events';

const _getCertResponse = (path: string) => {
    const response = new Readable({
        read() {
            this.push(CERTIFICATE);
            this.push(null);
        }
    });
    (response as any).statusCode = 200;
    const requestEmitter =  new events.EventEmitter();

    process.nextTick(() => {
        requestEmitter.emit('response', response);
    });

    return requestEmitter;
};

let packAndSignApi: any;

const REJECT_ERROR = new Error('Should have been rejected');

describe('doPackAndSign', () => {
    let globalSandbox: any;

    const logMessages = [];
    before(() => {
        globalSandbox = sinon.sandbox.create();
        let signature: string;

        globalSandbox.stub(console, 'log');
        globalSandbox.stub(console, 'info');

        globalSandbox.stub(fs, 'copy').callsFake((src: string, dest: string, cb: any) => {
            cb(null, {});
        });

        globalSandbox.stub(fs, 'writeFile').callsFake((path: string, content: string, cb: any) => {
            if (_.includes(path, '.sig')) {
                signature = content;
            }
            cb(null, {});
        });

        globalSandbox.stub(fs, 'createReadStream').callsFake((filePath: string, options: any) => {
            if (_.includes(filePath, 'privateKey')) {
                return new Readable({
                    read() {
                        this.push(PRIVATE_KEY);
                        this.push(null);
                    }
                });

            } else if (_.includes(filePath, 'tgz')) {
                return new Readable({
                    read() {
                        this.push(TEST_DATA);
                        this.push(null);
                    }
                });
            } else {
                return new Readable({
                    read() {
                        this.push(signature);
                        this.push(null);
                    }
                });
            }
        });

        globalSandbox.stub(child_process, 'exec').callsFake((command, cb) => {
            cb(null, `foo.tgz${EOL}`);
        });

        globalSandbox.stub(request, 'get').callsFake((path: any) => {
            return _getCertResponse(path);
        });

        packAndSignApi = require('./packAndSign').api;
    });

    after(() => {
        globalSandbox.restore();
    });

    it ('Steel Thread', () => {
        const flags = {
            signatureUrl: 'https://developer.salesforce.com/signatureUrlValue',
            publicKeyUrl: 'https://developer.salesforce.com/publicKeyUrlValue',
            privateKeyPath: 'privateKeyPathUrl'
        };
        return packAndSignApi.doPackAndSign(flags).then((result: boolean) => {
            expect(result).to.be.equal(true);
        });
    });
});

describe('packAndSign Tests', () => {
    let sandbox: any;

    beforeEach(() => {
        sandbox = sinon.sandbox.create();
    });
    afterEach(() => {
        sandbox.restore();
    });

    describe('pack', () => {
        it('Process Failed', () => {
            sandbox.stub(child_process, 'exec').callsFake((command: string, cb: any) => {
                cb({code: -15});
            });
            return packAndSignApi.pack().then(() => { throw REJECT_ERROR; }).catch((err: Error) => {
                expect(err.message).to.include('code: -15');
                expect(err).to.have.property('reason');
            });
        });

        it('Process Success', () => {
            sandbox.stub(child_process, 'exec').callsFake((command: string, cb: any) => {
                cb(null, `foo.tgz${EOL}`);
            });
            return packAndSignApi.pack().then((path: string) => {
                expect(path).to.be.equal('foo.tgz');
            });
        });

        it('Process path unexpected format', () => {
            sandbox.stub(child_process, 'exec').callsFake((command: string, cb: any) => {
                cb(null, `foo${EOL}`);
            });
            return packAndSignApi.pack().then(() => { throw REJECT_ERROR; }).catch((err: Error) => {
                expect(err.message).to.include('expected tgz');
                expect(err).to.have.property('name', 'UnexpectedNpmFormat');
            });
        });
    });

    /*describe('verify', () => {
        it('verify flow - false', () => {
            let url: any;
            sandbox.stub(request, 'get').callsFake((_url: string) => {
                url = _url;
                return _getCertResponse(_url);
            });

            const tarGz = new Readable({
                read() {
                    this.push('foo');
                    this.push(null);
                }
            });

            const signature = new Readable({
                read() {
                    this.push('bar');
                    this.push(null);
                }
            });

            if (!packAndSignApi) {
                packAndSignApi = require('./packAndSign').api;
            }

            return packAndSignApi.verify(tarGz, signature, 'baz').then((authentic: boolean) => {
                expect(authentic).to.be.equal(false);
                expect(url).to.be.equal('baz');
            });
        });
    });

    describe('validateNpmIgnore', () => {
        it ('no content', () => {
            expect(() => packAndSignApi.validateNpmIgnorePatterns(undefined)).to.throw(Error)
                .and.have.property('name', 'MissingNpmIgnoreFile');
        });

        it ('no tgz', () => {
            expect(() => packAndSignApi.validateNpmIgnorePatterns('')).to.throw('tgz');
        });
        it ('no sig', () => {
            expect(() => packAndSignApi.validateNpmIgnorePatterns('*.tgz')).to.throw('sig');
        });
        it ('no package.json.bak', () => {
            expect(() => packAndSignApi.validateNpmIgnorePatterns('*.tgz*.sig')).to.throw('package.json.bak');
        });
        it ('has expected patterns', () => {
            expect(packAndSignApi.validateNpmIgnorePatterns('*.tgz*.sigpackage.json.bak')).to.be.equal(undefined);
        });
    });*/
});
