import { assert, expect } from 'chai';
import { sandbox as Sandbox, SinonSandbox } from 'sinon';
import { ConfigOptions } from 'cli-engine-config';
import Update from './update';

/* tslint:disable:no-unused-expression */

describe('builtin update command', () => {
    let sandbox: SinonSandbox;
    let env: typeof process.env;
    let message: string;
    let config: ConfigOptions;
    let update: Update;

    beforeEach(() => {
        sandbox = Sandbox.create();
        env = {};
        message = '';
        config = {
            s3: { host: 'developer.salesforce.com/media/salesforce-cli' }
        };
        update = new Update({ config }, env);
        sandbox.stub(update.out, 'warn').callsFake((...args: any[]) => {
            message = args.join(' ');
        });
        sandbox.stub(update, 'doUpdate').callsFake(() => { });
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should not test S3 host reachability when update is disabled', () => {
        config.updateDisabled = 'test disabled';
        update.run();
        expect(message).to.equal('');
        expect((update.doUpdate as any).calledOnce);
    });

    it('should not warn about updating from a custom S3 host when not set', () => {
        update.run();
        expect(message).to.equal('');
        expect((update.doUpdate as any).calledOnce);
    });

    it('should warn about updating from a custom S3 host', () => {
        env.SFDX_S3_HOST = 'test';
        update.run();
        expect(message).to.equal('Updating from SFDX_S3_HOST override.');
        expect((update.doUpdate as any).calledOnce);
    });

    it('should warn about updating from a custom S3 host and ask about SFM if internal', () => {
        env.SFDX_S3_HOST = 'http://10.252.156.165:9000/sfdx/media/salesforce-cli';
        update.run();
        expect(message).to.equal('Updating from SFDX_S3_HOST override. Are you on SFM?');
        expect((update.doUpdate as any).calledOnce);
    });
});
