// import { createReadStream, createWriteStream, readFile } from 'fs';
import * as fs from 'fs';
import * as path from 'path';
import { URL } from 'url';
import _ = require('lodash');
import { fork } from 'child_process';
import * as request from 'request';
import { Readable, Writable } from 'stream';
import { promisify as utilPromisify } from 'util';

import {
    CodeVerifierInfo,
    validateRequestCert,
    validSalesforceHostname,
    verify
} from './codeSignApi';

import { NamedError, UnexpectedHost, UnauthorizedSslConnection, SignSignedCertError } from '../util/NamedError';

export const WHITELIST_FILENAME = 'unsignedPluginWhiteList.json';

export const DEFAULT_REGISTRY = 'https://registry.npmjs.org/';

export const getNpmRegistry = () => {
    return new URL(process.env.SFDX_NPM_REGISTRY || DEFAULT_REGISTRY);
};

/**
 * simple data structure representing the discovered meta information needed for signing,
 */
export class NpmMeta {
    public tarballUrl: string;
    public signatureUrl: string;
    public publicKeyUrl: string;
    public tarballLocalPath: string;
    public verified: boolean;
}

/**
 * class for verifying a digital signature pack of an npm
 */
export class InstallationVerification {

    // The name of the published plugin
    private pluginName: string;

    // The tag name associated with plugin
    private pluginTag: string;

    // config from cli engine
    private config: any;

    // Reference for the http client;
    private requestImpl;

    // Reference for fs
    private fsImpl;

    private readFileAsync;

    constructor(requestImpl?: any, fsImpl?: any) {
        // why? dependency injection is better than sinon
        this.requestImpl = requestImpl ? requestImpl : request;
        this.fsImpl = fsImpl ? fsImpl : fs;
        this.readFileAsync = utilPromisify(this.fsImpl.readFile);

        this.pluginTag = 'latest';
    }

    /**
     * setter for the cli engine config
     * @param _config cli engine config
     */
    public setCliEngineConfig(_config?: any): InstallationVerification {
        if (_config) {
            this.config = _config;
            return this;
        }
        throw new NamedError('InvalidParam', 'the cli engine config cannot be null');
    }

    /**
     * setter for the plugin name
     * @param _pluginName the published plugin name
     */
    public setPluginName(_pluginName?: string | undefined): InstallationVerification {
        if (_pluginName) {
            this.pluginName = _pluginName;
            return this;
        }
        throw new NamedError('InvalidParam', 'pluginName cannot be nll');
    }

    /**
     * Setter for the plugin tad. If falsy the tag will be latest.
     * @param _tagName Setter for the plugin tag
     */
    public setPluginTag(_tagName?: string): InstallationVerification {
        if (_tagName) {
            this.pluginTag = _tagName;
        }
        return this;
    }

    /**
     * return the plugins tag name. 'latest' is returned by default
     */
    public getPluginTag() {
        return this.pluginTag;
    }

    /**
     * validates the digital signature.
     */
    public async verify(): Promise<NpmMeta> {
        const npmMeta = await this.streamTagGz();
        const info = new CodeVerifierInfo();
        info.dataToVerify = this.fsImpl.createReadStream(npmMeta.tarballLocalPath, {encoding: 'binary'});

        return Promise.all([
            this.getSigningContent(npmMeta.signatureUrl),
            this.getSigningContent(npmMeta.publicKeyUrl)
        ])
            .then((result) => {
                info.signatureStream = result[0];
                info.publicKeyStream = result[1];
                return verify(info);
            })
            .then((result) => {
                npmMeta.verified = result;
                return npmMeta;
            })
            .catch((e) => {
                if (e.code === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
                    throw new SignSignedCertError();
                }
                throw e;
            });
    }

    public async isWhiteListed() {
        const whitelistFilePath = path.join(this.getConfigPath(), WHITELIST_FILENAME);
        try {
            const fileContent = await this.readFileAsync(whitelistFilePath);

            const whitelistArray = JSON.parse(fileContent);
            return whitelistArray && whitelistArray.includes(this.pluginName);
        } catch (err) {
            if (err.code === 'ENOENT') {
                return false;
            } else {
                throw err;
            }
        }
    }

    /**
     * Retrieve url content for a host
     * @param url host url.
     */
    public getSigningContent(url): Promise<Readable> {
        return new Promise((resolve, reject) => {
            this.requestImpl(url, (err, response, responseData) => {
                if (err) {
                    reject(err);
                } else {
                    if (response && response.statusCode === 200) {
                        // The verification api expects a readable
                        resolve(new Readable({
                            read() {
                                this.push(responseData);
                                this.push(null);
                            }
                        }));
                    } else {
                        reject(new NamedError('ErrorGettingContent', `A request to url ${url} failed with error code: [${response ?  response.statusCode : 'undefined'}]`));
                    }
                }
            });
        });
    }

