import { Output } from 'cli-engine-command';
import { ConfigOptions } from 'cli-engine-config';
import CliEngineUpdate from 'cli-engine/lib/commands/update';
import * as Debug from 'debug';
import * as Request from 'request';
import { sleep } from '../util';
import { NamedError } from '../util/NamedError';

const debug = Debug('sfdx:update');

export default class Update extends CliEngineUpdate {
    constructor(
        options: { config?: ConfigOptions, output?: Output } | null,
        private env: typeof process.env = process.env,
        private request: typeof Request = Request
    ) {
        super(options);
    }

    public async run(): Promise<void> {
        if (!this.config.updateDisabled) {
            let s3Host = this.env.SFDX_S3_HOST;
            if (s3Host) {
                // Warn that the updater is targeting something other than the public update site
                const message = 'Updating from SFDX_S3_HOST override. Are you on SFM?';
                this.out.warn(message);
            }
            s3Host = s3Host || (this.config.s3 || {}).host;
            if (!s3Host) {
                throw new NamedError('S3HostNotFoundError', 'No S3 host defined');
            }
            await this.isS3HostReachable(s3Host);
        }

        await this.doUpdate();
    }

    public async doUpdate(): Promise<void> {
        debug('Invoking cli-engine update');
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
            this.out.warn('Attempting to contact update site...');
        }
        if (await this.isReachable(s3Host)) {
            if (attempt >= 2) {
                this.out.warn('Connected.');
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
