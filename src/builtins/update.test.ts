import { NamedError } from './../util/NamedError';
import { assert, expect } from 'chai';
import { sandbox as Sandbox, SinonSandbox } from 'sinon';
import { ConfigOptions } from 'cli-engine-config';
import * as Request from 'request';
import Update from './update';

/* tslint:disable:no-unused-expression */

class SystemError extends Error {
    public constructor(
        public code: string
    ) {
        super();
    }
}

const sleep = async (millis) => {
    await new Promise((resolve) => setTimeout(resolve, millis));
};

describe('builtin update command', () => {
    let sandbox: SinonSandbox;
    let config: ConfigOptions;
    let env: typeof process.env;
    let pingErr: Error;
    let pingRes: Request.RequestResponse;
    let request: any;
    let update: Update;
    let message: string;

    beforeEach(() => {
        sandbox = Sandbox.create();

        config = { s3: { host: 'developer.salesforce.com/media/salesforce-cli' } };

        env = {};

        request = { get: () => { } };
        sandbox.stub(request, 'get').callsFake(async (options, cb) => cb(pingErr, pingRes));

        update = new Update({ config }, env, request);
        sandbox.stub(update.out, 'warn').callsFake((...args: any[]) => {
            message = args.join(' ');
        });
        sandbox.stub(update, 'doUpdate').callsFake(() => { });

        message = '';
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should not test S3 host reachability when update is disabled', async () => {
        config.updateDisabled = 'test disabled';
        update = new Update({ config }, env, request);
        sandbox.stub(update, 'doUpdate').callsFake(() => { });
        await update.run();
        expect(message).to.equal('');
        expect((request.get as any).calledOnce).to.be.false;
        expect((update.doUpdate as any).calledOnce).to.be.true;
    });

    it('should not warn about updating from a custom S3 host when not set', async () => {
        pingRes = { statusCode: 200 } as Request.RequestResponse;
        await update.run();
        expect(message).to.equal('');
        expect((update.doUpdate as any).calledOnce).to.be.true;
    });

    it('should warn about updating from a custom S3 host and ask about SFM', async () => {
        env.SFDX_S3_HOST = 'http://10.252.156.165:9000/sfdx/media/salesforce-cli';
        pingRes = { statusCode: 200 } as Request.RequestResponse;
        await update.run();
        expect(message).to.equal('Updating from SFDX_S3_HOST override. Are you on SFM?');
        expect((update.doUpdate as any).calledOnce).to.be.true;
    });

    it('should test the S3 update site before updating, failing when 3 ping attempts fail with unexpected HTTP status codes', async () => {
        pingRes = { statusCode: 404 } as Request.RequestResponse;
        try {
            await update.run();
            assert.fail('Error expected');
        } catch (err) {
            expect(err.name).to.equal('S3HostReachabilityError');
        }
        expect((request.get as any).calledThrice).to.been.true;
        expect((update.doUpdate as any).called).to.be.false;
    }).timeout(5000);

    it('should test the S3 update site before updating, failing when 3 ping attempts fail with dns resolution errors', async () => {
        pingErr = new SystemError('ENOTFOUND');
        try {
            await update.run();
            assert.fail('Error expected');
        } catch (err) {
            expect(err.name).to.equal('S3HostReachabilityError');
        }
        expect((request.get as any).calledThrice).to.been.true;
        expect((update.doUpdate as any).called).to.be.false;
    }).timeout(5000);

    it('should test the S3 update site before updating, failing when 3 ping attempts fail with reachability errors', async () => {
        pingErr = new SystemError('ENETUNREACH');
        try {
            await update.run();
            assert.fail('Error expected');
        } catch (err) {
            expect(err.name).to.equal('S3HostReachabilityError');
        }
        expect((request.get as any).calledThrice).to.been.true;
        expect((update.doUpdate as any).called).to.be.false;
    }).timeout(5000);

    it('should test the S3 update site before updating, failing when 3 ping attempts fail with timeout errors', async () => {
        pingErr = new SystemError('ETIMEDOUT');
        try {
            await update.run();
            assert.fail('Error expected');
        } catch (err) {
            expect(err.name).to.equal('S3HostReachabilityError');
        }
        expect((request.get as any).calledThrice).to.been.true;
        expect((update.doUpdate as any).called).to.be.false;
    }).timeout(30000);
});
