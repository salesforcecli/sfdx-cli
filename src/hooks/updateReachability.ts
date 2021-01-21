/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Hook, IConfig } from '@oclif/config';
import { sleep } from '@salesforce/kit';
import { JsonMap, Optional } from '@salesforce/ts-types';
import * as Debug from 'debug';
import { HTTP } from 'http-call';
import { SfdxError } from '@salesforce/core';
import { default as envars, Env } from '../util/env';

const debug = Debug('sfdx:preupdate:reachability');

const MAX_ATTEMPTS = 3;
const RETRY_MILLIS = 1000;

async function requestManifest(url: string, httpClient: typeof HTTP): Promise<JsonMap> {
  const { body, statusCode } = await httpClient.get<JsonMap>(url, { timeout: 4000 });
  if (statusCode === 403) {
    // S3 returns 403 rather than 404 when a manifest is not found
    throw new SfdxError(`Manifest not found at ${url}`, 'ManifestNotFoundError');
  }
  if (statusCode !== 200) {
    throw new SfdxError(`Unexpected GET response status ${statusCode}`, 'HttpGetUnexpectedStatusError');
  }
  return body;
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

function validateManifest(context: Hook.Context, channel: string, manifest: JsonMap): void {
  if (!manifest.version || !manifest.channel || !manifest.sha256gz) {
    return context.error(`Invalid manifest found on channel '${channel}'.`);
  }
  debug('manifest available %s', JSON.stringify(manifest));
}

async function canUpdate(
  context: Hook.Context,
  channel: string,
  manifestUrl: string,
  httpClient: typeof HTTP,
  attempt = 1
): Promise<void> {
  if (attempt > MAX_ATTEMPTS) {
    throw new SfdxError('S3 host is not reachable.', 'S3HostReachabilityError');
  }

  // Allow test to overwrite RETRY_MILLIS
  const retryMS: number = ((context as unknown) as { retryMS: number }).retryMS || RETRY_MILLIS;

  if (attempt === 1) {
    debug('testing S3 host reachability... (attempt %s)', attempt);
  } else {
    debug('re-testing S3 host reachability in %s milliseconds... (attempt %s)', retryMS, attempt);
    await sleep(retryMS);
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

export type UpdateReachabilityHookContext = Hook.Context & {
  env: Env;
  http: typeof HTTP;
};

// Extend Hook.Preupdate to add http and env utility
export type UpdateReachabilityHook = (
  this: UpdateReachabilityHookContext,
  options: {
    channel: string;
  } & {
    config: IConfig;
  }
) => Promise<void>;

const hook: UpdateReachabilityHook = async function (options) {
  debug(`preupdate check with channel ${options.channel}`);

  // Allow test to overwrite env and http
  const env = this.env || envars;
  const http = this.http || HTTP;

  try {
    const s3Host = env.getS3HostOverride();
    if (!env.isAutoupdateDisabled()) {
      if (s3Host) {
        // Warn that the updater is targeting something other than the public update site
        this.warn('Updating from SFDX_S3_HOST override.');
      }
      const s3Url = this.config.s3Url(
        this.config.s3Key('manifest', {
          channel: options.channel,
          platform: this.config.platform,
          arch: this.config.arch,
        })
      );
      await canUpdate(this, options.channel, s3Url, http);
    }
  } catch (err) {
    return this.error(err.message);
  }
};

export default hook;
