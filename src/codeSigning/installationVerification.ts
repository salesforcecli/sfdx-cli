import * as fs from "fs";
import * as path from "path";
import * as url from "url";
import _ = require("lodash");
import { fork } from "child_process";
import { request } from "request";
import { _Promise } from "bluebird";

import { Writable } from "stream";

function log(message: string) {
    console.log(message);
}

class NpmMeta {
    public tarballUrl: string;
    public namespace: string;
}

class NamespaceUrlResolver {
    public resolve(namespace) {
        if (namespace && namespace === "force") {
            return "";
        }
    }
}

export class InstallationVerification {

    private pluginName: string;
    private config: any;

    public setCliEngineConfig(_config: any): InstallationVerification {
        if (_config) {
            this.config = _config;
            return this;
        }
        throw new Error("the cli engine config cannot be null");
    }

    public setPluginName(_pluginName: string): InstallationVerification {
        if (_pluginName) {
            this.pluginName = _pluginName;
            return this;
        }
        throw new Error("pluginName cannot be nll");
    }

    public async verify(): _Promise<any> {
        return this.streamTagGz();
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

    private async retrieveNpmMeta(): _Promise<NpmMeta> {
        return new _Promise<NpmMeta>((resolve, reject) => {
            const yarnPath = this.getYarnPath();

            const options = {
                env: process.env,
                // Silly debug port is required.
                execArgv: ["--inspect"],
                stdio: [null, null, null, "ipc"]
            };
            const yarnFork = fork(yarnPath, ["info", this.pluginName, "--json"], options);

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
                        metadata = JSON.parse(jsonContent.toString());
                    } catch (e) {
                        reject(new Error(`failed parsing metadata json value: ${metadata}`));
                    }
                    const meta = new NpmMeta();
                    meta.tarballUrl = metadata.data.dist.tarball;
                    meta.namespace = metadata.data.sfdx.namespace;
                    resolve(meta);
                } else {
                    throw new Error(errorContent);
                }
            });
        });
    }

    private async streamTagGz(): _Promise<Buffer> {

        const npmMeta = await this.retrieveNpmMeta();
        const urlPathsAsArray = _.split(url.parse(npmMeta.tarballUrl).pathname, "/");
        const fileNameStr = _.last(urlPathsAsArray);
        let returnString = "";

        return new _Promise<Buffer>((resolve, reject) => {
            const req = request(npmMeta.tarGzUrl);
            const cacheFilePath = path.join(this.getCachePath(), fileNameStr);
            req.pipe(fs.createWriteStream(cacheFilePath));

            const bufferedWriteStream = new Writable({
                write(chunk, encoding) {
                    returnString += chunk;
                }
            });

            req.pipe(bufferedWriteStream);
            req.on("error", (err) => {
                reject(err);
            });

            req.on("end", () => {
                resolve(returnString);
            });
        });
    }
}

const cliConfig = {
    __cache: {
        "dir:cache": "/Users/tnoonan/Library/Caches/sfdx",
        "dir:config": "/Users/tnoonan/.config/sfdx",
        "dir:data": "/Users/tnoonan/.local/share/sfdx"
    },
    foo: "bar"
};

const v = new InstallationVerification().setCliEngineConfig(cliConfig).setPluginName("test");
v.verify().then((buffer) => {
    console.log(buffer);
});
