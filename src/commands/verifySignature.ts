import { join } from 'path';
import { homedir, platform } from 'os';
import { Command, InputFlags, flags } from 'cli-engine-command';
import { CLI } from './cliUx';
import Plugins from 'cli-engine';
import {
    InstallationVerification,
    VerificationConfig
} from '../codeSigning/installationVerification';
import { NamedError } from '../util/NamedError';
import {NpmName} from '../util/NpmName';

interface JsonResponse {
    message: string;
    verified: boolean;
}

// sfdx verifySignature --npm @salesforce/jj@0.0.1 --registry http://tnoonan-wsm2.internal.salesforce.com:4874/
export default class VerifySignature extends Command<any> {
    public static topic = 'verifySignature';
    public static description = 'From an npm validate the the associate digital signature if it exits.';
    public static flags: InputFlags = {
        npm: flags.string({
            char: 'n',
            required: true,
            description: 'Specify the npm name. This can include a tag or version scope'
        }),
        registry: flags.string({
            char: 'r',
            required: false,
            description: 'the behavior is the same as npm.'
        }),
        json: flags.boolean({
            char: 'j',
            description: 'True for json output.'
        })
    };

    public configDir: string;
    public cacheDir: string;

    public plugins: Plugins;
    private ux: CLI;

    public async run() {

        this.configDir = this.config.configDir as string;
        this.cacheDir = this.config.configDir as string;

        this.ux = new CLI(this.flags!.json);
        this.ux.log('Checking for digital signature.');

        const npmName: NpmName = NpmName.parse(this.flags!.npm);
        const vConfig = new VerificationConfig();
        vConfig.verifier = this.getVerifier(npmName);

        vConfig.log = this.ux.log.bind(this.ux);

        if (this.flags!.registry) {
            process.env.SFDX_NPM_REGISTRY = this.flags!.registry;
        }

        try {
            const meta = await vConfig.verifier.verify();
            if (!meta.verified) {
                throw new NamedError('FailedDigitalSignatureVerification',
                    'A digital signature is specified for this plugin but it didn\'t verify against the certificate.');
            }
            const message: string = `Successfully validated digital signature for ${npmName.name}.`;
            this.ux.json({message, verified: true} as JsonResponse);
            vConfig.log(message);
        } catch (err) {
            const response: JsonResponse = {
                verified: false,
                message: err.message
            };

            if (err.name === 'NotSigned') {
                let message: string = err.message;
                if (await vConfig.verifier.isWhiteListed()) {
                    message = `The plugin [${npmName.name}] is not digitally signed but it is white-listed.`;
                    vConfig.log(message);
                    response.message = message;
                } else {
                    message = 'The plugin is not digitally signed.';
                    vConfig.log(message);
                    response.message = message;
                }
                this.ux.json(response);
                return;
            }
            this.ux.json(response);
            throw err;
        }
    }

    private getVerifier(npmName: NpmName): InstallationVerification {
        return new InstallationVerification()
            .setPluginNpmName(npmName)
            .setCliEngineConfig(this);
    }
}
