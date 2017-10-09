import * as _ from 'lodash';
import * as child_process from 'child_process';
import * as sinon from 'sinon';
import * as events from 'events';
import { Readable, Writable } from 'stream';
import * as fs from 'fs';
import * as request from 'request' ;
import { TEST_DATA, TEST_DATA_SIGNATURE, CERTIFICATE } from './testCert';
import * as https from 'https';
import { SALESFORCE_CERT_FINGERPRINT } from './codeSignApi';
import { expect } from 'chai';

let iv: any;

class YarnEmitter extends events.EventEmitter {
    private _stdout: Readable;
    private _stderr: Readable;

    constructor() {
        super();
        this._stdout = new Readable({
            read() { this.push(null); }
        });

        this._stderr = new Readable({
            read() { this.push(null); }
        });
    }

    public get stdout(): Readable {
        return this._stdout;
    }

    public set stdout(value: Readable) {
        const obj = _.merge(value, { setEncoding(encoding: string) {} });
        this._stdout = obj;
    }

    public get stderr(): Readable {
        return this._stderr;
    }

    public set stderr(value: Readable) {
        this._stderr = _.merge(value, { setEncoding(encoding: string) {} });
    }
}

class SocketEmitter extends events.EventEmitter {
    public getPeerCertificate() {
        return { fingerprint: SALESFORCE_CERT_FINGERPRINT };
    }
}

class HttpRequestMock {
    private _statusCodeCallback: any;

    public set statusCodeCallback(cb: any) {
        this._statusCodeCallback = cb;
    }

    public get(url: any) {
        let response: Readable = new Readable();
        if (_.includes(url.path, 'cert')) {
            response = new Readable({
                read() {
                    this.push(CERTIFICATE);
                    this.push(null);
                }
            });
        }

        if (_.includes(url.path, 'sig')) {
            response = new Readable({
                read() {
                    this.push(TEST_DATA_SIGNATURE);
                    this.push(null);
                }
            });
        }

        // Assume successful response
        _.set(response, 'statusCode', 200);

        // unless statusCodeCallback is specified then ask the test to supply for a given url;
        if (this._statusCodeCallback) {
            const responseStatusCode = this._statusCodeCallback();
            if (_.includes(responseStatusCode.url, url.path)) {
                _.set(response, 'statusCode', responseStatusCode.code);
            }
        }
        const _request = new events.EventEmitter();
        process.nextTick(() => {
            const _socket = new SocketEmitter();
            _request.emit('socket', _socket);
            _socket.emit('secureConnect');
            _request.emit('response', response);
        });

        return _request;
    }
}

const YARN_META = {
    data: {
        dist: {
            tarball: 'https://example.com/tarball'
        },
        sfdx: {
            publicKeyUrl: 'https://developer.salesforce.com/cert',
            signatureUrl: 'https://developer.salesforce.com/sig'
        }
    }
};

const getYarnSuccess = (yarnEmitter: YarnEmitter) => {
    return new Readable({
        read() {
            this.push(JSON.stringify(YARN_META));
            this.push(null);

            process.nextTick(() => {
                yarnEmitter.emit('close', 0);
            });
        }
    });
};

