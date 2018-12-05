import { isNil } from 'lodash';
import { Optional } from '../../node_modules/@salesforce/ts-types';

export class Env {
    constructor(private env: typeof process.env = process.env) {
        this.env = env;
    }

    public getString(key: string, def?: string): Optional<string> {
        return this.env[key] || def;
    }

    public getBoolean(key: string, def?: boolean): boolean {
        return this.getString(key, (!!def).toString())!.toLowerCase() === 'true';
    }

    public setString(key: string, val?: string): void {
        if (isNil(val)) {
            this.unset(key);
        }
        this.env[key] = val;
    }

    public setBoolean(key: string, val: boolean): void {
        this.setString(key, val.toString());
    }

    public unset(key: string): boolean {
        return delete this.env[key];
    }
}

export default new Env();
