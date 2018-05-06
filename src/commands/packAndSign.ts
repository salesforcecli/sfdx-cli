
import { Command, InputFlags, flags } from 'cli-engine-command';
import Plugins from 'cli-engine';
import { api as packAndSignApi } from '../codeSigning/packAndSign';

/**
 * Help message for the command.
 * Help doesn't currently work for builtin commands this is here in case it ever does.
 */
// Build function that will perform four things:
// 1) update the npm cert and signature home url in package.json
// 2) pack the npm into a tar gz file
// 3) sign the tar gz file using the private key associated with the cert.
// 4) test verify the signature

// Required Parameters:
// --signatureUrl - the url where the signature will be hosted minus the name of the signature file.
// --publicKeyUrl - the url where the public key/certificate will be hosted.
// --privateKeyPath - the local file path for the private key.

// Returns:
// A tar.gz and signature file. The signature file will match the name of the tar gz except the extension will be ".sig".
// This file must be hosted at the location specified by --signature.

// Usage:
// sfdx packAndSign --signature http://foo.salesforce.internal.com/file/location --publicKeyUrl http://foo.salesforce.internal.com/file/location/sfdx.cert --privateKeyPath $HOME/sfdx.key

export default class PackAndSign extends Command<any> {
    public static topic = 'packAndSign';
    public static description = 'pack an npm package and produce a tgz file along with a corresponding digital signature';
    public static flags: InputFlags = {
        signatureUrl: flags.string({
            char: 's',
            required: true,
            description: 'the url location where the signature will be hosted minus the name of the actual signature file.'
        }),
        publicKeyUrl: flags.string({
            char: 'p',
            required: true,
            description: 'the url where the public key/certificate will be hosted.'
        }),
        privateKeyPath: flags.string({
            char: 'k',
            required: true,
            description: 'the local file path for the private key.'
        }),
        json: flags.boolean({
            char: 'j',
            description: 'True for json output.'
        })
    };
    public plugins: Plugins;

    public async run() {
        await packAndSignApi.doPackAndSign(this.flags);
    }
}
