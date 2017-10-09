declare module 'cli-engine' {
    import { Config } from 'cli-engine-config';

    export default class CLI {
        constructor({ argv, config }: { argv: string[], config: Config });
        public run(): void;
    }
}

declare module 'cli-engine/lib/lock' {
    import { Config } from 'cli-engine-config';
    import CLI from 'cli-engine';

    export default class Lock {
        config: Config;
        cli: CLI;

        public constructor(config: Config);
        public updatelockfile(): string;
        public read();
        public unread();
        public canRead();
        public upgrade();
    }
}
