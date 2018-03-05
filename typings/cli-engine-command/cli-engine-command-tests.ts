import { Command, InputFlags, Output } from 'cli-engine-command';
import { ConfigOptions } from 'cli-engine-config';

class TestCommand extends Command<InputFlags> {
    constructor(options: { config?: ConfigOptions, output?: Output } = {}) {
        super(options);
    }

    public async init() {
        // ...
    }

    public async run() {
        this.out.debug(`Run: ${this.config.name}`);
        this.out.debug(`  foo? ${this.args && this.args['foo']}`);
        const data = await test.http.get('https://example.com', {
            headers: {
                Accept: 'application/json'
            }
        });
        test.out.debug(data);
    }
}

const flags: InputFlags = {
    foo: {
        char: 't',
        description: 'test'
    }
};

const test = new TestCommand(flags);
/* tslint:disable:next-line no-floating-promises */
test.run();
