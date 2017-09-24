import { CodeSignInfo } from "./sign";
import { CodeVerifierInfo } from "./sign";
import { verify } from "./sign";
import { default as sign } from "./sign";
import { Readable, Writable } from "stream";
import { expect } from "chai";
import { CERTIFICATE, PRIVATE_KEY } from "./testCert";

describe("Sign Tests", () => {
    it ("steel thread",  async () => {

        const info = new CodeSignInfo();
        const TEST_DATA = "12345";

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

    it ("invalid private key", async () => {
        const info = new CodeSignInfo();
        const TEST_DATA = "12345";

        info.dataToSignStream = new Readable({
            read() {
                this.push(TEST_DATA);
                this.push(null);
            }
        });

        info.privateKeyStream = new Readable({
            read() {
                this.push("key");
                this.push(null);
            }
        });
        return sign(info)
            .then(() => {
                throw new Error("This should reject");
            })
            .catch((err) => {
                expect(err).to.have.property("name", "InvalidKeyFormat");
            });
    });

    it ("invalid signature", async () => {
        const TEST_DATA = "12345";

        const verifyInfo = new CodeVerifierInfo();
        verifyInfo.publicKeyStream = new Readable({
            read() {
                this.push(CERTIFICATE);
                this.push(null);
            }
        });

        verifyInfo.signatureStream = new Readable({
            read() {
                this.push("");
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
                throw new Error("This should reject");
            })
            .catch((err) => {
                expect(err).to.have.property("name", "InvalidSignature");
            });
    });
});
