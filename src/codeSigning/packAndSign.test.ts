import child_process  = require("child_process");
import http = require("http");

import { Readable } from "stream";
import fs = require("fs-extra");
import { CERTIFICATE, PRIVATE_KEY } from "./testCert";
import { _ } from "lodash";
import { expect } from "chai";
import * as sinon from "sinon";
import * as _Promise from "bluebird";
let packAndSignApi;

const REJECT_ERROR = new Error("Should have been rejected");

describe("packAndSign Tests", () => {
    let sandbox;
    const globalSandbox = sinon.sandbox.create();

    before(() => {
        // We do want to back and restore package.json for the unit test
        globalSandbox.stub(fs, "copy", (src, dest) => {
            return;
        });

        // We don't want to update package on disk for the unit test.
        globalSandbox.stub(fs, "writeFile", (path, content, cb) => {
            cb(null, {});
        });
        packAndSignApi = require("./packAndSign").api;
    });

    after(() => {
        globalSandbox.restore();
    });

    beforeEach(() => {
        sandbox = sinon.sandbox.create();
    });
    afterEach(() => {
        sandbox.restore();
    });
    describe("validate url", () => {
        it ("with host", () => {
            const TEST = "http://example.com/foo/bar";
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
            const args = { signatureUrl: "http://example.com" };
            expect(() => packAndSignApi.validate(args)).to.throw("publicKeyUrl");
        });
        it ("no private key path", () => {
            const args = { signatureUrl: "http://example.com", publicKeyUrl: "http://example.com" };
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
            sandbox.stub(http, "get", (_url, cb) => {
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
                expect(url).to.be.equal("baz");
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

    describe("doPackAndSign", () => {
        beforeEach(() => {
            sandbox.stub(console, "log", (message) => {
                process.stdout.write(message + "\n");
            });

            sandbox.stub(console, "error", (message) => {
                process.stderr.write(message + "\n");
            });

            sandbox.stub(console, "info", (message) => {
                process.stdout.write(message + "\n");
            });
        });
        it ("Steel Thread", () => {
            console.log("This test is bogus please fix");
            return packAndSignApi.doPackAndSign([
                "--signatureUrl", "http://signatureUrlValue",
                "--publicKeyUrl", "http://publicKeyUrlValue",
                "--privateKeyPath", "privateKeyPathUrl"
            ]);
        });
    });
});
