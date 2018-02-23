import * as path from 'path';
import * as fs from 'fs-extra';
import * as Debug from 'debug';
import { Command, InputFlags, flags } from 'cli-engine-command';
import { NamedError } from '../../util/NamedError';
import { CLI as Ux } from 'cli-ux';

const debug = Debug('sfdx:update:revert');

export default class Revert extends Command<any> {
    // This is actually used in the bin/run.* scripts, but enforced here
    public static args = [{
        name: 'no-forward',
        required: true
    }];

    public async run() {
        const dataDir = this.config.dataDir;
        if (!dataDir) {
            throw new NamedError('ConfigDataDirNotCountError', 'Config value dataDir not found');
        }

        const clientDir = path.join(dataDir, 'client');
        if (!fs.existsSync(clientDir)) {
            this.out.log('Nothing to do -- already using the base installation of the CLI');
            return;
        }

        if (__dirname.startsWith(clientDir)) {
            this.out.warn('The update:revert command can only be run from a base installation; re-run with --no-forward');
            return;
        }

        const ux = new Ux();
        const response = await ux.prompt('Do you really wish to remove the latest CLI update y/n?');
        if (response.toLowerCase() !== 'y') {
            return;
        }

        fs.removeSync(clientDir);
        this.out.log('Removed latest update from %s', clientDir);
    }
}
