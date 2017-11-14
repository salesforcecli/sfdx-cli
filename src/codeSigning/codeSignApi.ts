import * as crypto from 'crypto';

import { Writable, Readable } from 'stream';

import * as _ from 'lodash';
import { NamedError } from '../util/NamedError';
import { parse as parseUrl } from 'url';

const CRYPTO_LEVEL = 'RSA-SHA256';

const SALESFORCE_URL_PATTERNS: RegExp[] = [/developer\.salesforce\.com/];

if (process.env.SFDX_ALLOW_ALL_SALESFORCE_CERTSIG_HOSTING === 'true') {
    SALESFORCE_URL_PATTERNS.push(/(.salesforce.com)$/);
}

// This is the fingerprint for https://developer.salesforce.com
export const SALESFORCE_CERT_FINGERPRINT = process.env.SFDX_DEVELOPER_TRUSTED_FINGERPRINT ||
    '5E:E3:12:97:09:3E:60:11:50:9A:B2:A7:5B:49:B9:78:C4:7B:4B:D9';

export function validSalesforceHostname(url: string | null) {
    if (!url) {
        return false;
    }
    const parsedUrl = parseUrl(url);

    if (process.env.SFDX_ALLOW_ALL_SALESFORCE_CERTSIG_HOSTING === 'true') {
        return parsedUrl.hostname &&  /(\.salesforce\.com)$/.test(parsedUrl.hostname);
    } else {
        return (parsedUrl as any).protocol === 'https:' && parsedUrl.hostname && parsedUrl.hostname === 'developer.salesforce.com';
    }
}

export function validateRequestCert(request: any, url: string) {
    if (!(process.env.SFDX_DISABLE_CERT_PINNING === 'true')) {
        request.on('socket', (socket: any) => {
            socket.on('secureConnect', () => {
                const fingerprint = socket.getPeerCertificate().fingerprint;
                // If NODE_TLS_REJECT_UNAUTHORIZED is disabled this code can still enforce authorization.
                // If we ever get asked by security to prevent disabling auth (essentially not support self signed certs) - then
                // this is the code for it. So keep this code around.
                // if (!socket.authorized) {
                    // throw new NamedError('CertificateNotAuthorized',
                    //    `The certificate for ${url} is not valid: ${socket.authorizationError}`);
                // }

                if (!_.includes(SALESFORCE_CERT_FINGERPRINT, fingerprint)) {
                    throw new NamedError('CertificateFingerprintNotMatch',
                        `The expected fingerprint and the fingerprint [${fingerprint}] from the certificate found at https://developer.salesforce.com do not match.`);
                }
            });
        });
    }
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

function retrieveKey(stream: Readable): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        let key: string = '';
        if (stream) {
            stream.on('data', (chunk) => {
                key += chunk;
            });
            stream.on('end', () => {
                if (!_.startsWith(key, '-----BEGIN')) {
                    reject(new NamedError('InvalidKeyFormat', 'The specified key format is invalid.'));
                }
                resolve(key);
            });
            stream.on('error', (err) => {
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
        codeSignInfo.dataToSignStream.on('end', () => {
            resolve(signApi.sign(privateKey, 'base64'));
        });

        codeSignInfo.dataToSignStream.on('error', (err) => {
            reject(err);
        });
    });
}

export async function verify(codeVerifierInfo: CodeVerifierInfo): Promise<boolean> {

    const publicKey = await retrieveKey(codeVerifierInfo.publicKeyStream);
    const signApi = crypto.createVerify(CRYPTO_LEVEL);

    return new Promise<boolean>((resolve, reject) => {
        codeVerifierInfo.dataToVerify.pipe(signApi);

        codeVerifierInfo.dataToVerify.on('end', () => {

            // The sign signature returns a base64 encode string.
            let signature = Buffer.alloc(0);
            codeVerifierInfo.signatureStream.on('data', (chunk: Buffer) => {
                signature = Buffer.concat([signature, chunk]);
            });

            codeVerifierInfo.signatureStream.on('end', () => {
                if (signature.byteLength === 0) {
                    reject(new NamedError('InvalidSignature', 'The provided signature is invalid or missing.'));
                } else {
                    const verification = signApi.verify(publicKey, signature.toString('utf8'), 'base64');
                    resolve(verification);
                }
            });

            codeVerifierInfo.signatureStream.on('error', (err) => {
                reject(err);
            });

        });

        codeVerifierInfo.dataToVerify.on('error', (err) => {
            reject(err);
        });
    });
}
