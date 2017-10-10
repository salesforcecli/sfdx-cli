
import { Command, InputFlags, flags } from 'cli-engine-command';
import Plugins from 'cli-engine';
import { api as packAndSignApi } from '../codeSigning/packAndSign';

export default class PackAndSign extends Command<any> {
    public static topic = 'packAndSign';
    public  static flags: InputFlags = {
        signatureUrl: flags.string({char: 's', required: true}),
        publicKeyUrl: flags.string({char: 'p', required: true}),
        privateKeyPath: flags.string({char: 'k', required: true})
    };
    public static description = 'this is an example command for cli-engine';

    public plugins: Plugins;

    public async run(a: any, b: any, c: any) {
        await packAndSignApi.doPackAndSign(this.flags);
    }
}
