#!/usr/bin/env node

import { exec } from 'child_process';
import { EOL } from 'os';
import {
    copy as copyFile,
    createReadStream,
    readFile,
    remove,
    writeFile
} from 'fs-extra';

import { URL } from 'url';
import { Writable, Readable } from 'stream';
import { join as pathJoin } from 'path';
import { parse as parsePath } from 'path';
import { sep as pathSep, basename as pathBasename } from 'path';

import { Config } from 'cli-engine-config';
import { CLI } from 'cli-ux';
import * as _ from 'lodash';
import * as request from 'request';

import {
    ExecProcessFailed,
    InvalidUrlError,
    MissingRequiredParameter,
    SignSignedCertError,
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

const cliUx = new CLI();

export const api = {

    /**
     * Validates that a url is a valid salesforce url.
     * @param url - The url to validate.
     */
    validateUrl(url: string) {
        try {
            const urlObj = new URL(url);
            if (!urlObj.host) {
                throw new InvalidUrlError(url);
            }
            if (!validSalesforceHostname(url)) {
                throw new NamedError('NotASalesforceHost', 'Signing urls must have the hostname developer.salesforce.com and be https');
            }
        } catch (e) {
            const err = new InvalidUrlError(url);
            err.reason = e;
            throw err;
        }
    },

    /**
     * call out to npm pack;
     */
    pack(): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            const command: string = 'npm pack -p -s';
            exec(command, (error: any, stdout: string, stderr: string) => {
                if (error && error.code) {
                    const err = new ExecProcessFailed(command, error.code).setReasonByMessage(stderr);
                    reject(err);
                } else {
                    const output = stdout.split(EOL);
                    if (output.length > 1) {
                        // note the output end with a newline;
                        const path = output[output.length - 2];
                        if (path && path.endsWith('tgz')) {
                            resolve(path);
                        } else {
                            reject(new NamedError('UnexpectedNpmFormat', `Npm pack did not return an expected tgz filename result: [${path}]`));
                        }
                    } else {
                        reject(new NamedError('UnexpectedNpmFormat', `The output from the npm utility is unexpected [${stdout}]`));
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

            const req = request.get(publicKeyUrl);
            validateRequestCert(req, publicKeyUrl);

            req.on('response', (response) => {
                if (response && response.statusCode === 200) {
                    verifyInfo.publicKeyStream = response;
                    resolve(verify(verifyInfo));
                } else {
                    reject(new NamedError('RetrievePublicKeyFailed', `Couldn't retrieve public key at url: ${publicKeyUrl} error code: ${response.statusCode}`));
                }
            });

            req.on('error', (err: any) => {
                if (err && err.code === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
                    reject(new SignSignedCertError());
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
        cliUx.log(`Signing file at: ${filePath}`);
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
    async doPackAndSign(args) {
        let packageDotJsonBackedUp = false;
        let error;

        try {

            api.validateUrl(args.signatureUrl);
            api.validateUrl(args.publicKeyUrl);

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
                cliUx.warn(`WARNING:  The following patterns are recommended in ${filename} for code signing: *.tgz, *.sig, package.json.bak.`);
            }

            // read package.json info
            const packageJsonContent = await api.retrievePackageJson();
            let packageJson = JSON.parse(packageJsonContent);

            // compute the name of the signature file
            const sigFilename = `${packageJson.name}-${packageJson.version}.sig`;

            // make a backup of the signature file
            await api.copyPackageDotJson(PACKAGE_DOT_JSON_PATH, PACKAGE_DOT_JSON_PATH_BAK);

            packageDotJsonBackedUp = true;
            cliUx.log(`Backed up ${PACKAGE_DOT_JSON_PATH} to ${PACKAGE_DOT_JSON_PATH_BAK}`);

            // update the package.json object with the signature urls and write it to disk.
            const sigUrl = `${args.signatureUrl}${_.endsWith(args.signatureUrl, '/') ? '' : '/'}${sigFilename}`;
            packageJson = _.merge(packageJson, { sfdx: { publicKeyUrl: args.publicKeyUrl, signatureUrl: `${sigUrl}` } });
            await api.writePackageJson(packageJson);

            cliUx.log('Successfully updated package.json with public key and signature file locations.');

            const filepath = await api.pack();

            // create the signature file
            const signature = await api.retrieveSignature(
                createReadStream(filepath, { encoding: 'binary' }), createReadStream(args.privateKeyPath));

            if (signature && signature.length > 0) {

                // write the signature file to disk
                await api.writeSignatureFile(filepath, signature);

                cliUx.log(`Artifact signed and saved in ${sigFilename}`);

                let verified;
                try {
                    // verify the signature with the public key url
                    verified = await api.verify(
                        createReadStream(filepath, { encoding: 'binary' }),
                        createReadStream(pathJoin(process.cwd(), sigFilename)),
                        args.publicKeyUrl);
                } catch (e) {
                    const e1 = new NamedError('VerificationError', 'An error occurred trying to validate the signature. Check the public key url and try again.');
                    e1.reason = e;
                    throw e1;
                }

                if (verified) {
                    cliUx.log(`Successfully verified signature with public key at: ${args.publicKeyUrl}`);
                    return verified;
                } else {
                    throw new NamedError('FailedToVerifySignature', 'Failed to verify signature with tar gz content');
                }
            } else {
                throw new NamedError('EmptySignature', 'The generated signature is empty. Verify the private key and try again');
            }
        } catch (e) {
             error = e;
        } finally {

            // Restore the package.json file so it doesn't show a git diff.
            if (packageDotJsonBackedUp) {
                cliUx.log('Restoring package.json');
                await api.copyPackageDotJson(PACKAGE_DOT_JSON_PATH_BAK, PACKAGE_DOT_JSON_PATH);
                await removeFileAsync(PACKAGE_DOT_JSON_PATH_BAK);
            }

            if (error) {
                if (error.reason) {
                    cliUx.error(`ERROR: ${error.message} REASON: ${error.reason.message}`);
                } else {
                    cliUx.error(`ERROR: ${error.message}`);
                }
                process.exitCode = 1;
            }
        }
    }

};
