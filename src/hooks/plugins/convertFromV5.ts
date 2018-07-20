import { PluginLegacy } from '@oclif/plugin-legacy';
// import chalk from 'chalk';
import { isJsonMap } from '@salesforce/ts-json';
import { compact } from '../../util';
import timedHook from '../timedHook';

function convertFromV5Commands(commands: any[] = [], ns: string): any[] { // tslint:disable-line:no-any
    return commands
        .map((cmd: any) => { // tslint:disable-line:no-any
            if (cmd.namespace === ns) {
                cmd.topic = ns;
                return cmd;
            }
            cmd.topic = applyNamespace(cmd.topic, ns);
            // TODO???
            // cmd.buildHelp = (config: Config) => {
            //     const help = Command.buildHelp.call(cmd, config);
            //     // Strip the possibly ANSI-colored '[flags]' suffix cli-engine appends to usage strings
            //     return help.replace(/(?:\u001b\[[0-9]+m)?\[flags\](?:\u001b\[[0-9]+m)?/, '');
            // };

            // TODO???
            // Do not use arrow function here because we need access to the command's properties
            // cmd.buildHelpLine = function(config: Config): [string, string] {
            //     return [`${this.topic}:${this.command}`, chalk.dim(this.description)];
            // };

            return cmd;
        });
}

function convertFromV5Topics(topics: any[] = [], ns: string, nsDescription: string): any[] { // tslint:disable-line:no-any
    return [{
        description: nsDescription,
        hidden: false,
        name: ns
    }].concat(topics.map((topic: any) => { // tslint:disable-line:no-any
        topic.name = applyNamespace(topic.name, ns);
        return topic;
    }));
}

function hasNamespace(name: string, ns: string): boolean {
    return !!name && name.indexOf(ns + ':') === 0;
}

function applyNamespace(name: string, ns: string): string {
    return !hasNamespace(name, ns) ? `${ns}:${name}` : name;
}

const hook = timedHook<'init'>('init:plugins:legacy', async options => {
    await Promise.all(options.config.plugins.map(async (p, i) => {
        if (p.valid) return;
        try {
            // Emulate the cli-engine version envar for plugins previously coded to expect it
            process.env.CLI_ENGINE_VERSION = 'v7';
            const plugin = new PluginLegacy(options.config, p);
            const cliEngineConfig = p.pjson['cli-engine'];
            // TODO: support for direct install of fct and fls???  think they lack this pjson section
            if (isJsonMap(cliEngineConfig) && cliEngineConfig.namespace) {
                const module = require(p.name);
                const ns = module.namespace.name;
                module.commands = convertFromV5Commands(module.commands, ns);
                const topics = module.topics || (module.topic && [module.topic]);
                module.topics = convertFromV5Topics(topics, ns, module.namespace.description);
                delete module.namespace;
            }
            await plugin.load();
            // TODO: maybe post-inspect loaded plugin for ns and massage?  see fct/fls note above
            options.config.plugins[i] = plugin;
        } catch (err) {
            err.name = `Plugin ${p.name}: ${err.name}`;
            err.detail = compact([err.detail, p.root]).join(' ');
            process.emitWarning(err);
        }
    }));
});

export default hook;
