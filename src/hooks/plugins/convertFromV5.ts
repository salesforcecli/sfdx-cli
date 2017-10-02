import timedHook from '../timedHook';

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
            if (!cmd.command) {
                // Prune commands mapped to a topic, as v6 handles all help
                return null;
            }
            cmd.topic = applyNamespace(cmd.topic, ns);
            return cmd;
        })
        .filter((cmd: any) => cmd !== null);
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
