import { AnyJson } from '@salesforce/ts-types';
import { CLI as CliUx } from 'cli-ux';

export class Ux extends CliUx {
    private readonly isJson: boolean;

    constructor(isJson?: boolean) {
        super();
        this.isJson = !!isJson;
    }

    public log(data: string): void {
        if (!this.isJson) {
            super.log(data);
        }
    }

    public warn(data: string): void {
        if (!this.isJson) {
            super.warn(data);
        }
    }

    public error(data: string): void {
        if (!this.isJson) {
            super.error(data);
        }
    }

    public json(data: AnyJson): void {
        if (this.isJson) {
            const json: string = JSON.stringify(data);
            if (data instanceof Error) {
                super.error(json);
            } else {
                super.log(json);
            }
        }
    }
}
