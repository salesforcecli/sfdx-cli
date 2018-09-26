import { IPlugin } from '@oclif/config';
import { fromStub, Stub, StubbedType, stubInterface, stubObject } from '@salesforce/ts-sinon';
import { AnyJson, Dictionary } from '@salesforce/ts-types';
import { expect } from 'chai';
import { cli } from 'cli-ux';
import * as fs from 'fs-extra';
import * as sinon from 'sinon';
import PluginMigrator from './PluginMigrator';

const userPluginsDir = '/User/foo/.local/share/sfdx/plugins';
const userPluginsPjsonV5Path = `${userPluginsDir}/plugins.json`;
const userPluginsPjsonV6Path = `${userPluginsDir}/package.json`;

describe('plugin migrator', () => {
    let sandbox: sinon.SinonSandbox;
    let corePlugins: IPlugin[];
    let ux: StubbedType<typeof cli>;
    let existsSync: Stub<typeof fs.existsSync>;
    let readJsonSync: Stub<typeof fs.readJsonSync>;
    let removeSync: Stub<typeof fs.removeSync>;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        corePlugins = [stubInterface<IPlugin>(sandbox, {
            name: 'core-plugin',
            type: 'core',
            version: '40.10.0'
        })];
        ux = stubObject<typeof cli>(sandbox, cli, {
            warn: () => { }
        });
        readJsonSync = stubReadJsonSync({
            [userPluginsPjsonV5Path]: [{
                name: 'linked-plugin',
                tag: 'symlink',
                version: '40.10.0'
            }, {
                name: 'user-plugin-latest',
                tag: '',
                version: '1.0.2'
            }, {
                name: 'user-plugin-versioned',
                tag: '1.0.1',
                version: '1.0.1'
            }, {
                name: 'core-plugin',
                tag: '',
                version: '40.10.0'
            }]
        });
        removeSync = stubRemoveSync();
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should short-circuit if neither v6 nor v5 plugin files are found', async () => {
        existsSync = stubExistsSync({
            [userPluginsPjsonV6Path]: false,
            [userPluginsPjsonV5Path]: false
        });

        await newMigrator().run();

        // fs assertions
        expect(existsSync.calledTwice).to.equal(true);
        expect(existsSync.firstCall.args).to.deep.equal([userPluginsPjsonV6Path]);
        expect(existsSync.secondCall.args).to.deep.equal([userPluginsPjsonV5Path]);
        expect(readJsonSync.notCalled).to.equal(true);

        // log assertions
        expect(ux.warn.notCalled).to.equal(true);
        expect(ux.error.notCalled).to.equal(true);
    });

    it('should short-circuit if the v6 plugin file is found', async () => {
        existsSync = stubExistsSync({
            [userPluginsPjsonV6Path]: true,
            [userPluginsPjsonV5Path]: true
        });

        await newMigrator().run();

        // fs assertions
        expect(existsSync.calledOnce).to.equal(true);
        expect(existsSync.firstCall.args).to.deep.equal([userPluginsPjsonV6Path]);
        expect(readJsonSync.notCalled).to.equal(true);

        // log assertions
        expect(ux.warn.notCalled).to.equal(true);
        expect(ux.error.notCalled).to.equal(true);
    });

    it('should short-circuit if the v5 plugin file cannot be read', async () => {
        existsSync = stubExistsSync({
            [userPluginsPjsonV6Path]: false,
            [userPluginsPjsonV5Path]: true
        });
        readJsonSync = stubReadJsonSync({
            [userPluginsPjsonV5Path]: null
        });

        await newMigrator().run();

        // fs assertions
        expect(existsSync.calledTwice).to.equal(true);
        expect(existsSync.firstCall.args).to.deep.equal([userPluginsPjsonV6Path]);
        expect(existsSync.secondCall.args).to.deep.equal([userPluginsPjsonV5Path]);
        expect(readJsonSync.calledOnce).to.equal(true);

        // log assertions
        expect(ux.warn.notCalled).to.equal(true);
        expect(ux.error.notCalled).to.equal(true);
    });

    it('should short-circuit if the v5 plugin file does not contain an array', async () => {
        existsSync = stubExistsSync({
            [userPluginsPjsonV6Path]: false,
            [userPluginsPjsonV5Path]: true
        });
        readJsonSync = stubReadJsonSync({
            [userPluginsPjsonV5Path]: {}
        });

        await newMigrator().run();

        // fs assertions
        expect(existsSync.calledTwice).to.equal(true);
        expect(existsSync.firstCall.args).to.deep.equal([userPluginsPjsonV6Path]);
        expect(existsSync.secondCall.args).to.deep.equal([userPluginsPjsonV5Path]);
        expect(readJsonSync.calledOnce).to.equal(true);

        // log assertions
        expect(ux.warn.notCalled).to.equal(true);
        expect(ux.error.notCalled).to.equal(true);
    });

    it('should read and warn on v5 plugins if the v5 plugin file exists without the v6 file', async () => {
        existsSync = stubExistsSync({
            [userPluginsPjsonV6Path]: false,
            [userPluginsPjsonV5Path]: true
        });

        await newMigrator().run();

        // fs assertions
        expect(existsSync.callCount).to.equal(4);
        const existsCalls = existsSync.getCalls();
        expect(existsCalls[0].args).to.deep.equal([userPluginsPjsonV6Path]);
        expect(existsCalls[1].args).to.deep.equal([userPluginsPjsonV5Path]);
        expect(existsCalls[2].args).to.deep.equal([userPluginsPjsonV6Path]);
        expect(existsCalls[3].args).to.deep.equal([userPluginsPjsonV5Path]);
        expect(readJsonSync.calledOnce).to.equal(true);
        expect(removeSync.calledOnce).to.equal(true);
        expect(removeSync.firstCall.args).to.deep.equal([userPluginsPjsonV5Path]);

        // log assertions
        const warnCalls = ux.warn.getCalls();
        const expectedLines = [
            'v5 plug-ins found -- Complete your update to v6:',
            '- linked-plugin -- To re-link, run sfdx plugins:link <path>',
            '- user-plugin-latest -- To re-install, run sfdx plugins:install user-plugin-latest',
            '- user-plugin-versioned -- To re-install, run sfdx plugins:install user-plugin-versioned@1.0.1',
            '- core-plugin is now a core plug-in -- Use sfdx plugins --core to view its version'
        ];
        expect(ux.warn.callCount).to.equal(expectedLines.length);
        for (const [i, line] of expectedLines.entries()) {
            expect(warnCalls[i].args.map(stripColors)).to.deep.equal([line]);
        }
        expect(ux.error.notCalled).to.equal(true);
    });

    it('should not show the instruction to complete your update if only core plugins are found', async () => {
        corePlugins = [stubInterface<IPlugin>(sandbox, {
            name: 'core-plugin1',
            type: 'core',
            version: '40.10.0'
        }), stubInterface<IPlugin>(sandbox, {
            name: 'core-plugin2',
            type: 'core',
            version: '40.10.0'
        })];
        existsSync = stubExistsSync({
            [userPluginsPjsonV6Path]: false,
            [userPluginsPjsonV5Path]: true
        });
        readJsonSync = stubReadJsonSync({
            [userPluginsPjsonV5Path]: [{
                name: 'core-plugin1',
                tag: '',
                version: '40.10.0'
            }, {
                name: 'core-plugin2',
                tag: '',
                version: '40.10.0'
            }]
        });

        await newMigrator().run();

        // fs assertions
        expect(existsSync.callCount).to.equal(4);
        const existsCalls = existsSync.getCalls();
        expect(existsCalls[0].args).to.deep.equal([userPluginsPjsonV6Path]);
        expect(existsCalls[1].args).to.deep.equal([userPluginsPjsonV5Path]);
        expect(existsCalls[2].args).to.deep.equal([userPluginsPjsonV6Path]);
        expect(existsCalls[3].args).to.deep.equal([userPluginsPjsonV5Path]);
        expect(readJsonSync.calledOnce).to.equal(true);
        expect(removeSync.calledOnce).to.equal(true);
        expect(removeSync.firstCall.args).to.deep.equal([userPluginsPjsonV5Path]);

        // log assertions
        const warnCalls = ux.warn.getCalls();
        // this is a little weird looking but not a real case we'll be dealing with for the current v5 -> v6 update
        const expectedLines = [
            '- core-plugin1 is now a core plug-in -- Use sfdx plugins --core to view its version',
            '- core-plugin2 is now a core plug-in -- Use sfdx plugins --core to view its version'
        ];
        expect(ux.warn.callCount).to.equal(expectedLines.length);
        for (const [i, line] of expectedLines.entries()) {
            expect(warnCalls[i].args.map(stripColors)).to.deep.equal([line]);
        }
        expect(ux.error.notCalled).to.equal(true);
    });

    function stubExistsSync(paths: Dictionary<boolean>): Stub<typeof fs.existsSync> {
        return sandbox.stub(fs, 'existsSync').callsFake(path => paths[path] || false);
    }

    function stubReadJsonSync(paths: Dictionary<AnyJson>): Stub<typeof fs.readJsonSync> {
        if ((fs.readJsonSync as any).isSinonProxy) { // tslint:disable-line:no-any isSinonProxy is not in sinon typings
            (fs.readJsonSync as sinon.SinonStub).restore();
        }
        return sandbox.stub(fs, 'readJsonSync').callsFake(path => paths[path]);
    }

    function stubRemoveSync(): Stub<typeof fs.removeSync> {
        return sandbox.stub(fs, 'removeSync');
    }

    function stripColors(s: string): string {
        const pattern = [
            '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[a-zA-Z\\d]*)*)?\\u0007)',
            '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PRZcf-ntqry=><~]))'
        ].join('|');
        return s.replace(new RegExp(pattern, 'g'), '');
    }

    function newMigrator() {
        return new PluginMigrator(
            corePlugins,
            fromStub(ux),
            userPluginsPjsonV5Path,
            userPluginsPjsonV6Path
        );
    }
});
