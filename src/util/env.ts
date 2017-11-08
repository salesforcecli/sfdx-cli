import { isNil } from 'lodash';

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

    public set(key: string, val?: string) {
        if (isNil(val)) {
            this.delete(key);
        }
        this.env[key] = val;
    }

    public setBoolean(key: string, val: boolean) {
        this.set(key, val.toString());
    }

    public delete(key: string) {
        return delete this.env[key];
    }
}

export default new Env();
