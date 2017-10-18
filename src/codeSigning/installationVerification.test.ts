import * as _ from 'lodash';
import * as child_process from 'child_process';
import * as sinon from 'sinon';
import * as events from 'events';
import { Readable, Writable } from 'stream';
import * as fs from 'fs';
import * as request from 'request';
import { TEST_DATA, TEST_DATA_SIGNATURE, CERTIFICATE } from './testCert';
import { SALESFORCE_CERT_FINGERPRINT } from './codeSignApi';
import { expect } from 'chai';
import {
    doInstallationCodeSigningVerification,
    InstallationVerification,
    WHITELIST_FILENAME,
    VerificationConfig,
    getNpmRegistry,
    DEFAULT_REGISTRY
} from './installationVerification';

class NpmEmitter extends events.EventEmitter {
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

const NPM_META = {
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

const getNpmSuccess = (npmEmitter: NpmEmitter) => {
    return new Readable({
        read() {
            this.push(JSON.stringify(NPM_META));
            this.push(null);

            process.nextTick(() => {
                npmEmitter.emit('close', 0);
            });
        }
    });
};

describe('getNpmRegistry', () => {
    const currentRegistry = process.env.SFDX_NPM_REGISTRY;
    after(() => {
        if (currentRegistry) {
            process.env.SFDX_NPM_REGISTRY = currentRegistry;
        }
    });
    it ('set registry', () => {
        const TEST_REG = 'https://registry.example.com/';
        process.env.SFDX_NPM_REGISTRY = TEST_REG;
        const reg = getNpmRegistry();
        expect(reg.href).to.be.equal(TEST_REG);
    });
    it ('default registry', () => {
        delete process.env.SFDX_NPM_REGISTRY;
        const reg = getNpmRegistry();
        expect(reg.href).to.be.equal(DEFAULT_REGISTRY);
    });
});

describe('InstallationVerification Tests', () => {

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

    it('falsy engine config', () => {
        expect(() => new InstallationVerification().setCliEngineConfig(null)).to.throw(Error).and.have.property('name', 'InvalidParam');
    });

    it ('falsy plugin name', () => {
        expect(() => new InstallationVerification().setPluginName()).to.throw(Error).and.have.property('name', 'InvalidParam');
    });

    it ('default plugin name', () => {
        const verification = new InstallationVerification().setPluginTag();
        expect(verification.getPluginTag()).to.be.equal('latest');
    });

    it('Steel thread test', async () => {
        const _request = (url, cb) => {
            if (_.includes(url, 'foo.tgz')) {
                const reader = new Readable({
                    read() {}
                });
                process.nextTick(() => {
                    reader.emit('end');
                });
                return reader;
            } else if (_.includes(url, 'sig')) {
                cb(null, { statusCode: 200 }, TEST_DATA_SIGNATURE);
            } else if (_.includes(url, 'key')) {
                cb(null, { statusCode: 200 }, CERTIFICATE);
            } else {
                cb(null, { statusCode: 200 }, JSON.stringify({
                    'versions': {
                        '1.2.3': {
                            sfdx: {
                                publicKeyUrl: 'https://developer.salesforce.com/key',
                                signatureUrl: 'https://developer.salesforce.com/sig'
                            },
                            dist: {
                                tarball: 'https://registry.example.com/foo.tgz'
                            }
                        }
                    },
                    'dist-tags': {
                        latest: '1.2.3'
                    }
                }));
            }
        };

        const _fs = {
            readFile(path, cb) {},
            createWriteStream(path) {
                return new Writable({
                    write(data) {
                        console.log(data);
                    }
                });
            },
            createReadStream() {
                return new Readable({
                    read() {
                        this.push(TEST_DATA);
                        this.push(null);
                    }
                });
            }

        };

        const verification = new InstallationVerification(_request, _fs)
            .setPluginName(plugin).setCliEngineConfig(config);

        return verification.verify()
            .then((meta: any) => {
                expect(meta).to.have.property('verified', true);
            });
    });

    it('InvalidNpmMetadata', async () => {
        const _request = (url, cb) => {
            if (_.includes(url, 'foo.tgz')) {
                const reader = new Readable({
                    read() {}
                });
                process.nextTick(() => {
                    reader.emit('end');
                });
                return reader;
            } else if (_.includes(url, 'sig')) {
                cb(null, { statusCode: 200 }, TEST_DATA_SIGNATURE);
            } else if (_.includes(url, 'key')) {
                cb(null, { statusCode: 200 }, CERTIFICATE);
            } else {
                cb(null, { statusCode: 200 }, JSON.stringify({}));
            }
        };

        const _fs = {
            readFile(path, cb) {}
        };

        const verification = new InstallationVerification(_request, _fs)
            .setPluginName(plugin).setCliEngineConfig(config);

        return verification.verify()
            .then(() => {
                throw new Error('This shouldn\'t happen. Failure expected');
            })
            .catch((err: Error) => {
                expect(err).to.have.property('name', 'UnexpectedNpmFormat');
            });
    });

    it('Not Signed', async () => {
        const _request = (url, cb) => {
            if (_.includes(url, 'foo.tgz')) {
                const reader = new Readable({
                    read() {}
                });
                process.nextTick(() => {
                    reader.emit('end');
                });
                return reader;
            } else if (_.includes(url, 'sig')) {
                cb(null, { statusCode: 200 }, TEST_DATA_SIGNATURE);
            } else if (_.includes(url, 'key')) {
                cb(null, { statusCode: 200 }, CERTIFICATE);
            } else {
                cb(null, { statusCode: 200 }, JSON.stringify({
                    'versions': {
                        '1.2.3': {
                            dist: {
                                tarball: 'https://registry.example.com/foo.tgz'
                            }
                        }
                    },
                    'dist-tags': {
                        latest: '1.2.3'
                    }
                }));
            }
        };

        const _fs = {
            readFile(path, cb) {}
        };

        const verification = new InstallationVerification(_request, _fs)
            .setPluginName(plugin).setCliEngineConfig(config);

        return verification.verify()
            .then(() => {
                throw new Error('This shouldn\'t happen. Failure expected');
            })
            .catch((err: Error) => {
                expect(err).to.have.property('name', 'NotSigned');
            });
    });

    it('server 404', async () => {
        const _request = (url, cb) => {
            if (_.includes(url, 'foo.tgz')) {
                const reader = new Readable({
                    read() {}
                });
                process.nextTick(() => {
                    reader.emit('end');
                });
                return reader;
            } else if (_.includes(url, 'sig')) {
                cb(null, { statusCode: 200 }, TEST_DATA_SIGNATURE);
            } else if (_.includes(url, 'key')) {
                cb(null, { statusCode: 200 }, CERTIFICATE);
            } else {
                cb(null, { statusCode: 404 });
            }
        };

        const _fs = {
            readFile(path, cb) {}
        };

        const verification = new InstallationVerification(_request, _fs)
            .setPluginName(plugin).setCliEngineConfig(config);

        return verification.verify()
            .then(() => {
                throw new Error('This shouldn\'t happen. Failure expected');
            })
            .catch((err: Error) => {
                expect(err).to.have.property('name', 'UrlRetrieve');
            });
    });

    it('Read tarball stream failed', () => {
        const _request = (url, cb) => {
            if (_.includes(url, 'foo.tgz')) {
                const reader = new Readable({
                    read() {}
                });
                process.nextTick(() => {
                    reader.emit('error', new Error(ERROR));
                });
                return reader;
            } else {
                cb(null, { statusCode: 200 }, JSON.stringify({
                    'versions': {
                        '1.2.3': {
                            sfdx: {
                                publicKeyUrl: 'https://developer.salesforce.com/key',
                                signatureUrl: 'https://developer.salesforce.com/sig'
                            },
                            dist: {
                                tarball: 'https://registry.example.com/foo.tgz'
                            }
                        }
                    },
                    'dist-tags': {
                        latest: '1.2.3'
                    }
                }));
            }
        };

        const ERROR = 'Ok, who brought the dog? - Louis Tully';
        const _fs = {
            readFile(path, cb) {},
            createWriteStream(path) {
                return new Writable({
                    write(data) {
                        console.log(data);
                    }
                });
            }
        };

        const verification = new InstallationVerification(_request, _fs)
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

        const _request = (url, cb) => {
            if (_.includes(url, 'foo.tgz')) {
                const reader = new Readable({
                    read() {}
                });
                process.nextTick(() => {
                    reader.emit('end');
                });
                return reader;
            } else if (_.includes(url, 'sig')) {
                cb(null, { statusCode: 200 }, TEST_DATA_SIGNATURE);
            } else if (_.includes(url, 'key')) {
                cb(null, { statusCode: 404 });
            } else {
                cb(null, { statusCode: 200 }, JSON.stringify({
                    'versions': {
                        '1.2.3': {
                            sfdx: {
                                publicKeyUrl: 'https://developer.salesforce.com/key',
                                signatureUrl: 'https://developer.salesforce.com/sig'
                            },
                            dist: {
                                tarball: 'https://registry.example.com/foo.tgz'
                            }
                        }
                    },
                    'dist-tags': {
                        latest: '1.2.3'
                    }
                }));
            }
        };

        const _fs = {
            readFile(path, cb) {},
            createWriteStream(path) {
                return new Writable({
                    write(data) {
                        console.log(data);
                    }
                });
            },
            createReadStream() {
                return new Readable({
                    read() {
                        this.push(TEST_DATA);
                        this.push(null);
                    }
                });
            }

        };

        const verification = new InstallationVerification(_request, _fs)
            .setPluginName(plugin).setCliEngineConfig(config);

        return verification.verify()
            .then(() => {
                throw new Error('This shouldn\'t happen. Failure expected');
            })
            .catch((err: Error) => {
                expect(err).to.have.property('name', 'ErrorGettingContent');
                expect(err.message).to.include('404');
            });
    });

    describe('isWhiteListed', () => {
        it('steel thread', async () => {
            const TEST_VALUE = 'FOO';
            let expectedPath;
            const _fs = {
                readFile(path, cb) {
                    expectedPath = path;
                    cb(null, `["${TEST_VALUE}"]`);
                }
            };
            const verification = new InstallationVerification(null, _fs)
                .setPluginName(TEST_VALUE).setCliEngineConfig(config);
            expect(await verification.isWhiteListed()).to.be.equal(true);
            expect(expectedPath).to.include(WHITELIST_FILENAME);
        });

        it('file doesn\'t exist', async () => {
            const _fs = {
                readFile(path, cb) {
                    const error = new Error();
                    (error as any).code = 'ENOENT';
                    cb(error);
                }
            };

            const verification = new InstallationVerification(null, _fs)
                .setPluginName('BAR').setCliEngineConfig(config);
            expect(await verification.isWhiteListed()).to.be.equal(false);
        });
    });

    describe('doInstallationCodeSigningVerification', () => {
        it ('valid signature', async () => {
            let message = '';
            const vConfig = new VerificationConfig();
            vConfig.verifier = ({
                async verify() {
                    return {
                        verified: true
                    };
                }
            } as any);

            vConfig.log = (_message) => {
                message = _message;
            };

            await doInstallationCodeSigningVerification({}, ({} as any), vConfig);
            expect(message).to.include('Successfully');
            expect(message).to.include('digital signature');
        });

        it ('FailedDigitalSignatureVerification', () => {
            const vConfig = new VerificationConfig();
            vConfig.verifier = ({
                async verify() {
                    return {
                        verified: false
                    };
                }
            } as any);

            return doInstallationCodeSigningVerification({}, ({} as any), vConfig).catch((err) => {
                expect(err).to.have.property('name', 'FailedDigitalSignatureVerification');
            });
        });

        it ('Canceled by user', () => {
            const vConfig = new VerificationConfig();
            vConfig.verifier = ({
                async verify() {
                    const err = new Error();
                    err.name = 'NotSigned';
                    throw err;
                },
                async isWhiteListed() {
                    return false;
                }
            } as any);

            vConfig.prompt = async () => {
                return 'N';
            };

            return doInstallationCodeSigningVerification({}, ({} as any), vConfig)
                .then(() => {
                    throw new Error('Failure: This should never happen');
                })
                .catch((err) => {
                    expect(err).to.have.property('name', 'CanceledByUser');
                });
        });

        it ('continue installation', () => {
            const vConfig = new VerificationConfig();
            vConfig.verifier = ({
                async verify() {
                    const err = new Error();
                    err.name = 'UnexpectedHost';
                    throw err;
                },
                async isWhiteListed() {
                    return false;
                }
            } as any);

            vConfig.prompt = async () => {
                return 'Y';
            };

            return doInstallationCodeSigningVerification({}, ({} as any), vConfig)
                .then(() => {
                    throw new Error('Failure: This should never happen');
                })
                .catch((err) => {
                    expect(err).to.have.property('name', 'UnexpectedHost');
                });
        });
    });
});
