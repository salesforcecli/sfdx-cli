import { Command } from 'cli-engine-command';
import timedHook from '../timedHook';
import { Config } from 'cli-engine-config';
import { color } from 'cli-engine-command/lib/color';

function run(config: any, { module }: any) {
    if (module.namespace) {
        const ns = module.namespace.name;

        module.commands = convertFromV5Commands(module.commands, ns);
        const topics = module.topics || (module.topic && [module.topic]);
        module.topics = convertFromV5Topics(topics, ns, module.namespace.description);

        delete module.namespace;
    }
}

function convertFromV5Commands(commands: any[] = [], ns: string) {
    return commands
        .map((cmd: any) => {
            if (cmd.namespace === ns) {
                cmd.topic = ns;
                return cmd;
            }
            cmd.topic = applyNamespace(cmd.topic, ns);
            cmd.buildHelp = (config: Config) => {
                const help = Command.buildHelp.call(cmd, config);
                // Strip the possibly ANSI-colored '[flags]' suffix cli-engine appends to usage strings
                return help.replace(/(?:\u001b\[[0-9]+m)?\[flags\](?:\u001b\[[0-9]+m)?/, '');
            };

            // Do not use arrow function here because we need access to the command's properties
            cmd.buildHelpLine = function(config: Config): [string, string] {
                return [`${this.topic}:${this.command}`, color.dim(this.description)];
            };

            return cmd;
        });
}

function convertFromV5Topics(topics: any[] = [], ns: string, nsDescription: string) {
    return [{
        description: nsDescription,
        hidden: false,
        name: ns
    }].concat(topics.map((topic: any) => {
        topic.name = applyNamespace(topic.name, ns);
        return topic;
    }));
}

function hasNamespace(name: string, ns: string) {
    return name && name.indexOf(ns + ':') === 0;
}

function applyNamespace(name: string, ns: string) {
    return !hasNamespace(name, ns) ? `${ns}:${name}` : name;
}

export = timedHook('plugins:parse:legacy', run);