describe('InstallationVerification Tests', () => {
    let sandbox: any;

    const config = {
        get dataDir() {
            return 'dataPath';
        },
        get cacheDir() {
            return 'cacheDir';
        },
        get configDir() {
            return 'configDir';
        }
    };

    const plugin = 'foo';

    let yarnEmitter = new YarnEmitter();
    const httpMock: HttpRequestMock = new HttpRequestMock();

    let fsReadFileFunc;

    before(() => {
        sandbox = sinon.sandbox.create();
        sandbox.stub(child_process, 'fork').callsFake(() => {
            return yarnEmitter;
         });

        sandbox.stub(https, 'get').callsFake((url: string) => {
            return httpMock.get(url);
        });

        sandbox.stub(fs, 'createReadStream').callsFake((path: string) => {
            return new Readable({
                read() {
                    if (_.includes(path, 'tarball')) {
                        this.push(TEST_DATA);
                    }
                    this.push(null);
                }
            });
        });

        sandbox.stub(fs, 'createWriteStream').callsFake(() => {
            return new Writable({
                write() {}
            });
        });

        sandbox.stub(fs, 'open').callsFake(() => {
            return 5;
        });

        sandbox.stub(request, 'get').callsFake(() => {});

        sandbox.stub(fs, 'readFile').callsFake((path, cb) => {
            try {
                cb(undefined, fsReadFileFunc(path));
            } catch (err) {
                cb(fsReadFileFunc(err));
            }
        });

        iv = require('./installationVerification');
    });

    after(() => {
        sandbox.restore();
    });

    it('Steel thread test', async () => {
        yarnEmitter.stdout = getYarnSuccess(yarnEmitter);

        const verification = new iv.InstallationVerification()
            .setPluginName(plugin).setCliEngineConfig(config);

        return verification.verify()
            .then((meta: any) => {
                expect(meta).to.have.property('verified', true);
            })
            .catch((e) => {
                console.log(e);
            });
    });

    it('Read tarball stream failed', () => {
        const ERROR = 'Ok, who brought the dog? - Louis Tully';
        yarnEmitter.stderr = new Readable({
            read() {
                this.push(ERROR);
                this.push(null);
                process.nextTick(() => {
                    yarnEmitter.emit('close', 1);
                });
            }
        });

        const verification = new iv.InstallationVerification()
        .setPluginName(plugin).setCliEngineConfig(config);

        return verification.verify()
            .then(() => {
                throw new Error('This shouldn\'t happen. Failure expected');
            })
            .catch((err: Error) => {
                expect(err).to.have.property('message', ERROR);
            });
    });

    it ('404 for public key', () => {

        yarnEmitter = new YarnEmitter();
        yarnEmitter.stdout = getYarnSuccess(yarnEmitter);
        httpMock.statusCodeCallback = () => ({
            code: 404,
            url: YARN_META.data.sfdx.publicKeyUrl
        });
        const verification = new iv.InstallationVerification()
            .setPluginName(plugin).setCliEngineConfig(config);

        return verification.verify()
            .then(() => {
                throw new Error('This shouldn\'t happen. Failure expected');
            })
            .catch((err: Error) => {
                expect(err).to.have.property('name', 'RetrieveFailed');
                expect(err.message).to.include('404');
                expect(err.message).to.include('cert');
            });
    });

    it ('500 for signature', () => {

        yarnEmitter = new YarnEmitter();
        yarnEmitter.stdout = getYarnSuccess(yarnEmitter);
        httpMock.statusCodeCallback = () => ({
            code: 500,
            url: YARN_META.data.sfdx.signatureUrl
        });
        const verification = new iv.InstallationVerification()
            .setPluginName(plugin).setCliEngineConfig(config);

        return verification.verify()
            .then(() => {
                throw new Error('This shouldn\'t happen. Failure expected');
            })
            .catch((err: Error) => {
                expect(err).to.have.property('name', 'RetrieveFailed');
                expect(err.message).to.include('500');
                expect(err.message).to.include('sig');
            });
    });

    describe('isWhiteListed', () => {
        it('steel thread', async () => {
            const TEST_VALUE = 'FOO';
            let expectedPath;
            fsReadFileFunc = (path) => {
                expectedPath = path;
                return `["${TEST_VALUE}"]`;
            };
            const verification = new iv.InstallationVerification()
                .setPluginName(TEST_VALUE).setCliEngineConfig(config);
            expect(await verification.isWhiteListed()).to.be.equal(true);
            expect(expectedPath).to.include(iv.WHITELIST_FILENAME);
        });

        it('file doesn\'t exist', async () => {
            fsReadFileFunc = (path) => {
                const error = new Error();
                (error as any).code = 'ENOENT';
                throw error;
            };
            const verification = new iv.InstallationVerification()
                .setPluginName('BAR').setCliEngineConfig(config);
            expect(await verification.isWhiteListed()).to.be.equal(false);
        });
    });

    describe('doInstallationCodeSigningVerification', () => {
        it ('valid signature', async () => {
            let message = '';
            const vConfig = new iv.VerificationConfig();
            vConfig.verifier = {
                async verify() {
                    return {
                        verified: true
                    };
                }
            };

            vConfig.log = (_message) => {
                message = _message;
            };

            await iv.doInstallationCodeSigningVerification({}, {}, vConfig);
            expect(message).to.include('Successfully');
            expect(message).to.include('digital signature');
        });

        it ('FailedDigitalSignatureVerification', () => {
            const vConfig = new iv.VerificationConfig();
            vConfig.verifier = {
                async verify() {
                    return {
                        verified: false
                    };
                }
            };

            return iv.doInstallationCodeSigningVerification({}, {}, vConfig).catch((err) => {
                expect(err).to.have.property('name', 'FailedDigitalSignatureVerification');
            });
        });

        it ('Canceled by user', () => {
            const vConfig = new iv.VerificationConfig();
            vConfig.verifier = {
                async verify() {
                    const err = new Error();
                    err.name = 'NotSigned';
                    throw err;
                },
                async isWhiteListed() {
                    return false;
                }
            };

            vConfig.prompt = async () => {
                return 'N';
            };

            return iv.doInstallationCodeSigningVerification({}, {}, vConfig)
                .then(() => {
                    throw new Error('Failure: This should never happen');
                })
                .catch((err) => {
                    expect(err).to.have.property('name', 'CanceledByUser');
                });
        });

        it ('continue installation', () => {
            const vConfig = new iv.VerificationConfig();
            vConfig.verifier = {
                async verify() {
                    const err = new Error();
                    err.name = 'UnexpectedHost';
                    throw err;
                },
                async isWhiteListed() {
                    return false;
                }
            };

            vConfig.prompt = async () => {
                return 'Y';
            };

            return iv.doInstallationCodeSigningVerification({}, {}, vConfig)
                .then(() => {
                    throw new Error('Failure: This should never happen');
                })
                .catch((err) => {
                    expect(err).to.have.property('name', 'UnexpectedHost');
                });
        });
    });
});
