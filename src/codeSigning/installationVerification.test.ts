import * as _ from 'lodash';
import { Readable, Writable } from 'stream';
import { TEST_DATA, TEST_DATA_SIGNATURE, CERTIFICATE } from './testCert';
import { expect } from 'chai';
import {
    doInstallationCodeSigningVerification,
    InstallationVerification,
    WHITELIST_FILENAME,
    VerificationConfig,
    getNpmRegistry,
    DEFAULT_REGISTRY
} from './installationVerification';

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
            } else if (_.endsWith(url, plugin)) {
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
            } else {
                throw new Error(`Unexpected test url - ${url}`);
            }
        };

        const _fs = {
            readFile() {},
            createWriteStream() {
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

    it('Steel thread version - version number', async () => {
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
            } else if (_.endsWith(url, plugin)) {
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
                        },
                        '1.2.4': {
                            sfdx: {
                                publicKeyUrl: 'https://developer.salesforce.com/key1',
                                signatureUrl: 'https://developer.salesforce.com/sig1'
                            },
                            dist: {
                                tarball: 'https://registry.example.com/foo1.tgz'
                            }
                        }
                    },
                    'dist-tags': {
                        latest: '1.2.4'
                    }
                }));
            } else {
                throw new Error(`Unexpected test url - ${url}`);
            }
        };

        const _fs = {
            readFile() {},
            createWriteStream() {
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
            .setPluginName(plugin).setPluginTag('1.2.3').setCliEngineConfig(config);

        return verification.verify()
            .then((meta: any) => {
                expect(meta).to.have.property('verified', true);
            });
    });

    it('Steel thread version - tag name', async () => {
        const _request = (url, cb) => {
            if (_.includes(url, 'foo.tgz')) {
                const reader = new Readable({
                    read() {}
                });
                process.nextTick(() => {
                    reader.emit('end');
                });
                return reader;
            } else if (_.includes(url, 'sig.weaver')) {
                cb(null, { statusCode: 200 }, TEST_DATA_SIGNATURE);
            } else if (_.includes(url, 'key.master')) {
                cb(null, { statusCode: 200 }, CERTIFICATE);
            } else if (_.endsWith(url, plugin)) {
                cb(null, { statusCode: 200 }, JSON.stringify({
                    'versions': {
                        '1.2.3': {
                            sfdx: {
                                publicKeyUrl: 'https://developer.salesforce.com/key.master',
                                signatureUrl: 'https://developer.salesforce.com/sig.weaver'
                            },
                            dist: {
                                tarball: 'https://registry.example.com/foo.tgz'
                            }
                        },
                        '1.2.4': {
                            sfdx: {
                                publicKeyUrl: 'https://developer.salesforce.com/key1',
                                signatureUrl: 'https://developer.salesforce.com/sig1'
                            },
                            dist: {
                                tarball: 'https://registry.example.com/foo1.tgz'
                            }
                        }
                    },
                    'dist-tags': {
                        latest: '1.2.4',
                        gozer: '1.2.3'
                    }
                }));
            } else {
                throw new Error(`Unexpected test url - ${url}`);
            }
        };

        const _fs = {
            readFile() {},
            createWriteStream() {
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

        // For the key and signature to line up gozer must map to 1.2.3
        const verification = new InstallationVerification(_request, _fs)
            .setPluginName(plugin).setPluginTag('gozer').setCliEngineConfig(config);

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
            } else if (_.endsWith(url, plugin))  {
                cb(null, { statusCode: 200 }, JSON.stringify({}));
            } else {
                throw new Error(`Unexpected test url - ${url}`);
            }
        };

        const _fs = {
            readFile() {}
        };

        const verification = new InstallationVerification(_request, _fs)
            .setPluginName(plugin).setCliEngineConfig(config);

        return verification.verify()
            .then(() => {
                throw new Error('This shouldn\'t happen. Failure expected');
            })
            .catch((err: Error) => {
                expect(err).to.have.property('name', 'InvalidNpmMetadata');
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
            } else if (_.endsWith(url, plugin)) {
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
            } else {
                throw new Error(`Unexpected test url - ${url}`);
            }
        };

        const _fs = {
            readFile() {}
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

    it('Npm Meta Request Error', async () => {
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
            } else if (_.endsWith(url, plugin)) {
                const err = new Error();
                err.name = 'NPMMetaError';
                cb(err);
            } else {
                throw new Error(`Unexpected test url - ${url}`);
            }
        };

        const _fs = {
            readFile() {}
        };

        const verification = new InstallationVerification(_request, _fs)
            .setPluginName(plugin).setCliEngineConfig(config);

        return verification.verify()
            .then(() => {
                throw new Error('This shouldn\'t happen. Failure expected');
            })
            .catch((err: Error) => {
                expect(err).to.have.property('name', 'NPMMetaError');
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
            } else if (_.endsWith(url, plugin)) {
                cb(null, { statusCode: 404 });
            } else {
                throw new Error(`Unexpected test url - ${url}`);
            }
        };

        const _fs = {
            readFile() {}
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
            } else if (_.endsWith(url, plugin)) {
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
            } else {
                throw new Error(`Unexpected test url - ${url}`);
            }
        };

        const ERROR = 'Ok, who brought the dog? - Louis Tully';
        const _fs = {
            readFile() {},
            createWriteStream() {
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
            } else if (_.endsWith(url, plugin)) {
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
            } else {
                throw new Error(`Unexpected test url - ${url}`);
            }
        };

        const _fs = {
            readFile() {},
            createWriteStream() {
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
            let expectedPath = '';
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
