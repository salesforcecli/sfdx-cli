// import { createReadStream, createWriteStream, readFile } from 'fs';
import * as fs from 'fs';
import * as path from 'path';
import { parse as urlParse } from 'url';
import _ = require('lodash');
import { fork } from 'child_process';
import request = require('request');
import { Readable, Writable } from 'stream';
import { promisify as utilPromisify } from 'util';

import {
    CodeVerifierInfo,
    validateRequestCert,
    validSalesforceHostname,
    verify
} from './codeSignApi';

import { NamedError, UnexpectedHost, UnauthorizedSslConnection } from '../util/NamedError';
import { get as httpsGet } from 'https';
import { EOL } from 'os';

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

        const signatureReq = httpsGet(this.getHttpOptions(npmMeta.signatureUrl));
        validateRequestCert(signatureReq, npmMeta.signatureUrl);
        info.signatureStream = await this.retrieveUrlContent(signatureReq, npmMeta.signatureUrl);

        const publicKeyReq = httpsGet(this.getHttpOptions(npmMeta.publicKeyUrl));
        validateRequestCert(publicKeyReq, npmMeta.publicKeyUrl);
        info.publicKeyStream = await this.retrieveUrlContent(publicKeyReq, npmMeta.publicKeyUrl);

        const valid = await verify(info);
        npmMeta.verified = valid;
        return npmMeta;
    }

    public async isWhiteListed() {
        const whitelistFilePath = path.join(this.getConfigPath(), WHITELIST_FILENAME);

        const fileContent = await this.readFileAsync(whitelistFilePath);
        const whitelistArray = JSON.parse(fileContent);

        return whitelistArray && whitelistArray.includes(this.pluginName);
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

    private getYarnPath(): string {
        if (this.config) {
            const dataPath = this.getDataPath();
            return path.join(dataPath, 'client', 'node_modules', 'cli-engine', 'yarn', 'yarn.js' );
        } else {
            throw new Error('Please specify the cliEngine Config');
        }
    }

    /**
     * Invoke yarn to discover a urls for the certificate and digital signature.
     */
    private async retrieveNpmMeta(): Promise<NpmMeta> {
        return new Promise<NpmMeta>((resolve, reject) => {
            // console.log('@TODO - support proxies');
            // console.log('@TODO - https thumbprints');
            const yarnPath = this.getYarnPath();

            const options = {
                env: process.env,
                // Silly debug port is required for the node process.
                execArgv: [],
                stdio: [null, null, null, 'ipc']
            };
            const yarnFork = fork(yarnPath, ['info', this.pluginName, '--json', '--non-interactive'], options);

            yarnFork.stdout.setEncoding('utf8');
            yarnFork.stderr.setEncoding('utf8');

            let jsonContent = '';
            let errorContent = '';

            yarnFork.stdout.on('data', (data) => {
                if (data) {
                    jsonContent += data;
                }
            });
            yarnFork.stderr.on('data', (data) => {
                if (data) {
                    errorContent += data;
                }
            });

            yarnFork.on('error', (err) => {
                reject(new Error(`plugins install verification failed with: ${err.name}`));
            });

            yarnFork.on('close', (code) => {
                if (code === 0) {

                    let metadata;
                    try {
                        metadata = JSON.parse(jsonContent);
                    } catch (e) {
                        reject(new Error(`failed parsing metadata json value: ${metadata}`));
                    }
                    const meta = new NpmMeta();

                    if (!metadata.data.sfdx) {
                        reject(new NamedError('NotSigned', 'This plugin is not signed by Salesforce.com ,Inc'));
                    } else {

                        if (!validSalesforceHostname(metadata.data.sfdx.publicKeyUrl)) {
                            reject(new UnexpectedHost(metadata.data.sfdx.publicKeyUrl));
                        } else {
                            meta.publicKeyUrl = metadata.data.sfdx.publicKeyUrl;
                        }

                        if (!validSalesforceHostname(metadata.data.sfdx.signatureUrl)) {
                            reject(new UnexpectedHost(metadata.data.sfdx.signatureUrl));
                        } else {
                            meta.signatureUrl = metadata.data.sfdx.signatureUrl;
                        }

                        meta.tarballUrl = metadata.data.dist.tarball;
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
                    reject(new NamedError('InternalYarnError', returnError));
                }
            });
        });
    }

    /**
     * Downloads the tgz file content and stores it in a yarn cache folder
     */
    private async streamTagGz(): Promise<NpmMeta> {
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
                const _continue = await verificationConfig.prompt('This plugin is not digitally signed and its authenticity cannot be verified. Continue Installation y/n?');
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
