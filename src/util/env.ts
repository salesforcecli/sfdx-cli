export class Env {
    constructor(private env: typeof process.env = process.env) {
        this.env = env;
    }

    public get(key: string, def?: string) {
        return this.env[key] || def;
    }

    public getBoolean(key: string, def?: boolean) {
        return this.get(key, (!!def).toString())!.toLowerCase() === 'true';
    }
}

export default new Env();
