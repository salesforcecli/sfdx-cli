#!/usr/bin/env node

import { exec } from 'child_process';

import {
    copy as copyFile,
    createReadStream,
    readFile,
    remove,
    writeFile
} from 'fs-extra';

import { get as httpsGet } from 'https';
import { parse as parseUrl } from 'url';
import { Writable, Readable } from 'stream';
import { join as pathJoin } from 'path';
import { parse as parsePath } from 'path';
import { sep as pathSep, basename as pathBasename } from 'path';

import * as _ from 'lodash';

import {
    ExecProcessFailed,
    InvalidUrlError,
    MissingRequiredParameter,
    NamedError
} from '../util/NamedError';

import parseSimpleArgs from '../util/simpleArgs';

import {
    CodeSignInfo,
    CodeVerifierInfo,
    default as sign,
    validateRequestCert,
    validSalesforceHostname,
    verify
} from '../codeSigning/codeSignApi';

import { promisify as utilPromisify } from 'util';

const readFileAsync: (path: string, options?: any) => Promise<string> = utilPromisify(readFile);
const writeFileAsync: (file: string, data: string | Buffer | Uint8Array) => Promise<void> = utilPromisify(writeFile);
const removeFileAsync: (path: string) => Promise<void> = utilPromisify(remove);
const copyFileAsync: (src: string, dest: string, options?: any) => Promise<void> = utilPromisify(copyFile);

const PACKAGE_DOT_JSON = 'package.json';
const PACKAGE_DOT_JSON_PATH = pathJoin(process.cwd(), PACKAGE_DOT_JSON);
const PACKAGE_DOT_JSON_PATH_BAK = pathJoin(process.cwd(), `${PACKAGE_DOT_JSON}.bak`);

const BIN_NAME = 'sfdx_sign';

