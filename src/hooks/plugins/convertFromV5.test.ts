import { assert, expect } from 'chai';
import hook = require('./convertFromV5');

/* tslint:disable:no-unused-expression */

describe('plugins:parse hook', () => {
    it('should map a namespaced module\'s commands and topics to a nested topic model', () => {
        const rootCommand = {
            namespace: 'root'
        };

        const mainTopicCommand = {
            topic: 'topic'
        };

        const normalCommand = {
            topic: 'topic',
            command: 'command'
        };

        const module = {
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

        hook({}, {module});

        // root command gets ns mapped as a root topic
        expect((rootCommand as any).topic).to.equal('root');
        // normal command gets its topic prefixed with the root ns
        expect(normalCommand.topic).to.equal('root:topic');

        expect(module.topics).to.exist;
        expect(module.topics.length).to.equal(2);
        expect(module.topics[0].name).to.equal('root');
        expect(module.topics[1].name).to.equal('root:topic');

        // legacy namespace is removed from the massaged module
        expect(module.namespace).to.be.undefined;
    });

    it('should support a module with only a single topic', () => {
        const normalCommand = {
            topic: 'topic',
            command: 'command'
        };

        const module: any = {
            namespace: {
                name: 'root'
            },
            commands: [normalCommand],
            topic: {
                name: 'topic'
            }
        };

        hook({}, {module});

        // normal command gets its topic prefixed with the root ns
        expect(normalCommand.topic).to.equal('root:topic');

        expect(module.topics).to.exist;
        expect(module.topics.length).to.equal(2);
        expect(module.topics[0].name).to.equal('root');
        expect(module.topics[1].name).to.equal('root:topic');

        // legacy namespace is removed from the massaged module
        expect(module.namespace).to.be.undefined;
    });

    it('should not die when given a module object lacking commands or topics', () => {
        hook({}, {module: {namespace: 'root'}});
    });
});
