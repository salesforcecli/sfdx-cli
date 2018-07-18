// TODO: commented out until oclif adds `module` to the `plugins:parse` hook options?
// import { Command } from '@oclif/command';
// import { Config } from '@oclif/config';
// import chalk from 'chalk';
import timedHook from '../timedHook';

// function convertFromV5Commands(commands: any[] = [], ns: string): any[] { // tslint:disable-line:no-any
//     return commands
//         .map((cmd: any) => { // tslint:disable-line:no-any
//             if (cmd.namespace === ns) {
//                 cmd.topic = ns;
//                 return cmd;
//             }
//             cmd.topic = applyNamespace(cmd.topic, ns);
//             cmd.buildHelp = (config: Config) => {
//                 const help = Command.buildHelp.call(cmd, config);
//                 // Strip the possibly ANSI-colored '[flags]' suffix cli-engine appends to usage strings
//                 return help.replace(/(?:\u001b\[[0-9]+m)?\[flags\](?:\u001b\[[0-9]+m)?/, '');
//             };

//             // Do not use arrow function here because we need access to the command's properties
//             cmd.buildHelpLine = function(config: Config): [string, string] {
//                 return [`${this.topic}:${this.command}`, chalk.dim(this.description)];
//             };

//             return cmd;
//         });
// }

// function convertFromV5Topics(topics: any[] = [], ns: string, nsDescription: string): any[] { // tslint:disable-line:no-any
//     return [{
//         description: nsDescription,
//         hidden: false,
//         name: ns
//     }].concat(topics.map((topic: any) => { // tslint:disable-line:no-any
//         topic.name = applyNamespace(topic.name, ns);
//         return topic;
//     }));
// }

// function hasNamespace(name: string, ns: string): boolean {
//     return !!name && name.indexOf(ns + ':') === 0;
// }

// function applyNamespace(name: string, ns: string): string {
//     return !hasNamespace(name, ns) ? `${ns}:${name}` : name;
// }

const hook = timedHook<'plugins:parse'>('plugins:parse:legacy', async options => {
    console.log('TODO: implement plugins:parse:legacy hook');
    // if (module.namespace) {
    //     const ns = module.namespace.name;

    //     module.commands = convertFromV5Commands(module.commands, ns);
    //     const topics = module.topics || (module.topic && [module.topic]);
    //     module.topics = convertFromV5Topics(topics, ns, module.namespace.description);

    //     delete module.namespace;
    // }
});

export default hook;
