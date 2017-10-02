import { assert, expect } from 'chai';
import { Command } from 'cli-engine-command';
import { Config } from 'cli-engine-config';
import * as fs from 'fs-extra';
import * as sinon from 'sinon';
import AnalyticsCommand from './analytics';

class TestCommand extends Command<any> {
    public static topic = 'fuzz';
    public static command = 'fizz';
}

class TestCommandWithPlugin extends Command<any> {
    public static topic = 'fuzz';
    public static command = 'fizz';
    public static plugin = { name: 'fuzz', version: '9.8.7' };
}

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
                runtime: 20
            }
        ]
    };
}

function build(configOptions = {}, options: any = {}) {
    const config: Config = {
        version: '1.2.3',
        platform: 'windows',
        cacheDir: 'tmp',
        skipAnalytics: false,
        install: '5a8ef179-1129-4f81-877c-662c89f83f1f',
        name: 'cli-engine',
        shell: 'cmd.exe',
        ...configOptions
    };
    const json = options.json || analyticsJson();
    const command = new AnalyticsCommand(config);

    command.readJSON = () => json;

    return command;
}

describe('analytics', () => {
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
        sandbox = sinon.sandbox.create();
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
            await command.record(undefined, '', 0);

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
                runtime: 13
            });

            const command = build({}, { json });
            await command.record({
                name: 'fuzz',
                version: '9.8.7'
            }, 'fuzz:fuzz', 13);
            expect(stub.getCall(0).args[1]).to.eql(expected);
        });
    });
});
