import * as fs from "fs";
import * as path from "path";
import { parse as urlParse } from "url";
import _ = require("lodash");
import { fork } from "child_process";
import request = require("request");
import _Promise = require("bluebird");
import { Readable, Writable } from "stream";

import {
    CodeVerifierInfo,
    validateRequestCert,
    validSalesforceDomain,
    verify
} from "./codeSignApi";

import { NamedError, InvalidSalesforceDomain } from "../util/NamedError";
import { get as httpsGet } from "https";

function log(message: string) {
    console.log(message);
}

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
    // config from cli engine
    private config: any;

    /**
     * setter for the cli engine config
     * @param _config cli engine config
     */
    public setCliEngineConfig(_config: any): InstallationVerification {
        if (_config) {
            this.config = _config;
            return this;
        }
        throw new Error("the cli engine config cannot be null");
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
        throw new Error("pluginName cannot be nll");
    }

    /**
     * validates the digital signature.
     */
    public async verify(): _Promise<NpmMeta> {
        const npmMeta = await this.streamTagGz();
        const info = new CodeVerifierInfo();
        info.dataToVerify = fs.createReadStream(npmMeta.tarballLocalPath, {encoding: "binary"});

        const publicKeyReq = httpsGet(this.getHttpOptions(npmMeta.publicKeyUrl));
        validateRequestCert(publicKeyReq, npmMeta.publicKeyUrl);
        info.publicKeyStream = await this.retrieveUrlContent(publicKeyReq, npmMeta.publicKeyUrl);

        const signatureReq = httpsGet(this.getHttpOptions(npmMeta.signatureUrl));
        validateRequestCert(signatureReq, npmMeta.signatureUrl);
        info.signatureStream = await this.retrieveUrlContent(signatureReq, npmMeta.signatureUrl);

        const valid = await verify(info);
        npmMeta.verified = valid;
        return npmMeta;
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
            port: urlParsed.port
        };
    }

    /**
     * obtains a readable http response stream
     * @param req - the https request object
     * @param _url - url object
     */
    private retrieveUrlContent(req, _url: string): _Promise<Readable> {
        return new _Promise((resolve, reject) => {
            req.on("response", (resp) => {
                if (resp && resp.statusCode === 200) {
                    resolve(resp);
                } else {
                    reject(new NamedError("RetrieveFailed", `Failed to retrieve content at ${_url} error code: ${resp.statusCode}.`));
                }
            });
        });
    }

    private getDataPath(): string {
        return _.get(this.config, "__cache.dir:data");
    }

    private getCachePath(): string {
        return _.get(this.config, "__cache.dir:cache");
    }

    private getYarnPath(): string {
        if (this.config) {
            const dataPath = this.getDataPath();
            return path.join(dataPath, "client", "node_modules", "cli-engine", "yarn", "yarn.js" );
        } else {
            throw new Error("Please specify the cliEngine Config");
        }
    }

    /**
     * Invoke yarn to discover a urls for the certificate and digital signature.
     */
    private async retrieveNpmMeta(): _Promise<NpmMeta> {
        return new _Promise<NpmMeta>((resolve, reject) => {
            // console.log("@TODO - support proxies");
            // console.log("@TODO - https thumbprints");
            const yarnPath = this.getYarnPath();

            const options = {
                env: process.env,
                // Silly debug port is required for the node process.
                execArgv: [],
                stdio: [null, null, null, "ipc"]
            };
            const yarnFork = fork(yarnPath, ["info", this.pluginName, "--json", "--non-interactive"], options);

            yarnFork.stdout.setEncoding("utf8");
            yarnFork.stderr.setEncoding("utf8");

            let jsonContent = "";
            let errorContent = "";

            yarnFork.stdout.on("data", (data) => {
                if (data) {
                    jsonContent += data;
                }
            });
            yarnFork.stderr.on("data", (data) => {
                if (data) {
                    errorContent += data;
                }
            });

            yarnFork.on("error", (err) => {
                reject(new Error(`plugins install verification failed with: ${err.name}`));
            });

            yarnFork.on("close", (code) => {
                if (code === 0) {

                    let metadata;
                    try {
                        metadata = JSON.parse(jsonContent);
                    } catch (e) {
                        reject(new Error(`failed parsing metadata json value: ${metadata}`));
                    }
                    const meta = new NpmMeta();

                    if (!metadata.data.sfdx) {
                        reject(new NamedError("NotSigned", "This plugin is not signed by Salesforce.com ,Inc"));
                    } else {

                        if (!validSalesforceDomain(metadata.data.sfdx.publicKeyUrl)) {
                            reject(new InvalidSalesforceDomain(metadata.data.sfdx.publicKeyUrl));
                        } else {
                            meta.publicKeyUrl = metadata.data.sfdx.publicKeyUrl;
                        }

                        if (!validSalesforceDomain(metadata.data.sfdx.signatureUrl)) {
                            reject(new InvalidSalesforceDomain(metadata.data.sfdx.signatureUrl));
                        } else {
                            meta.signatureUrl = metadata.data.sfdx.signatureUrl;
                        }

                        meta.tarballUrl = metadata.data.dist.tarball;
                    }

                    resolve(meta);
                } else {
                    reject(new Error(errorContent));
                }
            });
        });
    }

    /**
     * Downloads the tgz file content and stores it in a yarn cache folder
     */
    private async streamTagGz(): _Promise<NpmMeta> {
        const npmMeta = await this.retrieveNpmMeta();
        const urlPathsAsArray = _.split(urlParse(npmMeta.tarballUrl).pathname, "/");
        const fileNameStr = _.last(urlPathsAsArray);
        return new _Promise<Buffer>((resolve, reject) => {
            const cacheFilePath = path.join(this.getCachePath(), fileNameStr);
            const writeStream = fs.createWriteStream(cacheFilePath, { encoding: "binary" });
            const req = request(npmMeta.tarballUrl)
                .on("end", () => {
                    npmMeta.tarballLocalPath = cacheFilePath;
                    resolve(npmMeta);
                })
                .on("error", (err) => {
                    reject(err);
                })
                .pipe(writeStream);
        });
    }
}
