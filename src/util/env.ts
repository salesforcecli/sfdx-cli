export class Env {
    constructor(private env: typeof process.env) {
        this.env = env;
    }

    public get(key: string, def?: string) {
        return this.env[key] || def;
    }

    public getBoolean(key: string, def?: boolean) {
        const d = (def || false).toString();
        return this.get(key, d)!.toLowerCase() === d;
    }
}

export default new Env(process.env);
