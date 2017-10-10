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

import { Config } from 'cli-engine-config';
import { CLI } from 'cli-ux';
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

const cliUx = new CLI();

export const api = {

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

        try {

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
            const sigFilename = `${packageJson.name}-v${packageJson.version}.sig`;

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

                // verify the signature with the public key url
                const verified = await api.verify(
                    createReadStream(filepath, { encoding: 'binary' }),
                    createReadStream(pathJoin(process.cwd(), sigFilename)),
                    args.publicKeyUrl);

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
            process.exitCode = 1;
            cliUx.error(`ERROR: ${e.message}`);
            if (e.reason) {
                cliUx.error(e.reason.message);
            }
        } finally {
            // Restore the package.json file so it doesn't show a git diff.
            if (packageDotJsonBackedUp) {
                cliUx.log('Restoring package.json');
                await api.copyPackageDotJson(PACKAGE_DOT_JSON_PATH_BAK, PACKAGE_DOT_JSON_PATH);
                await removeFileAsync(PACKAGE_DOT_JSON_PATH_BAK);
            }
        }
    }

};
