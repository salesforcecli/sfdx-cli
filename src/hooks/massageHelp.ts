import { Hook } from '@oclif/config';
import Help from '@oclif/plugin-help';
import { renderList } from '@oclif/plugin-help/lib/list';
import chalk from 'chalk';

const { bold } = chalk;

export const help: Hook<'init'> = async options => {
    Help.prototype.topics = function(topics) {
        if (!topics.length) return;

        const theTopics: Array<Array<string | undefined>> = [];
        const theCommands: Array<Array<string | undefined>> = [];

        topics.map(t => {
            const out = [
                t.name,
                t.description && this.render(t.description.split('\n')[0])
            ];
            if (this.config.commandIDs.includes(t.name)) {
                theCommands.push(out);
            }
            const tp = this.config.commandIDs.find(id => {
                if (id.match(`${t.name}:`)) return true;
                return false;
            });
            if (tp) {
                theTopics.push(out);
            }
        });

        const commandsList = renderList(theCommands, {
            spacer: '\n',
            stripAnsi: this.opts.stripAnsi,
            maxWidth: this.opts.maxWidth - 2
        });

        const output = [[
            bold('COMMANDS'),
            indent(commandsList)
        ].join('\n')
        ];

        if (theTopics.length) {
            const topicsList = renderList(theTopics, {
                spacer: '\n',
                stripAnsi: this.opts.stripAnsi,
                maxWidth: this.opts.maxWidth - 2
            });
            output.push(
                [
                    bold('TOPICS'),
                    indent('Run help for each topic below to view subcommands\n'),
                    indent(topicsList)
                ].join('\n')
            );
        }

        return output.join('\n\n');
    };
};

function indent(str: string): string {
    return str.replace(/^(?!\s*$)/mg, ' '.repeat(2));
}
