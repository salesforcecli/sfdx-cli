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
  public static readonly NPM_REGISTRY = 'SFDX_NPM_REGISTRY';
  public static readonly LAZY_LOAD_MODULES = 'SFDX_LAZY_LOAD_MODULES';

  public constructor(env = process.env) {
    super(env);
  }

  public normalizeAutoupdateDisabled(): void {
    // Ensure that the legacy envar always causes the oclif counterpart to be set
    if (this.getBoolean(Env.DISABLE_AUTOUPDATE_LEGACY)) {
      this.setBoolean(Env.DISABLE_AUTOUPDATE_OCLIF, true);
    } else if (this.getBoolean(Env.DISABLE_AUTOUPDATE_OCLIF)) {
      this.setBoolean(Env.DISABLE_AUTOUPDATE_LEGACY, true);
    }
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

  public getS3HostOverride(): string {
    return this.getString(Env.S3_HOST) as string;
  }

  public setS3HostOverride(value: string): void {
    return this.setString(Env.S3_HOST, value);
  }

  public getNpmRegistryOverride(): string {
    return this.getString(Env.NPM_REGISTRY) as string;
  }

  public setNpmRegistryOverride(value: string): void {
    return this.setString(Env.NPM_REGISTRY, value);
  }

  public isLazyRequireEnabled(): boolean {
    return this.getBoolean(Env.LAZY_LOAD_MODULES);
  }
}

export default new Env();
