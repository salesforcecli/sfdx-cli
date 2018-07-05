import { AnyDictionary } from '@salesforce/ts-json';
import { expect } from 'chai';
import hook = require('./convertFromV5');

/* tslint:disable:no-unused-expression */

describe('plugins:parse hook', () => {
    it('should map a namespaced module\'s commands and topics to a nested topic model', async () => {
        const rootCommand: AnyDictionary = {
            namespace: 'root'
        };

        const mainTopicCommand = {
            topic: 'topic'
        };

        const normalCommand = {
            topic: 'topic',
            command: 'command'
        };

        const mod = {
            namespace: {
                name: 'root'
            },
            commands: [
                rootCommand,
                mainTopicCommand,
                normalCommand
            ],
            topics: [{
                name: 'topic'
            }]
        };

        await hook({}, { module: mod });

        // root command gets ns mapped as a root topic
        expect(rootCommand.topic).to.equal('root');
        // normal command gets its topic prefixed with the root ns
        expect(normalCommand.topic).to.equal('root:topic');

        expect(mod.topics).to.exist;
        expect(mod.topics.length).to.equal(2);
        expect(mod.topics[0].name).to.equal('root');
        expect(mod.topics[1].name).to.equal('root:topic');

        // legacy namespace is removed from the massaged module
        expect(mod.namespace).to.be.undefined;
    });

    it('should support a module with only a single topic', async () => {
        const normalCommand = {
            topic: 'topic',
            command: 'command'
        };

        const mod: AnyDictionary = {
            namespace: {
                name: 'root'
            },
            commands: [normalCommand],
            topic: {
                name: 'topic'
            }
        };

        await hook({}, { module: mod });

        // normal command gets its topic prefixed with the root ns
        expect(normalCommand.topic).to.equal('root:topic');

        expect(mod.topics).to.exist;
        expect(mod.topics.length).to.equal(2);
        expect(mod.topics[0].name).to.equal('root');
        expect(mod.topics[1].name).to.equal('root:topic');

        // legacy namespace is removed from the massaged module
        expect(mod.namespace).to.be.undefined;
    });

    it('should not die when given a module object lacking commands or topics', async () => {
        await hook({}, { module: { namespace: 'root' } });
    });

    it('should not show flags in help usage', async () => {
        const normalCommand: AnyDictionary = {
            id: 'topic:command',
            topic: 'topic',
            command: 'command',
            flags: [{
                name: 'var'
            }]
        };

        const mod = {
            namespace: {
                name: 'root'
            },
            commands: [normalCommand],
            topic: {
                name: 'topic'
            }
        };

        await hook({}, { module: mod });

        // normal command gets its topic prefixed with the root ns
        expect(normalCommand.buildHelp({ bin: 'sfdx' })).to.not.contain('[flags]');
    });

    it('should not show usage in line help', async () => {
        const normalCommand: AnyDictionary = {
            topic: 'topic',
            command: 'command',
            usage: 'my usage'
        };

        const mod = {
            namespace: {
                name: 'root'
            },
            commands: [normalCommand],
            topic: {
                name: 'topic'
            }
        };

        await hook({}, { module: mod });

        // normal command gets its topic prefixed with the root ns
        expect(normalCommand.buildHelpLine()[0]).to.equal('root:topic:command');
    });
});
