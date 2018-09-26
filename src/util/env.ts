import { Env as KitEnv } from '@salesforce/kit';
import { Optional } from '@salesforce/ts-types';

export class Env {
    public static readonly CLI_MODE = 'SFDX_ENV';
    public static readonly CLI_INSTALLER = 'SFDX_INSTALLER';
    public static readonly DISABLE_AUTOUPDATE_LEGACY = 'SFDX_AUTOUPDATE_DISABLE';
    public static readonly DISABLE_AUTOUPDATE_OCLIF = 'SFDX_DISABLE_AUTOUPDATE';
    public static readonly UPDATE_INSTRUCTIONS = 'SFDX_UPDATE_INSTRUCTIONS';
    public static readonly S3_HOST = 'SFDX_S3_HOST';
    public static readonly LAZY_LOAD_MODULES = 'SFDX_LAZY_LOAD_MODULES';

    public constructor(private env = process.env) {
        this.env = env;
    }

    public getString(key: string): Optional<string>;
    public getString(key: string, def: string): string;
    public getString(key: string, def?: string): Optional<string> {
        return this.env[key] || def;
    }

    public getBoolean(key: string, def: boolean = false): boolean {
        return this.getString(key, def.toString()).toLowerCase() === 'true';
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

    public isAutoupdateDisabled(): boolean {
        return this.getBoolean(Env.DISABLE_AUTOUPDATE_LEGACY) || this.getBoolean(Env.DISABLE_AUTOUPDATE_OCLIF);
    }

    public isAutoupdateDisabledSet(): boolean {
        return !!this.getString(Env.DISABLE_AUTOUPDATE_LEGACY) || !!this.getString(Env.DISABLE_AUTOUPDATE_OCLIF);
    }

    public setAutoupdateDisabled(value: boolean, updateInstructions?: string): void {
        this.setBoolean(Env.DISABLE_AUTOUPDATE_LEGACY, value);
        this.setBoolean(Env.DISABLE_AUTOUPDATE_OCLIF, value);
        if (updateInstructions) {
            this.setUpdateInstructions(updateInstructions);
        }
    }

    public setUpdateInstructions(value: string): void {
        this.setString(Env.UPDATE_INSTRUCTIONS, value);
    }

    public isDemoMode(): boolean {
        return this.getString(Env.CLI_MODE, 'production').toLowerCase() === 'demo';
    }

    public isInstaller(): boolean {
        return this.getBoolean(Env.CLI_INSTALLER);
    }

    public getS3HostOverride() {
        return this.getString(Env.S3_HOST);
    }

    public setS3HostOverride(value: string) {
        return this.setString(Env.S3_HOST, value);
    }

    public isLazyRequireEnabled(): boolean {
        return this.getBoolean(Env.LAZY_LOAD_MODULES);
    }
}

export default new Env();
