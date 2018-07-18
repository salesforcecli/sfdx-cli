declare module 'cli-engine' {
    import { Config } from 'cli-engine-config';

    export default class CLI {
        constructor({ argv, config }: { argv: string[], config: Config });
        public run(): void;
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
