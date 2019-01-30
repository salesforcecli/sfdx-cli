/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// tslint:disable:no-unused-expression

import { Hook, Hooks, IConfig } from '@oclif/config';
import {
    StubbedCallableType,
    stubCallable,
    stubInterface
} from '@salesforce/ts-sinon';
import { JsonMap, Optional } from '@salesforce/ts-types';
import { expect } from 'chai';
import { HTTP, HTTPRequestOptions } from 'http-call';
import * as sinon from 'sinon';
import { Env } from '../util/env';
import hook from './updateReachability';

class SystemError extends Error {
    public constructor(
        public code: string
    ) {
        super();
    }
}

describe('updateReachability preupdate hook', () => {
    let httpClient: StubbedCallableType<typeof HTTP>;
    let sandbox: sinon.SinonSandbox;
    let context: Hook.Context;
    let config: IConfig;
    let options: Hooks['preupdate'] & { config: IConfig };
    let env: Env;
    let error: Optional<Error>;
    let body: Optional<JsonMap>;
    let statusCode: number;
    let warnings: string[];
    let errors: string[];

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        config = stubInterface<IConfig>(sandbox, {
            dataDir: 'test',
            pjson: {
                oclif: {
                    update: {
                        s3: {
                            host: 'https://developer.salesforce.com/media/salesforce-cli'
                        }
                    }
                }
            }
        });

        context = stubInterface<Hook.Context>(sandbox, {
            config,
            warn(...args: any[]) { // tslint:disable-line:no-any
                warnings.push(args.join(' '));
            },
            error(...args: any[]) { // tslint:disable-line:no-any
                errors.push(args.join(' '));
            }
        });

        options = {
            channel: 'test',
            config
        };

        env = new Env({});
        statusCode = 200;
        error = undefined;
        body = {
            version: '6.36.1-102-e4be126f07',
            channel: 'test',
            sha256gz: 'deadbeef'
        };
        httpClient = stubCallable<typeof HTTP>(sandbox, ({
            get: async (url: string, opts: HTTPRequestOptions) => {
                if (error) throw error;
                return { body, statusCode };
            }
        }));
        warnings = [];
        errors = [];
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should not test S3 host reachability when update is disabled', async () => {
        env.setAutoupdateDisabled(true, 'test disabled');
        await hook.call(context, options, env, httpClient);
        expect(warnings).to.deep.equal([]);
        expect(errors).to.deep.equal([]);
        expect(httpClient.get.calledOnce).to.be.false;
    }).timeout(5000);

    it('should not warn about updating from a custom S3 host when not set', async () => {
        await hook.call(context, options, env, httpClient);
        expect(warnings).to.deep.equal([]);
        expect(errors).to.deep.equal([]);
    }).timeout(5000);

    it('should warn about updating from a custom S3 host and ask about SFM', async () => {
        env.setS3HostOverride('http://10.252.156.165:9000/sfdx/media/salesforce-cli');
        await hook.call(context, options, env, httpClient);
        expect(warnings).to.deep.equal(['Updating from SFDX_S3_HOST override. Are you on SFM?']);
        expect(errors).to.deep.equal([]);
    }).timeout(5000);

    it('should fail to update from an invalid channel', async () => {
        statusCode = 403;
        await hook.call(context, options, env, httpClient);
        expect(httpClient.get.calledOnce).to.been.true;
        expect(warnings).to.deep.equal([]);
        expect(errors).to.deep.equal([
            'Channel "test" not found.'
        ]);
    }).timeout(5000);

    it('should test the S3 update site before updating, failing when 3 ping attempts fail with unexpected HTTP status codes', async () => {
        statusCode = 404;
        await hook.call(context, options, env, httpClient);
        expect(httpClient.get.calledThrice).to.been.true;
        expect(warnings).to.deep.equal([
            'Attempting to contact update site...'
        ]);
        expect(errors).to.deep.equal([
            'S3 host is not reachable.'
        ]);
    }).timeout(5000);

    it('should test the S3 update site before updating, failing when 3 ping attempts fail with dns resolution errors', async () => {
        body = undefined;
        error = new SystemError('ENOTFOUND');
        await hook.call(context, options, env, httpClient);
        expect(httpClient.get.calledThrice).to.been.true;
        expect(warnings).to.deep.equal([
            'Attempting to contact update site...'
        ]);
        expect(errors).to.deep.equal([
            'S3 host is not reachable.'
        ]);
    }).timeout(5000);

    it('should test the S3 update site before updating, failing when 3 ping attempts fail with reachability errors', async () => {
        body = undefined;
        error = new SystemError('ENETUNREACH');
        await hook.call(context, options, env, httpClient);
        expect(httpClient.get.calledThrice).to.been.true;
        expect(warnings).to.deep.equal([
            'Attempting to contact update site...'
        ]);
        expect(errors).to.deep.equal([
            'S3 host is not reachable.'
        ]);
    }).timeout(5000);

    it('should test the S3 update site before updating, failing when 3 ping attempts fail with timeout errors', async () => {
        body = undefined;
        error = new SystemError('ETIMEDOUT');
        await hook.call(context, options, env, httpClient);
        expect(httpClient.get.calledThrice).to.been.true;
        expect(warnings).to.deep.equal([
            'Attempting to contact update site...'
        ]);
        expect(errors).to.deep.equal([
            'S3 host is not reachable.'
        ]);
    }).timeout(5000);

    it('should error out with an invalid manifest', async () => {
        body = {};
        await hook.call(context, options, env, httpClient);
        expect(errors).to.deep.equal([
            'Invalid manifest found on channel \'test\'.'
        ]);
    }).timeout(5000);
});
