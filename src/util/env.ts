export class Env {
    public static readonly CLI_ENV = 'SFDX_ENV';
    public static readonly CLI_INSTALLER = 'SFDX_INSTALLER';
    public static readonly DISABLE_AUTOUPDATE_LEGACY = 'SFDX_AUTOUPDATE_DISABLE';
    public static readonly DISABLE_AUTOUPDATE_OCLIF = 'SFDX_DISABLE_AUTOUPDATE';
    public static readonly UPDATE_INSTRUCTIONS = 'SFDX_UPDATE_INSTRUCTIONS';
    public static readonly LAZY_LOAD_MODULES = 'SFDX_LAZY_LOAD_MODULES';

    public constructor(private env: typeof process.env = process.env) {
        this.env = env;
    }

    public getString(key: string): string | undefined;
    public getString(key: string, def: string): string;
    public getString(key: string, def?: string): string | undefined {
        return this.env[key] || def;
    }

    public getBoolean(key: string, def?: boolean): boolean {
        return this.getString(key, (!!def).toString()).toLowerCase() === 'true';
    }

    public setString(key: string, val?: string): void {
        if (val == null) {
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

    public isLazyRequireEnabled(): boolean {
        return this.getBoolean(Env.LAZY_LOAD_MODULES);
    }

    public isAutoupdateDisabled(): boolean {
        return this.getBoolean(Env.DISABLE_AUTOUPDATE_LEGACY) || this.getBoolean(Env.DISABLE_AUTOUPDATE_OCLIF);
    }

    public isAutoupdateDisabledSet(): boolean {
        return !!this.getString(Env.DISABLE_AUTOUPDATE_LEGACY) || !!this.getString(Env.DISABLE_AUTOUPDATE_OCLIF);
    }

    public setAutoupdateDisabled(value: boolean): void {
        this.setBoolean(Env.DISABLE_AUTOUPDATE_LEGACY, value);
        this.setBoolean(Env.DISABLE_AUTOUPDATE_OCLIF, value);
    }

    public setUpdateInstructions(value: string): void {
        this.setString(Env.UPDATE_INSTRUCTIONS, value);
    }

    public isDemoMode(): boolean {
        return this.getString(Env.CLI_ENV, 'production').toLowerCase() === 'demo';
    }

    public isInstaller(): boolean {
        return this.getBoolean(Env.CLI_INSTALLER);
    }
}

export default new Env();
