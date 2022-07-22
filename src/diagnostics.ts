/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { IConfig } from '@oclif/config';
import { isString } from '@salesforce/ts-types';
import { exec } from 'shelljs';
import { SfDoctor, SfDoctorDiagnosis } from './doctor';

// const SUPPORTED_SHELLS = [
//   'bash',
//   'zsh',
//   'powershell'
//   'cmd.exe'
// ];

/**
 *  Diagnostics are all the tests that ensure a known, clean CLI configuration
 *  and a way to run them asynchronously. Typically this is used only by the
 *  Doctor class.
 */
export class Diagnostics {
  private diagnosis: SfDoctorDiagnosis;

  public constructor(private readonly doctor: SfDoctor, private config: IConfig) {
    this.diagnosis = doctor.getDiagnosis();
  }

  /**
   * Run all diagnostics using the data gathered by the doctor and add
   * suggestions to the diagnosis.
   */
  public run(): Array<Promise<void>> {
    this.doctor.getDiagnosis();
    const diagnosticPromises: Array<Promise<void>> = [];
    const diagnosticFuncs = Reflect.ownKeys(Diagnostics.prototype).filter((d) => isString(d) && d.endsWith('Check'));

    for (const diagnostic of diagnosticFuncs) {
      console.log('Running diagnostic:', diagnostic);
      // @ts-ignore
      diagnosticPromises.push(this[diagnostic]());
    }
    return diagnosticPromises;
  }

  // **********************************************************
  //                 D I A G N O S T I C S
  //
  // NOTE: All diagnostic function names must end with "Check"
  //       or they will not be run with all diagnostics.
  //
  // **********************************************************

  public async outdatedNodejsCheck(): Promise<void> {
    const enginesVersion = this.diagnosis.cliConfig.nodeEngine; // example value: >=14.0.0
    const nodeVersion = this.diagnosis.versionDetail.nodeVersion.split('-')[1].substring(1);

    // TODO: This is overly naive and should be fixed. It's currently hardcoded
    //       to handle a nodeEngines value of ">=14.0.0"
    const eVersion = enginesVersion.substring(2);

    if (nodeVersion < eVersion) {
      this.doctor.addSuggestion(`Your version of node [${nodeVersion}] is too low. It should be ${enginesVersion}`);
    }
  }

  public async outdatedCliVersionCheck(): Promise<void> {
    const cliVersionArray = this.diagnosis.versionDetail.cliVersion.split('/');
    const cliName = cliVersionArray[0];
    const cliVersion = cliVersionArray[1];

    // NOTE: This relies on the user having npm. There are probably better ways
    //       to do this check.

    return new Promise<void>((resolve) => {
      const execOptions = { async: true, silent: true };
      exec(`npm view ${cliName} --json`, execOptions, (code, stdout, stderr) => {
        if (code === 0) {
          const latestVersion = JSON.parse(stdout)['dist-tags'].latest;
          // const latestVersion = JSON.parse(stdout)['dist-tags']['latest-rc'];
          if (cliVersion < latestVersion) {
            this.doctor.addSuggestion(
              `Update your CLI version from ${cliVersion} to the latest version: ${latestVersion}`
            );
          }
        } else {
          this.doctor.addSuggestion('Could not determine latest CLI version');
        }
        resolve();
      });
    });
  }

  public async salesforceDxPluginCheck(): Promise<void> {
    const plugins = this.diagnosis.versionDetail.pluginVersions;
    if (plugins?.some((p) => p.split(' ')[0] === 'salesforcedx')) {
      const bin = this.diagnosis.cliConfig.bin;
      this.doctor.addSuggestion(
        `The salesforcedx plugin is deprecated. Please uninstall by running \`${bin} plugins:uninstall salesforcedx\``
      );
    }
  }

  public async linkedPluginCheck(): Promise<void> {
    const plugins = this.config.plugins;
    const linkedPlugins = plugins.filter((p) => p.name.includes('(link)'));
    linkedPlugins.forEach((lp) => {
      this.doctor.addSuggestion(`Warning: the [${lp.name}] plugin is linked.`);
    });
  }
}
