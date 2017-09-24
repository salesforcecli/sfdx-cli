#!/usr/bin/env node

import { exec } from "child_process";
import { copy as copyFile, createReadStream, createWriteStream, readFile, writeFile } from "fs-extra";
import { get as httpGet } from "http";
import { parse as parseUrl } from "url";
import { Writable, Readable } from "stream";
import { join as pathJoin } from "path";
import { parse as parsePath } from "path";
import { sep as pathSep } from "path";

import { _ } from "lodash";

import _Promise = require("bluebird");
import { ExecProcessFailed, InvalidUrlError, MissingRequiredParameter, NamedError } from "../util/NamedError";
import parseSimpleArgs from "../util/simpleArgs";

import { CodeSignInfo, CodeVerifierInfo, default as sign, verify } from "../codeSigning/sign";

const readFileAsync = _Promise.promisify(readFile);
const writeFileAsync = _Promise.promisify(writeFile);

const PACKAGE_DOT_JSON = "package.json";
const PACKAGE_DOT_JSON_PATH = pathJoin(process.cwd(), PACKAGE_DOT_JSON);
const PACKAGE_DOT_JSON_PATH_BAK = pathJoin(process.cwd(), `${PACKAGE_DOT_JSON}.bak`);

export const api = {
    getHelp() {
        return _.trim(`
Build function that will perform four things:
1) update the npm cert and signature home url in package.json
2) pack the npm into a tar gz file
3) sign the tar gz file using the private key associated with the cert.
4) test verify the signature

Requried Parameters:
--signatureUrl - the url where the signature will be hosted minus the name of the signature file.
--publicKeyUrl - the url where the public key/certificate will be hosted.
--privateKeyPath - the local file path for the private key

Returns:
A tar.gz and signature file. The signature file will match the name of the tar gz except the extention will be ".sig".
This file must be hosted at the location specified by --signature.

Usage:
yarn run packAndSign --signature http://foo.salesforce.internal.com/file/location --publicKeyUrl http://foo.salesforce.internal.com/file/location/sfdx.cert --privateKeyPath $HOME/sfdx.key
`);
    },

    validateUrl(url: string) {
        try {
            const urlObj = parseUrl(url);
            if (!urlObj.host) {
                throw new InvalidUrlError(url);
            }
        } catch (e) {
            const err = new InvalidUrlError(url);
            err.reason = e;
            throw err;
        }
    },

    validate(args) {
        if (args) {
            if (!args.signatureUrl) {
                throw new MissingRequiredParameter("--signatureUrl");
            }
            api.validateUrl(args.signatureUrl);

            if (!args.publicKeyUrl) {
                throw new MissingRequiredParameter("--publicKeyUrl");
            }
            api.validateUrl(args.publicKeyUrl);

            if (!args.privateKeyPath) {
                throw new MissingRequiredParameter("privateKeyPath");
            }
        } else {
            throw new NamedError("InvalidArgs", "Invalid args.");
        }
    },

    async pack(): _Promise<string> {
        return new _Promise((resolve, reject) => {
            const command: string = "yarn pack --json";
            exec(command, (error: any, stdout: string, stderr: string) => {
                if (error && error.code) {
                    const err = new ExecProcessFailed(command, error.code).setReasonByMessage(stderr);
                    reject(err);
                } else {
                    const data = JSON.parse(stdout).data;
                    const path = _.find(_.split(data, "\""), (word) => _.includes(word, "tgz"));
                    if (!path) {
                        reject(new NamedError("UnexpectedYarnFormat", `Yarm pack did not retrun an epxected tgz result: [${data}]`));
                    } else {
                        resolve(path);
                    }
                }
            });
        });
    },

    async verify(tarGzStream: Readable, sigFilenameStream: Readable, publicKeyUrl: string): _Promise<boolean> {
        return new _Promise((resolve, reject) => {
            const verifyInfo = new CodeVerifierInfo();
            verifyInfo.dataToVerify = tarGzStream;
            verifyInfo.signatureStream = sigFilenameStream;

            const req = httpGet(publicKeyUrl, (resp) => {
                if (resp && resp.statusCode === 200) {
                    verifyInfo.publicKeyStream = resp;
                    resolve(verify(verifyInfo));
                } else {
                    reject(new NamedError("RetreivePublicKeyFailed", `Couldn't retrieve public key at url: ${publicKeyUrl}`));
                }

            });
        });
    },

    async retrieveSignature(fileStream: Readable, privateKeyStream: Readable) {
        const info = new CodeSignInfo();
        info.dataToSignStream = fileStream;
        info.privateKeyStream = privateKeyStream;
        return sign(info);
    },

    async writeSignatureFile(filepath, signature) {
        console.info(`Signing file at filepath: ${filepath}`);
        const sigFilename = _.replace(_.last(_.split(filepath, pathSep)), ".tgz", ".sig");
        await writeFileAsync(pathJoin(process.cwd(), sigFilename), signature);
        return sigFilename;
    },

    async retrievePackageJson() {
        return readFileAsync(PACKAGE_DOT_JSON_PATH, { encoding: "utf8" });
    },

    async retrieveNpmIgnore() {
        return readFileAsync(pathJoin(process.cwd(), ".npmignore"), { encoding: "utf8" });
    },

    validateNpmIgnore(content) {
        const validate = (pattern) => {
            if (!content) {
                throw new NamedError("MissingNpmIgnoreFile",
                    "Missing npmignore file. The following patterns are required for code signing: *.tgz, *.sig, package.json.bak");
            }

            if (!_.includes(content, pattern)) {
                throw new NamedError("MissingIgnorePatten",
                    `.npmignore is missing ${pattern}. The following patterns are required for code signing: *.tgz, *.sig, package.json.bak`);
            }
        };
        validate("*.tgz");
        validate("*.sig");
        validate("package.json.bak");
    },

    async copyPackageDotJson(src, dest) {
        console.log("copyPackageDotJson");
        return copyFile(src, dest);
    },

    async writePackageJson(pJson) {
        return writeFileAsync(PACKAGE_DOT_JSON_PATH, JSON.stringify(pJson));
    },

    async doPackAndSign(processArgv) {
        let packageDotJsonBackedUp = false;
        const args = parseSimpleArgs(processArgv);

        if (args.help) {
            console.log(api.getHelp());
            return;
        }

        try {
            api.validate(args);

            // validate npm ignore has what we name.
            const npmIgnoreContent = await api.retrieveNpmIgnore();
            api.validateNpmIgnore(npmIgnoreContent);

            // read package.json info
            const packageJsonContent = await api.retrievePackageJson();
            let packageJson = JSON.parse(packageJsonContent);

            // compute the name of the signature file
            const sigFilename = `${packageJson.name}-v${packageJson.version}.sig`;

            // make a backup of the signature file
            await api.copyPackageDotJson(PACKAGE_DOT_JSON_PATH, PACKAGE_DOT_JSON_PATH_BAK);
            packageDotJsonBackedUp = true;

            // update the package.json object with the signature urls and write it to disk.
            const sigUrl = `${args.signatureUrl}${_.endsWith(args.signatureUrl, "/") ? "" : "/"}${sigFilename}`;
            packageJson = _.merge(packageJson, { signature: { publicKeyUrl: args.publicKeyUrl, signatureUrl: `${sigUrl}` } });
            await api.writePackageJson(packageJson);

            console.log("Successfully updated package.json with public key and signature file locations.");

            // create the tgz file
            const filepath = await api.pack();

            // create the signature file
            const signature = await api.retrieveSignature(
                createReadStream(filepath, { encoding: "binary" }), createReadStream(args.privateKeyPath));

            if (signature && signature.length > 0) {

                // write the signature file to disk
                await api.writeSignatureFile(filepath, signature);

                console.info(`Artifact signed and saved in ${sigFilename}`);

                // verify the signature with the public key url
                const verified = await api.verify(
                    createReadStream(filepath, { encoding: "binary" }),
                    createReadStream(pathJoin(process.cwd(), sigFilename)),
                    args.publicKeyUrl);

                if (verified) {
                    console.log(`Successfully verified signature with public key at: ${args.publicKeyUrl}`);
                } else {
                    throw new NamedError("FailedToVerifySignature", `Failed to verify signature with tar gz content`);
                }
            } else {
                throw new NamedError("EmptySignature", "The generated signature is empty. Verify the private key and try again");
            }
        } catch (e) {
            console.error(`ERROR: ${e.message}`);
            if (e.reason) {
                console.error(e.reason.message);
            }
        } finally {
            // Restore the package.json file so it doesn"t show a git diff.
            if (packageDotJsonBackedUp) {
                await api.copyPackageDotJson(PACKAGE_DOT_JSON_PATH_BAK, PACKAGE_DOT_JSON_PATH);
            }
        }
    }

};

(async () => api.doPackAndSign(process.argv))();
