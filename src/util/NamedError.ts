export class NamedError extends Error {

    private _name: string;
    private _reason: Error;

    constructor(name: string, message: string) {
        super(message);
        this._name = name;
    }

    public get name(): string {
        return this._name;
    }

    public get reason(): Error {
        return this._reason;
    }

    public set reason(value: Error) {
        this._reason = value;
    }

    public setReason(value: Error) {
        this._reason = value;
        return this;
    }

    public setReasonByMessage(value: string) {
        this._reason = new Error(value);
        return this;
    }
}

export class InvalidUrlError extends NamedError {
    constructor(url: string) {
        super('InvalidUrl', `The following url is not valid ${url}`);
    }
}

export class MissingRequiredParameter extends NamedError {
    constructor(parameterName: string) {
        super('MissingRequiredParameter', `The parameter ${parameterName} is missing but required.`);
    }
}

export class ExecProcessFailed extends NamedError {
    constructor(process: string, errorCode: string) {
        super('Sub-process failed.', `Exec'd subprocess ${process} failed with error code: ${errorCode}`);
    }
}

export class UnexpectedHost extends NamedError {
    constructor(url: string) {
        super('UnexpectedHost', `The host is not allowed to provide signing information. [${url}]`);
    }
}

export class UnauthorizedSslConnection extends NamedError {
    constructor(url: string) {
        const message = `An attempt is being made to retrieve content from an unauthorized ssl url [${url}].
This endpoint could be using a self signed certificate.
To allow this set the following environment variable: NODE_TLS_REJECT_UNAUTHORIZED=0`;
        super('UnauthorizedSslConnection', message);
    }
}

export class SignSignedCertError extends NamedError {
    constructor() {
        super('SelfSignedCert', 'Encountered a self signed certificated. To enable "export NODE_TLS_REJECT_UNAUTHORIZED=0"');
    }
}
