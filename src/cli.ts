import CLI from 'cli-engine';
import * as path from 'path';
import env from './util/env';

const root = path.join(__dirname, '..');
const pjson = require(path.join(root, 'package.json')); // tslint:disable-line

export function create(version: string, channel: string) {
    const argv: string[] = process.argv.slice(1);
    const config: any = {
        channel,
        pjson,
        root,
        version
    };
    if (env.getBoolean('SFDX_BINARY')) {
        // TODO
    }
    if (env.getBoolean('SFDX_AUTOUPDATE_DISABLE')) {
        config.updateDisabled = process.env.SFDX_AUTOUPDATE_DISABLE_MESSAGE ||
            'Manual and automatic CLI updates have been disabled by setting "SFDX_AUTOUPDATE_DISABLE=true". ' +
            'To check for a new version, unset that environment variable.';
    }
    return new CLI({ argv, config });
}
