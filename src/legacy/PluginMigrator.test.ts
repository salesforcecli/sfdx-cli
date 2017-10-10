import { expect } from 'chai';
import { sandbox as Sandbox, SinonSpy, createStubInstance } from 'sinon';
import * as fs from 'fs-extra';
import { Config } from 'cli-engine-config';
import Lock from 'cli-engine/lib/lock';
import PluginMigrator from './PluginMigrator';
import { CLI as CliUx } from 'cli-ux';

const userPluginsDir = '/User/foo/.local/share/sfdx/plugins';
const userPluginsPjsonV5Path = `${userPluginsDir}/plugins.json`;
const userPluginsPjsonV6Path = `${userPluginsDir}/package.json`;

describe('plugin migrator', () => {
    let sandbox;
    let lockUpgrade: sinon.SinonSpy;
    let lockDowngrade: sinon.SinonSpy;
    let lock: any;
    let config: any;
    let cliUx: CliUx;
    let existsSync: sinon.SinonSpy;
    let readJsonSync: sinon.SinonSpy;
    let removeSync: sinon.SinonSpy;

    beforeEach(() => {
        sandbox = Sandbox.create();
        lockDowngrade = sandbox.stub();
        lockUpgrade = sandbox.stub().callsFake(() => lockDowngrade);
        lock = { upgrade: lockUpgrade };
        config = { pjson: { 'cli-engine': { plugins: ['core-plugin'] } } };
        cliUx = createStubInstance(CliUx);
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
                tag: 'pre-release',
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

        // lock assertions
        expect(lockUpgrade.notCalled).to.equal(true);
        expect(lockDowngrade.notCalled).to.equal(true);

        // log assertions
        expect((cliUx.warn as SinonSpy).notCalled).to.equal(true);
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

        // lock assertions
        expect(lockUpgrade.notCalled).to.equal(true);
        expect(lockDowngrade.notCalled).to.equal(true);

        // log assertions
        expect((cliUx.warn as SinonSpy).notCalled).to.equal(true);
    });

    it('should short-circuit if the v5 plugin file cannot be read', async () => {
        existsSync = stubExistsSync({
            [userPluginsPjsonV6Path]: false,
            [userPluginsPjsonV5Path]: true
        });
        readJsonSync = stubReadJsonSync({
            [userPluginsPjsonV5Path]: undefined
        });

        await newMigrator().run();

        // fs assertions
        expect(existsSync.calledTwice).to.equal(true);
        expect(existsSync.firstCall.args).to.deep.equal([userPluginsPjsonV6Path]);
        expect(existsSync.secondCall.args).to.deep.equal([userPluginsPjsonV5Path]);
        expect(readJsonSync.calledOnce).to.equal(true);

        // lock assertions
        expect(lockUpgrade.notCalled).to.equal(true);
        expect(lockDowngrade.notCalled).to.equal(true);

        // log assertions
        expect((cliUx.warn as SinonSpy).notCalled).to.equal(true);
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

        // lock assertions
        expect(lockUpgrade.notCalled).to.equal(true);
        expect(lockDowngrade.notCalled).to.equal(true);

        // log assertions
        expect((cliUx.warn as SinonSpy).notCalled).to.equal(true);
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

        // lock assertions
        expect(lockUpgrade.calledOnce).to.equal(true);
        expect(lockDowngrade.calledOnce).to.equal(true);

        // log assertions
        const warn = (cliUx.warn as SinonSpy);
        const warnCalls = warn.getCalls();
        expect((cliUx.warn as SinonSpy).callCount).to.equal(5);
        expect(warnCalls[0].args.map((arg) => arg.message)).to.deep.equal([
            'v5 plug-ins found -- Complete your update to v6:'
        ]);
        expect(warnCalls[1].args.map((arg) => arg.message)).to.deep.equal([
            'linked-plugin -- To re-link, run "sfdx plugins:link <path>"'
        ]);
        expect(warnCalls[2].args.map((arg) => arg.message)).to.deep.equal([
            'user-plugin-latest -- To re-install, run \"sfdx plugins:install user-plugin-latest\"'
        ]);
        expect(warnCalls[3].args.map((arg) => arg.message)).to.deep.equal([
            'user-plugin-versioned -- To re-install, run \"sfdx plugins:install user-plugin-versioned@1.0.1\"'
        ]);
        expect(warnCalls[4].args.map((arg) => arg.message)).to.deep.equal([
            'core-plugin is now a core plug-in -- From now on, use \"sfdx plugins --core\" to view its version'
        ]);
    });

    function stubExistsSync(paths: any) {
        return sandbox.stub(fs, 'existsSync').callsFake((path: string) => {
            return paths[path] || false;
        });
    }

    function stubReadJsonSync(paths: any) {
        if ((fs.readJsonSync as any).isSinonProxy) {
            (fs.readJsonSync as SinonSpy).restore();
        }
        return sandbox.stub(fs, 'readJsonSync').callsFake((path: string) => {
            return paths[path];
        });
    }

    function stubRemoveSync() {
        return sandbox.stub(fs, 'removeSync');
    }

    function newMigrator() {
        return new PluginMigrator(
            config,
            cliUx,
            userPluginsPjsonV5Path,
            userPluginsPjsonV6Path,
            lock
        );
    }
});