    /**
     * Downloads the tgz file content and stores it in a cache folder
     */
    public async streamTagGz(): Promise<NpmMeta> {
        const npmMeta = await this.retrieveNpmMeta();
        const urlObject: any = new URL(npmMeta.tarballUrl);
        const urlPathsAsArray = _.split(urlObject.pathname, '/');
        const fileNameStr: any = _.last(urlPathsAsArray);
        return new Promise<NpmMeta>((resolve, reject) => {
            const cacheFilePath = path.join(this.getCachePath(), fileNameStr);
            const writeStream = this.fsImpl.createWriteStream(cacheFilePath, { encoding: 'binary' });
            const req = this.requestImpl(npmMeta.tarballUrl)
                .on('end', () => {
                    npmMeta.tarballLocalPath = cacheFilePath;
                    resolve(npmMeta);
                })
                .on('error', (err) => {
                    reject(err);
                })
                .pipe(writeStream);
        });
    }

    // this is generally $HOME/.config/sfdx
    private getConfigPath(): string {
        return _.get(this.config, 'configDir');
    }

    // this is generally $HOME/Library/Caches/sfdx on mac
    private getCachePath(): string {
        return _.get(this.config, 'cacheDir');
    }

    /**
     * Invoke npm to discover a urls for the certificate and digital signature.
     */
    private async retrieveNpmMeta(): Promise<NpmMeta> {
        return new Promise<NpmMeta>((resolve, reject) => {
            // console.log('@TODO - support proxies');
            // console.log('@TODO - https thumbprints');
            const npmRegistry = getNpmRegistry();
            npmRegistry.pathname = this.pluginName;
            this.requestImpl(npmRegistry.href, (err, response, body) => {
                if (response && response.statusCode === 200) {
                    const responseObj = JSON.parse(body);

                    // Make sure the response has a version attribute
                    if (!responseObj.versions) {
                        reject(new NamedError('InvalidNpmMetadata', `The npm metadata for plugin ${this.pluginName} is missing the versions attribute.`));
                    }

                    // Assume the tag is version tag.
                    let versionObject: any = _.get(responseObj.versions, this.pluginTag);

                    // If the assumption was not correct the tag must be a non-versioned dist-tag or not specified.
                    if (!versionObject) {

                        // Assume dist-tag;
                        const distTags: string = _.get(responseObj, 'dist-tags');
                        if (distTags) {
                            const tagVersionStr: string = _.get(distTags, this.pluginTag);

                            // if we got a dist tag hit look up the version object
                            if (tagVersionStr && tagVersionStr.length > 0 && _.includes(tagVersionStr, '.')) {
                                versionObject = _.get(responseObj.versions, tagVersionStr);
                            } else {
                                reject(new NamedError('NpmTagNotFound', `The dist tag ${this.pluginTag} was not found for plugin: ${this.pluginName}`));
                            }
                        } else {
                            reject(new NamedError('UnexpectedNpmFormat', 'The deployed NPM is missing dist-tags.'));
                        }
                    }

                    if (!(versionObject && versionObject.sfdx)) {
                        reject(new NamedError('NotSigned', 'This plugin is not signed by Salesforce.com ,Inc'));
                    } else {
                        const meta: NpmMeta = new NpmMeta();
                        if (!validSalesforceHostname(versionObject.sfdx.publicKeyUrl)) {
                            reject(new UnexpectedHost(versionObject.sfdx.publicKeyUrl));
                        } else {
                            meta.publicKeyUrl = versionObject.sfdx.publicKeyUrl;
                        }

                        if (!validSalesforceHostname(versionObject.sfdx.signatureUrl)) {
                            reject(new UnexpectedHost(versionObject.sfdx.signatureUrl));
                        } else {
                            meta.signatureUrl = versionObject.sfdx.signatureUrl;
                        }

                        meta.tarballUrl = versionObject.dist.tarball;

                        resolve(meta);
                    }
                } else {
                    reject(new NamedError('UrlRetrieve', `The url request returned ${response.statusCode} - ${npmRegistry.href}`));
                }
            });
        });
    }
}

export class VerificationConfig {
    private _verifier: InstallationVerification;
    private _log: any;
    private _prompt: any;

    public get verifier(): InstallationVerification {
        return this._verifier;
    }

    public set verifier(value: InstallationVerification) {
        this._verifier = value;
    }

    public get log(): any {
        return this._log;
    }

    public set log(value: any) {
        this._log = value;
    }

    public get prompt(): any {
        return this._prompt;
    }

    public set prompt(value: any) {
        this._prompt = value;
    }
}

export async function doInstallationCodeSigningVerification(config: any, {plugin, tag}: {plugin: any, tag: string}, verificationConfig: VerificationConfig) {
    try {
        const meta = await verificationConfig.verifier.verify();
        if (!meta.verified) {
            throw new NamedError('FailedDigitalSignatureVerification',
                'A digital signature is specified for this plugin but it didn\'t verify against the certificate.');
        }
        verificationConfig.log(`Successfully validated digital signature for ${plugin}.`);
    } catch (err) {
        if (err.name === 'NotSigned') {

            if (await verificationConfig.verifier.isWhiteListed()) {
                verificationConfig.log(`The plugin [${plugin}] is not digitally signed but it is white-listed.`);
                return;
            } else {
                const _continue = await verificationConfig.prompt('This plugin is not digitally signed and its authenticity cannot be verified. Continue installation y/n?');
                switch (_.toLower(_continue)) {
                    case 'y':
                        return;
                    default:
                        throw new NamedError('CanceledByUser', 'The plugin installation has been cancel by the user.');
                }
            }
        }
        throw err;
    }
}
