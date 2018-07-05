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
        public read(): void;
        public unread(): void;
        public canRead(): boolean;
        public upgrade(): () => { };
    }
}

declare module 'cli-engine/lib/commands/update' {
    import { Command, InputFlags } from 'cli-engine-command';

    export default class Update extends Command<any> {
        public static topic: string;
        public static description: string;
        public static args: any[];
        public static flags: InputFlags;

        public run(): Promise<void>;
        public logChop(): void;
    }
}
