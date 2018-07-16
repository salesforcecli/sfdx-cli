import { StubbedCallableType, StubbedType, stubCallable, stubObject } from '@salesforce/ts-sinon';
import { assert, expect } from 'chai';
import { ConfigOptions } from 'cli-engine-config';
import * as Request from 'request';
import * as sinon from 'sinon';
import Update from './update';

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
    let config: ConfigOptions;
    let env: NodeJS.ProcessEnv;
    let pingErr: Error;
    let pingRes: Request.RequestResponse;
    let request: StubbedCallableType<typeof Request>;
    let update: StubbedType<Update>;
    let message: string;

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        config = { s3: { host: 'developer.salesforce.com/media/salesforce-cli' } };

        env = {};

        request = stubCallable<typeof Request>(sandbox, ({
            get(options: object, cb: (err?: Error, res?: object) => void) { // tslint:disable-line:no-reserved-keywords
                return cb(pingErr, pingRes);
            }
        }));

        update = stubObject(sandbox, new Update({ config }, env, request), {
            request,
            get config() {
                return Object.assign({}, super.config, config);
            },
            async doUpdate() {
                return Promise.resolve();
            },
            out: {
                warn(...args: any[]) { // tslint:disable-line:no-any
                    message = args.join(' ');
                }
            }
        });

        message = '';
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should not test S3 host reachability when update is disabled', async () => {
        config.updateDisabled = 'test disabled';
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
        env.SFDX_S3_HOST = 'http://10.252.156.165:9000/sfdx/media/salesforce-cli';
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
