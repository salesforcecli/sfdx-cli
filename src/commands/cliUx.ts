import { CLI as CLI_UX } from 'cli-ux';

export class CLI extends CLI_UX {
    private readonly isJson: boolean;

    constructor(isJson?: boolean) {
        super();
        this.isJson = !!isJson;
    }

    public log(data: string) {
        if (!this.isJson) {
            super.log(data);
        }
    }

    public warn(data: string) {
        if (!this.isJson) {
            super.warn(data);
        }
    }

    public error(data: string) {
        if (!this.isJson) {
            super.error(data);
        }
    }
    public json(result: any | Error) {
        if (this.isJson) {
            const resultBlob: string = JSON.stringify(result);
            if (result instanceof Error) {
                super.error(resultBlob);
            } else {
                super.log(resultBlob);
            }
        }
    }
}
