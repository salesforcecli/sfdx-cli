import { api } from "./packAndSign";
import child_process  = require("child_process");
import http = require("http");
import { Readable } from "stream";
import { CERTIFICATE, PRIVATE_KEY } from "./testCert";
import fs = require("fs-extra");

import { _ } from "lodash";
import { expect } from "chai";
import { sandbox } from "sinon";

const REJECT_ERROR = new Error("Should have been rejected");

describe("packAndSign Tests", () => {
    let sinonbox;
    beforeEach(() => {
        sinonbox = sandbox.create();
    });
    afterEach(() => {
        sinonbox.restore();
    });
    describe("validate url", () => {
        it ("with host", () => {
            const TEST = "http://example.com/foo/bar";
            expect(() => api.validateUrl(TEST)).to.not.throw(Error);
        });

        it("no host", () => {
            const TEST = "foo/bar";
            expect(() => api.validateUrl(TEST)).to.throw(Error);
        });
    });

    describe("validate args", () => {
        it ("no signature url", () => {
            const args = {};
            expect(() => api.validate(args)).to.throw("signatureUrl");
        });
        it ("no public key", () => {
            const args = { signatureUrl: "http://example.com" };
            expect(() => api.validate(args)).to.throw("publicKeyUrl");
        });
        it ("no private key path", () => {
            const args = { signatureUrl: "http://example.com", publicKeyUrl: "http://example.com" };
            expect(() => api.validate(args)).to.throw("privateKeyPath");
        });
    });

    describe("pack", () => {
        it("Process Failed", () => {
            sinonbox.stub(child_process, "exec").callsFake((command, cb) => {
                cb({code: -15});
            });
            return api.pack().then(() => { throw REJECT_ERROR; }).catch((err) => {
                expect(err.message).to.include("code: -15");
                expect(err).to.have.property("reason");
            });
        });

        it("Process Success", () => {
            sinonbox.stub(child_process, "exec").callsFake((command, cb) => {
                cb(null, JSON.stringify({ data: '"foo.tgz' }));
            });
            return api.pack().then((path) => {
                expect(path).to.be.equal("foo.tgz");
            });
        });

        it("Process path unexpected format", () => {
            sinonbox.stub(child_process, "exec").callsFake((command, cb) => {
                cb(null, JSON.stringify({ data: "foo" }));
            });
            return api.pack().then(() => { throw REJECT_ERROR; }).catch((err) => {
                expect(err.message).to.include("epxected tgz");
                expect(err).to.have.property("name", "UnexpectedYarnFormat");
            });
        });
    });

    describe("verify", () => {
        it("verify flow - false", () => {
            let url;
            sinonbox.stub(http, "get").callsFake((_url, cb) => {
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

            return api.verify(tarGz, signature, "baz").then((authentic) => {
                expect(authentic).to.be.equal(false);
                expect(url).to.be.equal("baz");
            });
        });
    });

    describe("validateNpmIgnore", () => {
        it ("no content", () => {
            expect(() => api.validateNpmIgnore(undefined)).to.throw(Error)
                .and.have.property("name", "MissingNpmIgnoreFile");
        });

        it ("no tgz", () => {
            expect(() => api.validateNpmIgnore("")).to.throw("tgz");
        });
        it ("no sig", () => {
            expect(() => api.validateNpmIgnore("*.tgz")).to.throw("sig");
        });
        it ("no package.json.bak", () => {
            expect(() => api.validateNpmIgnore("*.tgz*.sig")).to.throw("package.json.bak");
        });
        it ("has expected patterns", () => {
            expect(api.validateNpmIgnore("*.tgz*.sigpackage.json.bak")).to.be.equal(undefined);
        });
    });

    describe("doPackAndSign", () => {
        beforeEach(() => {
            sinonbox.stub(console, "log").callsFake((message) => {
                process.stdout.write(message + "\n");
            });

            sinonbox.stub(console, "error").callsFake((message) => {
                process.stderr.write(message + "\n");
            });

            sinonbox.stub(console, "info").callsFake((message) => {
                process.stdout.write(message + "\n");
            });

            sinonbox.stub(fs, "copy").callsFake((src, dest) => {
                console.log("copy file called");
            });
        });
        it ("Steel Thread", () => {
            return api.doPackAndSign([
                "--signatureUrl", "http://signatureUrlValue",
                "--publicKeyUrl", "http://publicKeyUrlValue",
                "--privateKeyPath", "privateKeyPathUrl"
            ]);
        });
    });
});
