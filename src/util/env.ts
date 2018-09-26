/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Env as KitEnv } from '@salesforce/kit';

export class Env extends KitEnv {
    public static readonly CLI_MODE = 'SFDX_ENV';
    public static readonly CLI_INSTALLER = 'SFDX_INSTALLER';
    public static readonly DISABLE_AUTOUPDATE_LEGACY = 'SFDX_AUTOUPDATE_DISABLE';
    public static readonly DISABLE_AUTOUPDATE_OCLIF = 'SFDX_DISABLE_AUTOUPDATE';
    public static readonly UPDATE_INSTRUCTIONS = 'SFDX_UPDATE_INSTRUCTIONS';
    public static readonly S3_HOST = 'SFDX_S3_HOST';
    public static readonly LAZY_LOAD_MODULES = 'SFDX_LAZY_LOAD_MODULES';

    public constructor(env = process.env) {
        super(env);
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
