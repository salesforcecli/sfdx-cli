/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { IConfig } from '@oclif/config';
import {
    StubbedCallableType,
    StubbedType,
    stubCallable,
    stubInterface,
    stubObject
} from '@salesforce/ts-sinon';
import { assert, expect } from 'chai';
import * as Request from 'request';
import * as sinon from 'sinon';
import { Env } from '../util/env';
import UpdateCommand from './update';

/* tslint:disable:no-unused-expression */

class SystemError extends Error {
    public constructor(
        public code: string
    ) {
        super();
    }
}

describe('builtin update command', () => {
    let sandbox: sinon.SinonSandbox;
    let config: IConfig;
    let env: Env;
    let pingErr: Error;
    let pingRes: Request.RequestResponse;
    let request: StubbedCallableType<typeof Request>;
    let update: StubbedType<UpdateCommand>;
    let message: string;

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        config = stubInterface<IConfig>(sandbox, {
            dataDir: 'test',
            pjson: {
                oclif: {
                    update: {
                        s3: {
                            host: 'developer.salesforce.com/media/salesforce-cli'
                        }
                    }
                }
            }
        });

        env = new Env({});

        request = stubCallable<typeof Request>(sandbox, ({
            get(options: object, cb: (err?: Error, res?: object) => void) { // tslint:disable-line:no-reserved-keywords
                return cb(pingErr, pingRes);
            }
        }));

        update = stubObject(sandbox, new UpdateCommand(['update'], config, env, request), {
            request,
            async doUpdate() {
                return Promise.resolve();
            },
            warn(...args: any[]) { // tslint:disable-line:no-any
                message = args.join(' ');
            }
        });

        message = '';
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should not test S3 host reachability when update is disabled', async () => {
        env.setAutoupdateDisabled(true, 'test disabled');
        await update.run();
        expect(message).to.equal('');
        expect(request.get.calledOnce).to.be.false;
        expect(update.doUpdate.calledOnce).to.be.true;
    }).timeout(5000);

    it('should not warn about updating from a custom S3 host when not set', async () => {
        pingRes = { statusCode: 200 } as Request.RequestResponse;
        await update.run();
        expect(message).to.equal('');
        expect(update.doUpdate.calledOnce).to.be.true;
    }).timeout(5000);

    it('should warn about updating from a custom S3 host and ask about SFM', async () => {
        env.setS3HostOverride('http://10.252.156.165:9000/sfdx/media/salesforce-cli');
        pingRes = { statusCode: 200 } as Request.RequestResponse;
        await update.run();
        expect(message).to.equal('Updating from SFDX_S3_HOST override. Are you on SFM?');
        expect(update.doUpdate.calledOnce).to.be.true;
    }).timeout(5000);

    it('should test the S3 update site before updating, failing when 3 ping attempts fail with unexpected HTTP status codes', async () => {
        pingRes = { statusCode: 404 } as Request.RequestResponse;
        try {
            await update.run();
            assert.fail('Error expected');
        } catch (err) {
            expect(err.name).to.equal('S3HostReachabilityError');
        }
        expect(request.get.calledThrice).to.been.true;
        expect(update.doUpdate.called).to.be.false;
    }).timeout(5000);

    it('should test the S3 update site before updating, failing when 3 ping attempts fail with dns resolution errors', async () => {
        pingErr = new SystemError('ENOTFOUND');
        try {
            await update.run();
            assert.fail('Error expected');
        } catch (err) {
            expect(err.name).to.equal('S3HostReachabilityError');
        }
        expect(request.get.calledThrice).to.been.true;
        expect(update.doUpdate.called).to.be.false;
    }).timeout(5000);

    it('should test the S3 update site before updating, failing when 3 ping attempts fail with reachability errors', async () => {
        pingErr = new SystemError('ENETUNREACH');
        try {
            await update.run();
            assert.fail('Error expected');
        } catch (err) {
            expect(err.name).to.equal('S3HostReachabilityError');
        }
        expect(request.get.calledThrice).to.been.true;
        expect(update.doUpdate.called).to.be.false;
    }).timeout(5000);

    it('should test the S3 update site before updating, failing when 3 ping attempts fail with timeout errors', async () => {
        pingErr = new SystemError('ETIMEDOUT');
        try {
            await update.run();
            assert.fail('Error expected');
        } catch (err) {
            expect(err.name).to.equal('S3HostReachabilityError');
        }
        expect(request.get.calledThrice).to.been.true;
        expect(update.doUpdate.called).to.be.false;
    }).timeout(30000);
});
