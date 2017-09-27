import * as crypto from "crypto";

import { Writable, Readable } from "stream";

import * as _ from "lodash";
import { NamedError } from "../util/NamedError";
import { parse as parseUrl } from "url";
const CRYPTO_LEVEL = "RSA-SHA256";

const SALESFORCE_DOMAINS = ["salesforce.com"];

export const SALESFORCE_CERT_FINGERPRINT = "B8:32:1B:DD:E8:11:1E:81:BC:C8:D3:68:58:34:3E:77:BB:AF:F2:2C";

export function validSalesforceDomain(url: string | null) {
    if (!url) {
        return false;
    }
    const parsedUrl = parseUrl(url);
    const _domain = _.find(SALESFORCE_DOMAINS, (domain) => parsedUrl.protocol === "https:" && _.endsWith(parsedUrl.hostname, domain));
    return _domain !== undefined;
}

export function validateRequestCert(request: any, url: string) {
    request.on("socket", (socket: any) => {
        socket.on("secureConnect", () => {
            const fingerprint = socket.getPeerCertificate().fingerprint;
            // Self signed?
            // if (!socket.authorized) {
                // throw new NamedError("CertificateNotAuthorized",
                //    `The certificate for ${url} is not valid: ${socket.authorizationError}`);
            // }

            if (!_.includes(SALESFORCE_CERT_FINGERPRINT, fingerprint)) {
                throw new NamedError("CertificateFingerprintNotMatch",
                    `The expected fingerprint and the fingerprint from the certificate found at ${url} do not match.`);
            }
        });
    });
}

export class CodeSignInfo {
    private _dataToSignStream: Readable;
    private _privateKeyStream: Readable;

    public set dataToSignStream(stream: Readable) {
        this._dataToSignStream = stream;
    }

    public get dataToSignStream() {
        return this._dataToSignStream;
    }

    public set privateKeyStream(stream: Readable) {
        this._privateKeyStream = stream;
    }

    public get privateKeyStream() {
        return this._privateKeyStream;
    }
}

export class CodeVerifierInfo {

    private _signatureStream: Readable;
    private _publicKeyStream: Readable;

    public get dataToVerify(): Readable {
        return this._dataToVerify;
    }

    public set dataToVerify(value: Readable) {
        this._dataToVerify = value;
    }
    private _dataToVerify: Readable;

    public get signatureStream(): Readable {
        return this._signatureStream;
    }

    public set signatureStream(value: Readable) {
        this._signatureStream = value;
    }

    public get publicKeyStream(): Readable {
        return this._publicKeyStream;
    }

    public set publicKeyStream(value: Readable) {
        this._publicKeyStream = value;
    }
}

async function retrieveKey(stream: Readable): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        let key: string = "";
        if (stream) {
            stream.on("data", (chunk) => {
                key += chunk;
            });
            stream.on("end", () => {
                if (!_.startsWith(key, "-----BEGIN")) {
                    reject(new NamedError("InvalidKeyFormat", "The specified key format is invalid."));
                }
                resolve(key);
            });
            stream.on("error", (err) => {
                reject(err);
            });
        }
    });
}

export default async function sign(codeSignInfo: CodeSignInfo): Promise<string> {

    const privateKey = await retrieveKey(codeSignInfo.privateKeyStream);

    const signApi = crypto.createSign(CRYPTO_LEVEL);

    return new Promise<string>((resolve, reject) => {
        codeSignInfo.dataToSignStream.pipe(signApi);
        codeSignInfo.dataToSignStream.on("end", () => {
            resolve(signApi.sign(privateKey, "base64"));
        });

        codeSignInfo.dataToSignStream.on("error", (err) => {
            reject(err);
        });
    });
}

export async function verify(codeVerifierInfo: CodeVerifierInfo): Promise<boolean> {
    const publicKey = await retrieveKey(codeVerifierInfo.publicKeyStream);

    const signApi = crypto.createVerify(CRYPTO_LEVEL);

    return new Promise<boolean>((resolve, reject) => {
        codeVerifierInfo.dataToVerify.pipe(signApi);

        codeVerifierInfo.dataToVerify.on("end", () => {

            // The sign signature returns a base64 encode string.
            let signature = Buffer.alloc(0);
            codeVerifierInfo.signatureStream.on("data", (chunk: Buffer) => {
                signature = Buffer.concat([signature, chunk]);
            });

            codeVerifierInfo.signatureStream.on("end", () => {
                if (signature.byteLength === 0) {
                    reject(new NamedError("InvalidSignature", "The provided signature is invalid or missing."));
                } else {
                    const verification = signApi.verify(publicKey, signature.toString("utf8"), "base64");
                    resolve(verification);
                }
            });

            codeVerifierInfo.signatureStream.on("error", (err) => {
                reject(err);
            });

        });

        codeVerifierInfo.dataToVerify.on("error", (err) => {
            reject(err);
        });
    });
}
