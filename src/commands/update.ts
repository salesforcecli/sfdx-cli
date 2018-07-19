import { IConfig } from '@oclif/config';
import { default as OclifUpdateCommand } from '@oclif/plugin-update/lib/commands/update';
import { NamedError } from '@salesforce/ts-json';
import * as Debug from 'debug';
import * as Request from 'request';
import { sleep } from '../util';
import { default as envars } from '../util/env';

const debug = Debug('sfdx:update');

export default class UpdateCommand extends OclifUpdateCommand {
    public constructor(
        argv: string[],
        config: IConfig,
        private env = envars,
        private request = Request
    ) {
        super(argv, config);
    }

    public async run(): Promise<void> {
        let s3Host = this.env.getS3HostOverride();
        if (s3Host) {
            // Override config value if set via envar
            this.config.pjson.oclif.update.s3.host = s3Host;
        }

        if (!this.env.isAutoupdateDisabled()) {
            if (s3Host) {
                // Warn that the updater is targeting something other than the public update site
                this.warn('Updating from SFDX_S3_HOST override. Are you on SFM?');
            }
            s3Host = s3Host || (this.config.pjson.oclif.update.s3 || {}).host;
            if (!s3Host) {
                throw new NamedError('S3HostNotFoundError', 'No S3 host defined');
            }
            await this.isS3HostReachable(s3Host);
        }

        await this.doUpdate();
    }

    public async doUpdate(): Promise<void> {
        debug('Invoking oclif update');
        await super.run();
    }

    private async isS3HostReachable(s3Host: string, attempt = 1): Promise<void> {
        const MAX_ATTEMPTS = 3;
        const RETRY_MILLIS = 1000;

        if (attempt > MAX_ATTEMPTS) {
            throw new NamedError('S3HostReachabilityError', 'S3 host is not reachable.');
        }

        if (attempt === 1) {
            debug('Testing S3 host reachability... (attempt %s)', attempt);
        } else {
            debug('Re-testing S3 host reachability in %s milliseconds...', RETRY_MILLIS);
            await sleep(RETRY_MILLIS);
        }

        if (attempt === 2) {
            this.warn('Attempting to contact update site...');
        }
        if (await this.isReachable(s3Host)) {
            if (attempt >= 2) {
                this.warn('Connected.');
            }
            debug('S3 host is reachable (attempt %s)', attempt);
            return;
        }
        await this.isS3HostReachable(s3Host, attempt + 1);
    }

    private async isReachable(s3Host: string): Promise<boolean> {
        let url = s3Host;
        if (!/^https?:\/\//.test(url)) {
            url = 'https://' + url;
        }
        if (!url.endsWith('/')) {
            url += '/';
        }
        url += 'manifest.json';
        debug('Trying to reach S3 host at %s...', url);
        try {
            await this.ping(url);
            debug('Ping succeeded');
            return true;
        } catch (err) {
            debug('Ping failed', err);
            return false;
        }
    }

    private async ping(url: string): Promise<void> {
        await new Promise((resolve, reject) => {
            this.request.get({ url, timeout: 4000 }, (err, res) => {
                if (err) {
                    return reject(err);
                }
                if (res.statusCode !== 200) {
                    return reject(new NamedError(
                        'HttpGetUnexpectedStatusError',
                        `Unexpected GET response status ${res.statusCode}`)
                    );
                }
                return resolve();
            });
        });
    }
}
