declare module 'cli-engine' {
    export default class CLI {
        constructor({ argv, config }: { argv: string[], config: any });
        public run(): void;
    }
}
