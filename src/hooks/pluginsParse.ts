function parse(config: any, {module}: any) {
    if (module.namespace) {
        convertFromV5Plugin(module);
    }
}

function convertFromV5Plugin(module: any) {
    const ns = module.namespace.name;

    module.commands
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

    module.topics = [{
            description: module.namespace.description,
            hidden: false,
            name: ns,
        }].concat(module.topics.map((topic: any) => {
            topic.name = applyNamespace(topic.name, ns);
            return topic;
        }));

    delete module.namespace;
}

function hasNamespace(name: string, ns: string) {
    return name && name.indexOf(ns + ":") === 0;
}

function applyNamespace(name: string, ns: string) {
    return !hasNamespace(name, ns) ? `${ns}:${name}` : name;
}

export = parse;
