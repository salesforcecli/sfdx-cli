import CLI from "cli-engine";
import * as path from "path";

const root = path.join(__dirname, "..");
const pjson = require(path.join(root, "package.json")); // tslint:disable-line

export function create(version: string, channel: string) {
    const argv: string[] = process.argv.slice(1);
    const config: any = {
        channel,
        pjson,
        root,
        version,
    };
    if (process.env.SFDX_AUTOUPDATE_DISABLE === "true") {
        config.updateDisabled =
            "A newer version is available, but CLI updates have " +
            "been disabled by setting 'SFDX_AUTOUPDATE_DISABLE=true'";
    }
    return new CLI({ argv, config });
}
