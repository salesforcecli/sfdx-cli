/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { EnvVars } from '@salesforce/core';

export class Env extends EnvVars {
  public static readonly CLI_MODE = 'SFDX_ENV';
  public static readonly CLI_INSTALLER = 'SFDX_INSTALLER';
  public static readonly DISABLE_AUTOUPDATE_LEGACY = 'SF_AUTOUPDATE_DISABLE';
  public static readonly DISABLE_AUTOUPDATE_OCLIF = 'SF_DISABLE_AUTOUPDATE';
  public static readonly UPDATE_INSTRUCTIONS = 'SFDX_UPDATE_INSTRUCTIONS';
  public static readonly NPM_REGISTRY = 'SF_NPM_REGISTRY';

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

  public getNpmRegistryOverride(): string {
    return this.getString(Env.NPM_REGISTRY) as string;
  }

  public setNpmRegistryOverride(value: string): void {
    return this.setString(Env.NPM_REGISTRY, value);
  }
}

export default new Env();
