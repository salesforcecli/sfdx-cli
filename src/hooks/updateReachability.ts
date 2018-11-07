/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Hook } from '@oclif/config';
import { NamedError, parseJsonMap, set, sleep } from '@salesforce/kit';
import { JsonMap, Optional } from '@salesforce/ts-types';
import * as Debug from 'debug';
import * as Request from 'request';
import { default as envars } from '../util/env';

const debug = Debug('sfdx:preupdate');

const MAX_ATTEMPTS = 3;
const RETRY_MILLIS = 1000;

async function canUpdate(context: Hook.Context, channel: string, manifestUrl: string, request: typeof Request, attempt = 1): Promise<void> {
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

    const manifest = await fetchManifest(manifestUrl, request);
    if (manifest) {
        if (attempt >= 2) {
            context.warn('Connected!');
        }
        debug('S3 host is reachable (attempt %s)', attempt);
        validateManifest(context, channel, manifest);
        return;
    }

    await canUpdate(context, channel, manifestUrl, request, attempt + 1);
}

async function fetchManifest(manifestUrl: string, request: typeof Request): Promise<Optional<JsonMap>> {
    debug('trying to download update manifest at %s...', manifestUrl);
    try {
        const json = await requestManifest(manifestUrl, request);
        debug('fetch succeeded', json);
        return json;
    } catch (err) {
        debug('fetch failed', err);
    }
}

async function requestManifest(url: string, request: typeof Request): Promise<JsonMap> {
    return new Promise<JsonMap>((resolve, reject) => {
        request.get({ url, timeout: 4000 }, (err, res, body) => {
            if (err) return reject(err);
            if (res.statusCode !== 200) {
                return reject(new NamedError(
                    'HttpGetUnexpectedStatusError',
                    `Unexpected GET response status ${res.statusCode}`)
                );
            }
            try {
                return resolve(parseJsonMap(body));
            } catch (parseErr) {
                return reject(parseErr);
            }
        });
    });
}

function validateManifest(context: Hook.Context, channel: string, manifest: JsonMap): void {
    if (!manifest.version || !manifest.channel || !manifest.sha256gz) {
        return context.error(`Invalid manifest found on channel '${channel}'.`);
    }
    debug('update available %s', manifest);
}

const hook: Hook.Preupdate = async function(options, env = envars, request = Request) {
    debug(`preupdate check with channel ${options.channel}`);
    try {
        const s3Host = env.getS3HostOverride();
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
            const s3Url = this.config.s3Url(this.config.s3Key('manifest', {
                channel: options.channel,
                platform: this.config.platform,
                arch: this.config.arch
            }));
            await canUpdate(this, options.channel, s3Url, request);
        }
    } catch (err) {
        return this.error(err.message);
    }
};

export default hook;
