import { IConfig } from '@oclif/config';
import { stubInterface } from '@salesforce/ts-sinon';
import { Dictionary } from '@salesforce/ts-types';
import { expect } from 'chai';
import * as fs from 'fs-extra';
import * as sinon from 'sinon';
import AnalyticsCommand from './analytics';

describe('analytics', () => {
    let sandbox: sinon.SinonSandbox;

    function analyticsJson() {
        return {
            schema: 1,
            install: '5a8ef179-1129-4f81-877c-662c89f83f1f',
            cli: 'cli-engine',
            commands: [
                {
                    command: 'foo',
                    version: '1.2.3',
                    plugin: 'who',
                    plugin_version: '4.5.6',
                    os: 'darwin',
                    shell: 'fish',
                    language: 'node',
                    valid: true,
                    runtime: 20,
                    status: 0
                }
            ]
        };
    }

    function build(configOptions: Dictionary<string> = {}, options: Dictionary = {}) {
        // TODO: not all of these fields are needed now by oclif's IConfig
        const config = stubInterface<IConfig>(sandbox, {
            version: '1.2.3',
            platform: 'windows',
            cacheDir: 'tmp',
            skipAnalytics: false,
            install: '5a8ef179-1129-4f81-877c-662c89f83f1f',
            name: 'cli-engine',
            shell: 'cmd.exe',
            ...configOptions
        });
        const json = options.json || analyticsJson();
        const command = new AnalyticsCommand(config);

        command.readJSON = () => json;

        return command;
    }

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        // nock.cleanAll();
        delete process.env['HEROKU_API_KEY'];
        delete process.env['CLI_ENGINE_ANALYTICS_URL'];
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('record', () => {
        it('does not record if no plugin', async () => {
            const command = build();
            const stub = sandbox.stub(fs, 'outputJson');
            await command.record(undefined, '', 0, 0);

            expect(stub.called).to.equal(false);
        });

        it('records commands', async () => {
            const json = analyticsJson();
            const expected = analyticsJson();
            const stub = sandbox.stub(fs, 'outputJson');

            expected.commands.push({
                command: 'fuzz:fuzz',
                os: 'windows',
                shell: 'cmd.exe',
                plugin: 'fuzz',
                plugin_version: '9.8.7',
                valid: true,
                version: '1.2.3',
                language: 'node',
                runtime: 13,
                status: 0
            });

            const command = build({}, { json });
            await command.record({
                name: 'fuzz',
                version: '9.8.7'
            }, 'fuzz:fuzz', 13, 0);
            expect(stub.getCall(0).args[1]).to.eql(expected);
        });
    });
});
