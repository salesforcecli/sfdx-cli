
import { Config } from "cli-engine-config";
import * as debug from "debug";
import * as path from "path";

import * as cp from "child_process";

async function run(config: Config, opts: any) {
    try {
        const start = Date.now();
        const command = opts.Command;

        // Only log usage for commands with plugins
        if (command && command.plugin) {
            process.on("exit", () => {
                cp.fork(path.join(__dirname, "../processes/logUsage"), [], { execArgv: [] }).send({
                    config,
                    plugin: command.plugin,
                    commandId: command.id,
                    time: Date.now() - start,
                });
            });
        } else {
            debug("sfdx:analytics")("no plugin found for analytics");
        }
    } catch (err) {
        // Do nothing?
    }
}

module.exports = run;
