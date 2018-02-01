import { flags, Output } from 'cli-engine-command';
import { ConfigOptions } from 'cli-engine-config';
import CliEngineUpdate from 'cli-engine/lib/commands/update';
import { NamedError } from '../util/NamedError';
import * as request from 'request';
import * as Debug from 'debug';

const debug = Debug('sfdx:update');

export default class Update extends CliEngineUpdate {
    public static topic = 'update';
    public static description = 'update CLI';
    public static args = [{ name: 'channel', optional: true }];
    public static flags = { autoupdate: flags.boolean({ hidden: true }) };

    constructor(
        options: { config?: ConfigOptions, output?: Output } | null,
        private env: typeof process.env = process.env
    ) {
        super(options);
    }

    public async run() {
        if (!this.config.updateDisabled) {
            let s3Host = this.env.SFDX_S3_HOST;
            if (s3Host) {
                // Warn that the updater is targeting something other than the public update site
                let message = 'Updating from SFDX_S3_HOST override.';
                // If targeting the IP of our internal Minio server, remind about requiring SFM
                if (/\b10\.252\.156\.165:9000\b/.test(s3Host)) {
                    message += ' Are you on SFM?';
                }
                this.out.warn(message);
            }
            s3Host = s3Host || (this.config.s3 || {}).host;
            if (!s3Host) {
                throw new NamedError('S3HostNotFoundError', 'No S3 host defined');
            }
            await this.isS3HostReachable(s3Host);
        }

        this.doUpdate();
    }

    public async doUpdate() {
        await super.run();
    }

    private async isS3HostReachable(s3Host: string, attempt = 1) {
        const MAX_ATTEMPTS = 3;
        const RETRY_MILLIS = 1000;

        if (attempt > MAX_ATTEMPTS) {
            throw new NamedError('S3HostReachabilityError', 'SFDX_S3_HOST is not reachable.');
        }

        if (attempt === 1) {
            debug('Testing S3 host reachability... (attempt %s)', attempt);
        } else {
            debug('Re-testing S3 host reachability in %s milliseconds...', RETRY_MILLIS);
            await this.sleep(RETRY_MILLIS);
        }

        if (attempt === 2) {
            this.out.warn('Attempting to contact update site...');
        }
        if (await this.isReachable(s3Host)) {
            if (attempt >= 2) {
                this.out.warn('Connected.');
            }
            debug('S3 host is reachable (attempt %s)', attempt);
            return true;
        }
        return await this.isS3HostReachable(s3Host, attempt + 1);
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
            await this.get(url);
            debug('Reachability test successful');
            return true;
        } catch (err) {
            if (err.code === 'ETIMEDOUT') {
                debug('Reachability test timed out');
                return false;
            }
            debug('Reachability test failed', err);
            throw err;
        }
    }

    private async get(url: string) {
        await new Promise((resolve, reject) => {
            request.get({ url, timeout: 4000 }, (err, res) => {
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

    private async sleep(millis) {
        await new Promise((resolve) => setTimeout(resolve.bind(null), millis));
    }
}
