import child_process  = require("child_process");
import { Readable } from "stream";
import fs = require("fs-extra");
import https  = require("https");
import { CERTIFICATE, PRIVATE_KEY } from "./testCert";
import * as _ from "lodash";
import { expect } from "chai";
import * as sinon from "sinon";
import * as _Promise from "bluebird";

let packAndSignApi: any;

const REJECT_ERROR = new Error("Should have been rejected");

describe("doPackAndSign", () => {
    let globalSandbox: any;

    const logMessages = [];
    before(() => {
        globalSandbox = sinon.sandbox.create();
        let signature: string;

        globalSandbox.stub(console, "log");
        globalSandbox.stub(console, "info");

        globalSandbox.stub(fs, "copy").callsFake((src: string, dest: string, cb: any) => {
            cb(null, {});
        });

        globalSandbox.stub(fs, "writeFile").callsFake((path: string, content: string, cb: any) => {
            if (_.includes(path, ".sig")) {
                signature = content;
            }
            cb(null, {});
        });

        globalSandbox.stub(fs, "createReadStream").callsFake((filePath: string, options: any) => {
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

        globalSandbox.stub(https, "get").callsFake((path: any, cb: any) => {
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
        ]).then((result: boolean) => {
            expect(result).to.be.equal(true);
        });
    });
});

describe("packAndSign Tests", () => {
    let sandbox: any;

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
            sandbox.stub(child_process, "exec").callsFake((command: string, cb: any) => {
                cb({code: -15});
            });
            return packAndSignApi.pack().then(() => { throw REJECT_ERROR; }).catch((err: Error) => {
                expect(err.message).to.include("code: -15");
                expect(err).to.have.property("reason");
            });
        });

        it("Process Success", () => {
            sandbox.stub(child_process, "exec").callsFake((command: string, cb: any) => {
                cb(null, JSON.stringify({ data: '"foo.tgz' }));
            });
            return packAndSignApi.pack().then((path: string ) => {
                expect(path).to.be.equal("foo.tgz");
            });
        });

        it("Process path unexpected format", () => {
            sandbox.stub(child_process, "exec").callsFake((command: string, cb: any) => {
                cb(null, JSON.stringify({ data: "foo" }));
            });
            return packAndSignApi.pack().then(() => { throw REJECT_ERROR; }).catch((err: Error) => {
                expect(err.message).to.include("expected tgz");
                expect(err).to.have.property("name", "UnexpectedYarnFormat");
            });
        });
    });

    describe("verify", () => {
        it("verify flow - false", () => {
            let url: any;
            sandbox.stub(https, "get").callsFake((_url: string, cb: any) => {
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

            return packAndSignApi.verify(tarGz, signature, "baz").then((authentic: boolean) => {
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
