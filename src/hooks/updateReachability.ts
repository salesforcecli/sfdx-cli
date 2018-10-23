/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Hook } from '@oclif/config';
import { get, NamedError, set, sleep } from '@salesforce/kit';
import { ensureString } from '@salesforce/ts-types';
import * as Debug from 'debug';
import * as Request from 'request';
import { default as envars } from '../util/env';

const debug = Debug('sfdx:preupdate');

const MAX_ATTEMPTS = 3;
const RETRY_MILLIS = 1000;

async function isS3HostReachable(s3Host: string, context: Hook.Context, request: typeof Request, attempt = 1): Promise <void> {
    if (attempt > MAX_ATTEMPTS) {
        throw new NamedError('S3HostReachabilityError', 'S3 host is not reachable.');
    }

    if (attempt === 1) {
        debug('testing S3 host reachability... (attempt %s)', attempt);
    } else {
        debug('re-testing S3 host reachability in %s milliseconds... (attempt %s)', RETRY_MILLIS, attempt);
        await sleep(RETRY_MILLIS);
    }

    if (attempt === 2) {
        context.warn('Attempting to contact update site...');
    }
    if (await isReachable(s3Host, request)) {
        if (attempt >= 2) {
            context.warn('Connected!');
        }
        debug('S3 host is reachable (attempt %s)', attempt);
        return;
    }

    await isS3HostReachable(s3Host, context, request, attempt + 1);
}

async function isReachable(s3Host: string, request: typeof Request): Promise<boolean> {
    let url = s3Host;
    if (!/^https?:\/\//.test(url)) {
        url = 'https://' + url;
    }
    if (!url.endsWith('/')) {
        url += '/';
    }
    url += 'manifest.json';
    debug('trying to reach S3 host at %s...', url);
    try {
        await ping(url, request);
        debug('ping succeeded');
        return true;
    } catch (err) {
        debug('ping failed', err);
        return false;
    }
}

async function ping(url: string, request: typeof Request): Promise<void> {
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

const hook: Hook.Preupdate = async function(options, env = envars, request = Request) {
    debug(`preupdate check with channel ${options.channel}`);
    try {
        let s3Host = env.getS3HostOverride();
        if (s3Host) {
            debug(`s3 host override: ${s3Host}`);
            // Override config value if set via envar
            set(this.config, 'pjson.oclif.update.s3.host', s3Host);
        }

        if (!env.isAutoupdateDisabled()) {
            if (s3Host) {
                // Warn that the updater is targeting something other than the public update site
                this.warn('Updating from SFDX_S3_HOST override. Are you on SFM?');
            }
            s3Host = ensureString(s3Host || get(this.config, 'pjson.oclif.update.s3.host'));
            await isS3HostReachable(s3Host, this, request);
        }
    } catch (err) {
        this.error(err.message);
    }
};

export default hook;
