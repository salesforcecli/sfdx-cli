import { Command, InputFlags } from 'cli-engine-command';
import { CLI as Ux } from 'cli-ux';
import * as fs from 'fs-extra';
import * as path from 'path';
import { NamedError } from '../../util/NamedError';

export default class Revert extends Command<InputFlags> {
    public static description = 'restores the CLI to the originally installed version, removing updates';

    public async run(): Promise<void> {
        const ux = new Ux();

        const dataDir = this.config.dataDir;
        if (!dataDir) {
            throw new NamedError('ConfigDataDirNotCountError', 'Config value dataDir not found');
        }

        const clientDir = path.join(dataDir, 'client');
        if (!fs.existsSync(clientDir)) {
            ux.log('Nothing to do -- already using the base installation of the CLI');
            return;
        }

        if (__dirname.startsWith(clientDir)) {
            ux.error('The update:revert command was not found in the base installation -- please re-install to use this command');
            return;
        }

        const response = await ux.prompt('Do you really wish to revert to the initially installed version of the CLI y/n?');
        if (response.toLowerCase() !== 'y') {
            return;
        }

        fs.removeSync(clientDir);
        ux.log('Removed updates from %s -- CLI restored to original installation', clientDir);
    }
}
