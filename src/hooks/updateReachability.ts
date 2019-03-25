/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Hook } from '@oclif/config';
import { NamedError, sleep } from '@salesforce/kit';
import { JsonMap, Optional } from '@salesforce/ts-types';
import * as Debug from 'debug';
import { HTTP } from 'http-call';
import { default as envars } from '../util/env';

const debug = Debug('sfdx:preupdate:reachability');

const MAX_ATTEMPTS = 3;
const RETRY_MILLIS = 1000;

async function canUpdate(context: Hook.Context, channel: string, manifestUrl: string, httpClient: typeof HTTP, attempt = 1): Promise<void> {
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

    let manifest: Optional<JsonMap>;

    try {
        manifest = await fetchManifest(manifestUrl, httpClient);
    } catch (err) {
        debug('reachability check failed', err);
        context.error(`Channel "${channel}" not found.`);
        return;
    }

    if (manifest) {
        debug('S3 host is reachable (attempt %s)', attempt);
        validateManifest(context, channel, manifest);
        return;
    }

    await canUpdate(context, channel, manifestUrl, httpClient, attempt + 1);
}

async function fetchManifest(manifestUrl: string, httpClient: typeof HTTP): Promise<Optional<JsonMap>> {
    debug('trying to download update manifest at %s...', manifestUrl);
    try {
        const json = await requestManifest(manifestUrl, httpClient);
        debug('fetch succeeded', json);
        return json;
    } catch (err) {
        if (err.name === 'ManifestNotFoundError') {
            throw err;
        }
        debug('fetch failed', err);
    }
}

async function requestManifest(url: string, httpClient: typeof HTTP): Promise<JsonMap> {
    const { body, statusCode } = await httpClient.get<JsonMap>(url, { timeout: 4000 });
    if (statusCode === 403) {
        // S3 returns 403 rather than 404 when a manifest is not found
        throw new NamedError(
            'ManifestNotFoundError',
            `Manifest not found at ${url}`
        );
    }
    if (statusCode !== 200) {
        throw new NamedError(
            'HttpGetUnexpectedStatusError',
            `Unexpected GET response status ${statusCode}`
        );
    }
    return body;
}

function validateManifest(context: Hook.Context, channel: string, manifest: JsonMap): void {
    if (!manifest.version || !manifest.channel || !manifest.sha256gz) {
        return context.error(`Invalid manifest found on channel '${channel}'.`);
    }
    debug('manifest available %s', JSON.stringify(manifest));
}

const hook: Hook.Preupdate = async function(options, env = envars, http = HTTP) {
    debug(`preupdate check with channel ${options.channel}`);
    try {
        const s3Host = env.getS3HostOverride();
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
            await canUpdate(this, options.channel, s3Url, http );
        }
    } catch (err) {
        return this.error(err.message);
    }
};

export default hook;