export const api = {

    /**
     * Help message for the command
     */
    getHelp() {
        return _.trim(`
Build function that will perform four things:
1) update the npm cert and signature home url in package.json
2) pack the npm into a tar gz file
3) sign the tar gz file using the private key associated with the cert.
4) test verify the signature

Required Parameters:
--signatureUrl - the url where the signature will be hosted minus the name of the signature file.
--publicKeyUrl - the url where the public key/certificate will be hosted.
--privateKeyPath - the local file path for the private key

Returns:
A tar.gz and signature file. The signature file will match the name of the tar gz except the extension will be ".sig".
This file must be hosted at the location specified by --signature.

Usage:
sfdx_sign packAndSign --signature http://foo.salesforce.internal.com/file/location --publicKeyUrl http://foo.salesforce.internal.com/file/location/sfdx.cert --privateKeyPath $HOME/sfdx.key
`);
    },

    /**
     * Validates that a url is a valid salesforce url.
     * @param url - The url to validate.
     */
    validateUrl(url: string) {
        try {
            const urlObj = parseUrl(url);
            if (!urlObj.host) {
                throw new InvalidUrlError(url);
            }
            if (!validSalesforceHostname(url)) {
                throw new NamedError('NotASalesforceHost', 'Signing urls must have the hostname developer.salesforce.com.');
            }
        } catch (e) {
            const err = new InvalidUrlError(url);
            err.reason = e;
            throw err;
        }
    },

    /**
     * validate program arguments.
     * @param args - The arg to validate; Generally passed a reference to process.argv
     */
    validate(args: any) {
        if (args) {
            if (!args.signatureUrl) {
                throw new MissingRequiredParameter('--signatureUrl');
            }
            api.validateUrl(args.signatureUrl);

            if (!args.publicKeyUrl) {
                throw new MissingRequiredParameter('--publicKeyUrl');
            }
            api.validateUrl(args.publicKeyUrl);

            if (!args.privateKeyPath) {
                throw new MissingRequiredParameter('privateKeyPath');
            }
        } else {
            throw new NamedError('InvalidArgs', 'Invalid args.');
        }
    },

    /**
     * call out to yarn pack;
     */
    pack(): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            const command: string = 'yarn pack --json';
            exec(command, (error: any, stdout: string, stderr: string) => {
                if (error && error.code) {
                    const err = new ExecProcessFailed(command, error.code).setReasonByMessage(stderr);
                    reject(err);
                } else {
                    const data = JSON.parse(stdout).data;
                    const path = _.find(_.split(data, '"'), (word) => _.includes(word, 'tgz'));
                    if (!path) {
                        reject(new NamedError('UnexpectedYarnFormat', `Yarn pack did not return an expected tgz filename result: [${data}]`));
                    } else {
                        resolve(path);
                    }
                }
            });
        });
    },

    /**
     * verify a signature against a public key and tgz content
     * @param tarGzStream - Tar file to validate
     * @param sigFilenameStream - Computed signature
     * @param publicKeyUrl - url for the public key
     */
    verify(tarGzStream: Readable, sigFilenameStream: Readable, publicKeyUrl: string): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            const verifyInfo = new CodeVerifierInfo();
            verifyInfo.dataToVerify = tarGzStream;
            verifyInfo.signatureStream = sigFilenameStream;

            const parsedUrl = parseUrl(publicKeyUrl);

            // You can set the following env variable NODE_TLS_REJECT_UNAUTHORIZED=0 to more easily support
            // self signed certs.
            const options = {
                host: parsedUrl.hostname,
                path: parsedUrl.path,
                port: parsedUrl.port
            };
            const req = httpsGet(options, (resp) => {
                if (resp && resp.statusCode === 200) {
                    verifyInfo.publicKeyStream = resp;
                    resolve(verify(verifyInfo));
                } else {
                    reject(new NamedError('RetrievePublicKeyFailed', `Couldn't retrieve public key at url: ${publicKeyUrl}`));
                }

            });
            validateRequestCert(req, publicKeyUrl);

            req.on('error', (err: any) => {
                if (err && err.code === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
                    reject(new NamedError('SelfSignedCert', 'Encountered a self signed certificated. To enable "export NODE_TLS_REJECT_UNAUTHORIZED=0"'));
                } else {
                    reject(err);
                }
            });
        });
    },

    /**
     * sign a tgz file stream
     * @param fileStream - the tgz file stream to sign
     * @param privateKeyStream - the certificate's private key
     */
    retrieveSignature(fileStream: Readable, privateKeyStream: Readable): Promise<string> {
        const info = new CodeSignInfo();
        info.dataToSignStream = fileStream;
        info.privateKeyStream = privateKeyStream;
        return sign(info);
    },

    /**
     * write the signature to a '.sig' file. this file is to be deployed to signatureUrl
     * @param filePath - the file path to the tgz file
     * @param signature - the computed signature
     */
    async writeSignatureFile(filePath: string, signature: string) {
        if (!_.endsWith(filePath, 'tgz')) {
            throw new NamedError('UnexpectedTgzName',
                `The file path ${filePath} is unexpected. It should be a tgz file.`);
        }
        console.info(`Signing file at filePath: ${filePath}`);
        const pathComponents: string[] = _.split(filePath, pathSep);
        const filenamePart: any = _.last(pathComponents);
        const sigFilename = _.replace(filenamePart, '.tgz', '.sig');
        await writeFileAsync(pathJoin(process.cwd(), sigFilename), signature);
        return sigFilename;
    },

    /**
     * read the package.json file for the target npm to be signed.
     */
    retrievePackageJson(): Promise<string> {
        return readFileAsync(PACKAGE_DOT_JSON_PATH, { encoding: 'utf8' });
    },

    /**
     * read the npm ignore file for the target npm
     * @param filename - local path to the npmignore file
     */
    retrieveIgnoreFile(filename: string): Promise<string> {
        return readFileAsync(pathJoin(process.cwd(), filename), { encoding: 'utf8' });
    },

    /**
     * checks the ignore content for the code signing patterns. *.tgz, *.sig package.json.bak
     * @param content
     */
    validateNpmIgnorePatterns(content: string) {
        const validate = (pattern: string) => {
            if (!content) {
                throw new NamedError('MissingNpmIgnoreFile',
                    'Missing .npmignore file. The following patterns are required in for code signing: *.tgz, *.sig, package.json.bak.');
            }

            if (!_.includes(content, pattern)) {
                throw new NamedError('MissingNpmIgnorePattern',
                    `.npmignore is missing ${pattern}. The following patterns are required for code signing: *.tgz, *.sig, package.json.bak`);
            }
        };
        validate('*.tgz');
        validate('*.sig');
        validate('package.json.bak');
    },

    /**
     * makes a backup copy pf package.json
     * @param src - the package.json to backup
     * @param dest - package.json.bak
     */
    copyPackageDotJson(src: string, dest: string): Promise<void> {
        return copyFileAsync(src, dest);
    },

    /**
     * used to update the contents of package.json
     * @param pJson - the updated json content to write to disk
     */
    writePackageJson(pJson: any): Promise<void> {
        return writeFileAsync(PACKAGE_DOT_JSON_PATH, JSON.stringify(pJson, null, 4));
    },

    /**
     * main method to pack and sign an npm.
     * @param processArgv - reference to process.argv
     */
    async doPackAndSign(processArgv: string[]) {
        let packageDotJsonBackedUp = false;

        try {
            const args: any = parseSimpleArgs(processArgv);

            if (args.help) {
                console.log(api.getHelp());
                return;
            }
            api.validate(args);

            // validate npm ignore has what we name.
            let filename = '.npmignore';
            const npmIgnoreContent = await api.retrieveIgnoreFile(filename);
            api.validateNpmIgnorePatterns(npmIgnoreContent);

            // Recommend updating git ignore to match npmignore.
            filename = '.gitignore';
            const gitIgnoreContent = await api.retrieveIgnoreFile(filename);
            try {
                api.validateNpmIgnorePatterns(gitIgnoreContent);
            } catch (e) {
                console.warn(`WARNING:  The following patterns are recommended in ${filename} for code signing: *.tgz, *.sig, package.json.bak.`);
            }

            // read package.json info
            const packageJsonContent = await api.retrievePackageJson();
            let packageJson = JSON.parse(packageJsonContent);

            // compute the name of the signature file
            const sigFilename = `${packageJson.name}-v${packageJson.version}.sig`;

            // make a backup of the signature file
            await api.copyPackageDotJson(PACKAGE_DOT_JSON_PATH, PACKAGE_DOT_JSON_PATH_BAK);
            packageDotJsonBackedUp = true;
            console.log(`Backed up ${PACKAGE_DOT_JSON_PATH} to ${PACKAGE_DOT_JSON_PATH_BAK}`);

            // update the package.json object with the signature urls and write it to disk.
            const sigUrl = `${args.signatureUrl}${_.endsWith(args.signatureUrl, '/') ? '' : '/'}${sigFilename}`;
            packageJson = _.merge(packageJson, { sfdx: { publicKeyUrl: args.publicKeyUrl, signatureUrl: `${sigUrl}` } });
            await api.writePackageJson(packageJson);

            console.log('Successfully updated package.json with public key and signature file locations.');

            // create the tgz file
            const filepath = await api.pack();

            // create the signature file
            const signature = await api.retrieveSignature(
                createReadStream(filepath, { encoding: 'binary' }), createReadStream(args.privateKeyPath));

            if (signature && signature.length > 0) {

                // write the signature file to disk
                await api.writeSignatureFile(filepath, signature);

                console.info(`Artifact signed and saved in ${sigFilename}`);

                // verify the signature with the public key url
                const verified = await api.verify(
                    createReadStream(filepath, { encoding: 'binary' }),
                    createReadStream(pathJoin(process.cwd(), sigFilename)),
                    args.publicKeyUrl);

                if (verified) {
                    console.log(`Successfully verified signature with public key at: ${args.publicKeyUrl}`);
                    return verified;
                } else {
                    throw new NamedError('FailedToVerifySignature', 'Failed to verify signature with tar gz content');
                }
            } else {
                throw new NamedError('EmptySignature', 'The generated signature is empty. Verify the private key and try again');
            }
        } catch (e) {
            console.error(`ERROR: ${e.message}`);
            if (e.reason) {
                console.error(e.reason.message);
            }
        } finally {
            // Restore the package.json file so it doesn't show a git diff.
            if (packageDotJsonBackedUp) {
                console.log('Restoring package.json');
                await api.copyPackageDotJson(PACKAGE_DOT_JSON_PATH_BAK, PACKAGE_DOT_JSON_PATH);
                await removeFileAsync(PACKAGE_DOT_JSON_PATH_BAK);
            }
        }
    }

};

// We only want to run this code if it's invoked from sfdx_sign
if (process.argv && process.argv.length > 0 && (_.includes(process.argv[1], BIN_NAME) || _.includes(process.argv[1], pathBasename(process.argv[1])))) {
    (async () => api.doPackAndSign(process.argv))();
} else {
    console.log(process.argv);
    console.log();
}
