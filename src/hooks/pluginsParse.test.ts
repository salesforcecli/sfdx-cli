import { assert, expect } from "chai";
import hook = require("./pluginsParse");

/* tslint:disable:no-unused-expression */

describe("plugins:parse hook", () => {
    it("should map a namespaced module's commands and topics to a nested topic model", () => {
        const rootCommand = {
            namespace: "root",
        };

        const mainTopicCommand = {
            topic: "topic",
        };

        const normalCommand = {
            topic: "topic",
            command: "command",
        };

        const module = {
            namespace: {
                name: "root",
            },
            commands: [
                rootCommand,
                mainTopicCommand,
                normalCommand,
            ],
            topics: [{
                name: "topic",
            }],
        };

        hook({}, {module});

        // root command gets ns mapped as a root topic
        expect((rootCommand as any).topic).to.equal("root");
        // "main" topics (e.g. not root and no command name) get removed (as they were used for ad hoc
        // help gen in v5 that v6 now provides)
        expect(module.commands.filter((c: any) => !c.command && !c.namespace).length).to.be.equal(0);
        // normal command gets its topic prefixed with the root ns
        expect(normalCommand.topic).to.equal("root:topic");

        // legacy namespace is removed from the massaged module
        expect(module.namespace).to.be.undefined;
    });

    it("should not die when given a module object lacking commands or topics", () => {
        hook({}, {module: {namespace: "root"}});
    });
});
