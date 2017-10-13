// import { createReadStream, createWriteStream, readFile } from 'fs';
import * as fs from 'fs';
import * as path from 'path';
import { parse as urlParse } from 'url';
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

import { NamedError, UnexpectedHost, UnauthorizedSslConnection } from '../util/NamedError';

export const WHITELIST_FILENAME = 'unsignedPluginWhiteList.json';

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

    private readFileAsync;

    // The name of the published plugin
    private pluginName: string;
    // config from cli engine
    private config: any;

    constructor() {
        this.readFileAsync = utilPromisify(fs.readFile);
    }

    /**
     * setter for the cli engine config
     * @param _config cli engine config
     */
    public setCliEngineConfig(_config: any): InstallationVerification {
        if (_config) {
            this.config = _config;
            return this;
        }
        throw new Error('the cli engine config cannot be null');
    }

    /**
     * setter for the plugin name
     * @param _pluginName the published plugin name
     */
    public setPluginName(_pluginName: string): InstallationVerification {
        if (_pluginName) {
            this.pluginName = _pluginName;
            return this;
        }
        throw new Error('pluginName cannot be nll');
    }

    /**
     * validates the digital signature.
     */
    public async verify(): Promise<NpmMeta> {
        const npmMeta = await this.streamTagGz();
        const info = new CodeVerifierInfo();
        info.dataToVerify = fs.createReadStream(npmMeta.tarballLocalPath, {encoding: 'binary'});

        return Promise.all([this.getSigningContent(npmMeta.signatureUrl), this.getSigningContent(npmMeta.publicKeyUrl)])
            .then((result) => {
                info.signatureStream = result[0];
                info.publicKeyStream = result[1];
                return verify(info);
            }).then((result) => {
                npmMeta.verified = result;
                return npmMeta;
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
            request(url, (err, response, responseData) => {
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
                        reject(new NamedError('ErrorGettingContent', `A request to url ${url} failed with error code: [${response ? 'undefined' : response.statusCode}]`));
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
        const urlObject: any = urlParse(npmMeta.tarballUrl);
        const urlPathsAsArray = _.split(urlObject.pathname, '/');
        const fileNameStr: any = _.last(urlPathsAsArray);
        return new Promise<NpmMeta>((resolve, reject) => {
            const cacheFilePath = path.join(this.getCachePath(), fileNameStr);
            const writeStream = fs.createWriteStream(cacheFilePath, { encoding: 'binary' });
            const req = request(npmMeta.tarballUrl)
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

    /**
     * returns the http request options parse from a url
     * @param _url http url
     */
    private getHttpOptions(_url: string) {
        const urlParsed = urlParse(_url);
        return {
            host: urlParsed.hostname,
            path: urlParsed.path,
            port: urlParsed.port,
            // We need to create a new session for each request. The publicKey and Signature could come from the
            // same server. Setting agent to false forces a SSL handshake for subsequent requests. Bad for a webpages
            // Good for digital signatures and public keys.
            agent: false
        };
    }

    /**
     * obtains a readable http response stream
     * @param req - the https request object
     * @param _url - url object
     */
    private retrieveUrlContent(req: any, _url: string): Promise<Readable> {
        return new Promise((resolve, reject) => {
            req.on('response', (resp: any) => {
                if (resp && resp.statusCode === 200) {
                    console.log(`${_url} resolved`);
                    resolve(resp);
                } else {
                    reject(new NamedError('RetrieveFailed', `Failed to retrieve content at ${_url} error code: ${resp.statusCode}.`));
                }
            });
            req.on('error', (err) => {
                if (err.code === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
                    throw new UnauthorizedSslConnection(_url);
                }
                throw err;
            });
        });
    }

    // this is generally $HOME/.config/sfdx
    private getConfigPath(): string {
        return _.get(this.config, 'configDir');
    }

    // this is generally $HOME/.local/share/sfd
    private getDataPath(): string {
        return _.get(this.config, 'dataDir');
    }

    // this is generally $HOME/Library/Caches/sfdx on mac
    private getCachePath(): string {
        return _.get(this.config, 'cacheDir');
    }

    private getNpmPath(): string {
        if (this.config) {
            return path.join(__dirname, '..', '..', 'node_modules', 'npm', 'cli.js' );
        } else {
            throw new Error('Please specify the cliEngine Config');
        }
    }

    /**
     * Invoke npm to discover a urls for the certificate and digital signature.
     */
    private async retrieveNpmMeta(): Promise<NpmMeta> {
        return new Promise<NpmMeta>((resolve, reject) => {
            // console.log('@TODO - support proxies');
            // console.log('@TODO - https thumbprints');
            const npmPath = this.getNpmPath();

            const options = {
                env: process.env,
                // Silly debug port is required for the node process.
                execArgv: [],
                stdio: [null, null, null, 'ipc']
            };
            const npmFork = fork(npmPath, ['info', this.pluginName, '--json'], options);

            npmFork.stdout.setEncoding('utf8');
            npmFork.stderr.setEncoding('utf8');

            let jsonContent = '';
            let errorContent = '';

            npmFork.stdout.on('data', (data) => {
                if (data) {
                    jsonContent += data;
                }
            });
            npmFork.stderr.on('data', (data) => {
                if (data) {
                    errorContent += data;
                }
            });

            npmFork.on('error', (err) => {
                reject(new Error(`plugins install verification failed with: ${err.name}`));
            });

            npmFork.on('close', (code) => {
                if (code === 0) {

                    let metadata;
                    try {
                        metadata = JSON.parse(jsonContent);
                    } catch (e) {
                        reject(new Error(`failed parsing metadata json value: ${metadata}`));
                    }
                    const meta = new NpmMeta();

                    if (!metadata.sfdx) {
                        reject(new NamedError('NotSigned', 'This plugin is not signed by Salesforce.com ,Inc'));
                    } else {

                        if (!validSalesforceHostname(metadata.sfdx.publicKeyUrl)) {
                            reject(new UnexpectedHost(metadata.sfdx.publicKeyUrl));
                        } else {
                            meta.publicKeyUrl = metadata.sfdx.publicKeyUrl;
                        }

                        if (!validSalesforceHostname(metadata.sfdx.signatureUrl)) {
                            reject(new UnexpectedHost(metadata.sfdx.signatureUrl));
                        } else {
                            meta.signatureUrl = metadata.sfdx.signatureUrl;
                        }

                        meta.tarballUrl = metadata.dist.tarball;
                    }
                    resolve(meta);
                } else {
                    let returnError: any = errorContent;
                    try {
                        const _data = JSON.parse(errorContent);
                        if (_data.data) {
                            returnError = _data.data;
                        }
                    } catch (e) {
                        // Assume a parse failure is because the error isn't a json string. Just pass it along.
                    }
                    reject(new NamedError('InternalNpmError', returnError));
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
