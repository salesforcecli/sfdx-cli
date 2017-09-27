import child_process  = require("child_process");
import { Readable } from "stream";
import fs = require("fs-extra");
import https  = require("https");
import { CERTIFICATE, PRIVATE_KEY } from "./testCert";
import { _ } from "lodash";
import { expect } from "chai";
import * as sinon from "sinon";
import * as _Promise from "bluebird";

let packAndSignApi;

const REJECT_ERROR = new Error("Should have been rejected");

describe("doPackAndSign", () => {
    let globalSandbox;

    const logMessages = [];
    before(() => {
        globalSandbox = sinon.sandbox.create();
        let signature;

        globalSandbox.stub(console, "log");
        globalSandbox.stub(console, "info");

        globalSandbox.stub(fs, "copy", (src, dest, cb) => {
            cb(null, {});
        });

        globalSandbox.stub(fs, "writeFile", (path, content, cb) => {
            if (_.includes(path, ".sig")) {
                signature = content;
            }
            cb(null, {});
        });

        globalSandbox.stub(fs, "createReadStream", (filePath, options) => {
            if (_.includes(filePath, "privateKey")) {
                return new Readable({
                    read() {
                        this.push(PRIVATE_KEY);
                        this.push(null);
                    }
                });

            } else if (_.includes(filePath, "tgz")) {
                return new Readable({
                    read() {
                        this.push("Test Tar Gz");
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

        globalSandbox.stub(https, "get", (path, cb) => {
            if (_.includes(path.host, "publickeyurlvalue")) {
                const response = new Readable({
                    read() {
                        this.push(CERTIFICATE);
                        this.push(null);
                    }
                });
                _.set(response, "statusCode", 200);
                cb(response);
            }
        });

        packAndSignApi = require("./packAndSign").api;
    });

    after(() => {
        globalSandbox.restore();
    });

    it ("Steel Thread", () => {
        return packAndSignApi.doPackAndSign([
            "--signatureUrl", "https://signatureUrlValue.salesforce.com",
            "--publicKeyUrl", "https://publicKeyUrlValue.salesforce.com",
            "--privateKeyPath", "privateKeyPathUrl"
        ]).then((result) => {
            expect(result).to.be.equal(true);
        });
    });
});

describe("packAndSign Tests", () => {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.sandbox.create();
    });
    afterEach(() => {
        sandbox.restore();
    });

    describe("validate url", () => {
        it ("with host", () => {
            const TEST = "https://salesforce.com/foo/bar";
            expect(() => packAndSignApi.validateUrl(TEST)).to.not.throw(Error);
        });

        it("no host", () => {
            const TEST = "foo/bar";
            expect(() => packAndSignApi.validateUrl(TEST)).to.throw(Error);
        });
    });

    describe("validate args", () => {
        it ("no signature url", () => {
            const args = {};
            expect(() => packAndSignApi.validate(args)).to.throw("signatureUrl");
        });
        it ("no public key", () => {
            const args = { signatureUrl: "https://salesforce.com" };
            expect(() => packAndSignApi.validate(args)).to.throw("publicKeyUrl");
        });
        it ("no private key path", () => {
            const args = { signatureUrl: "https://salesforce.com", publicKeyUrl: "https://salesforce.com" };
            expect(() => packAndSignApi.validate(args)).to.throw("privateKeyPath");
        });
    });

    describe("pack", () => {
        it("Process Failed", () => {
            sandbox.stub(child_process, "exec", (command, cb) => {
                cb({code: -15});
            });
            return packAndSignApi.pack().then(() => { throw REJECT_ERROR; }).catch((err) => {
                expect(err.message).to.include("code: -15");
                expect(err).to.have.property("reason");
            });
        });

        it("Process Success", () => {
            sandbox.stub(child_process, "exec", (command, cb) => {
                cb(null, JSON.stringify({ data: '"foo.tgz' }));
            });
            return packAndSignApi.pack().then((path) => {
                expect(path).to.be.equal("foo.tgz");
            });
        });

        it("Process path unexpected format", () => {
            sandbox.stub(child_process, "exec", (command, cb) => {
                cb(null, JSON.stringify({ data: "foo" }));
            });
            return packAndSignApi.pack().then(() => { throw REJECT_ERROR; }).catch((err) => {
                expect(err.message).to.include("expected tgz");
                expect(err).to.have.property("name", "UnexpectedYarnFormat");
            });
        });
    });

    describe("verify", () => {
        it("verify flow - false", () => {
            let url;
            sandbox.stub(https, "get", (_url, cb) => {
                url = _url;
                const response = new Readable({
                    read() {
                        this.push(CERTIFICATE);
                        this.push(null);
                    }
                });
                _.set(response, "statusCode", 200);
                cb(response);
            });

            const tarGz = new Readable({
                read() {
                    this.push("foo");
                    this.push(null);
                }
            });

            const signature = new Readable({
                read() {
                    this.push("bar");
                    this.push(null);
                }
            });

            return packAndSignApi.verify(tarGz, signature, "baz").then((authentic) => {
                expect(authentic).to.be.equal(false);
                expect(url.path).to.be.equal("baz");
            });
        });
    });

    describe("validateNpmIgnore", () => {
        it ("no content", () => {
            expect(() => packAndSignApi.validateNpmIgnorePatterns(undefined)).to.throw(Error)
                .and.have.property("name", "MissingNpmIgnoreFile");
        });

        it ("no tgz", () => {
            expect(() => packAndSignApi.validateNpmIgnorePatterns("")).to.throw("tgz");
        });
        it ("no sig", () => {
            expect(() => packAndSignApi.validateNpmIgnorePatterns("*.tgz")).to.throw("sig");
        });
        it ("no package.json.bak", () => {
            expect(() => packAndSignApi.validateNpmIgnorePatterns("*.tgz*.sig")).to.throw("package.json.bak");
        });
        it ("has expected patterns", () => {
            expect(packAndSignApi.validateNpmIgnorePatterns("*.tgz*.sigpackage.json.bak")).to.be.equal(undefined);
        });
    });
});
