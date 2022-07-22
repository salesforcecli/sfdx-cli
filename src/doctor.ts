/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import * as path from 'path';
import { Env, omit } from '@salesforce/kit';
import { AnyJson, KeyValue } from '@salesforce/ts-types';
import { Global } from '@salesforce/core';
import { IConfig } from '@oclif/config';
import { VersionDetail } from './cli';
import { Diagnostics } from './diagnostics';

export interface SfDoctor {
  addCommandName(commandName: string): void;
  addSuggestion(suggestion: string): void;
  addPluginData(pluginName: string, data: AnyJson): void;
  diagnose(): void;
  getDiagnosis(): SfDoctorDiagnosis;
  getFilePath(name: string): string;
  writeFile(name: string, contents: string): void;
}

type CliConfig = Partial<IConfig> & { nodeEngine: string };

export interface SfDoctorDiagnosis {
  versionDetail: VersionDetail;
  sfdxEnvVars: Array<KeyValue<string>>;
  sfEnvVars: Array<KeyValue<string>>;
  commandName?: string;
  cliConfig: CliConfig;
  pluginSpecificData: { [pluginName: string]: AnyJson };
  suggestions: string[];
}

const PINNED_SUGGESTIONS = [
  'check https://github.com/forcedotcom/cli/issues for community posted CLI issues',
  'check http://status.salesforce.com for any Salesforce announced problems',
];

export class Doctor implements SfDoctor {
  public readonly dir: string;
  public readonly id: number;

  // singleton instance
  private static instance: SfDoctor;

  // Contains all gathered data and results of diagnostics.
  private diagnosis: SfDoctorDiagnosis;

  private constructor(private readonly config: IConfig, versionDetail: VersionDetail) {
    this.id = Date.now();
    const sfdxEnvVars = new Env().entries().filter((e) => e[0].startsWith('SFDX_'));
    const sfEnvVars = new Env().entries().filter((e) => e[0].startsWith('SF_'));
    const cliConfig = omit(config, ['plugins', 'pjson', 'userPJSON', 'options']) as CliConfig;
    cliConfig.nodeEngine = config.pjson.engines.node;

    this.diagnosis = {
      versionDetail,
      sfdxEnvVars,
      sfEnvVars,
      cliConfig,
      pluginSpecificData: {},
      suggestions: [...PINNED_SUGGESTIONS],
    };
    const globalDir = config.bin === 'sfdx' ? Global.SFDX_DIR : Global.SF_DIR;
    this.dir = path.join(globalDir, 'sf-doctor');
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true });
    }
  }

  /**
   * Returns a singleton instance of an SfDoctor.
   */
  public static getInstance(): SfDoctor {
    if (!Doctor.instance) {
      throw Error('Must first initialize a new SfDoctor');
    }
    return Doctor.instance;
  }

  /**
   * Initializes a new instance of SfDoctor with CLI config data.
   *
   * @param config The oclif config for the CLI
   * @param versionDetail The result of running a verbose version command
   * @returns An instance of SfDoctor
   */
  public static init(config: IConfig, versionDetail: VersionDetail): SfDoctor {
    if (Doctor.instance) {
      throw Error('SfDoctor has already been initialized');
    }

    Doctor.instance = new this(config, versionDetail);
    return Doctor.instance;
  }

  /**
   * Use the gathered data to discover potential problems by running all diagnostics.
   *
   * @returns An array of diagnostic promises.
   */
  public diagnose(): Array<Promise<void>> {
    return new Diagnostics(this, this.config).run();
  }

  /**
   * Add a suggestion in the form of:
   *   "Because of <this data point> we recommend to <suggestion>"
   *
   * @param suggestion A suggestion for the CLI user to try based on gathered data
   */
  public addSuggestion(suggestion: string): void {
    this.diagnosis.suggestions.push(suggestion);
  }

  /**
   *
   * @param pluginName The name in the plugin's package.json
   * @param data Any data to add to the doctor diagnosis that is specific
   *             to the plugin and a valid JSON value.
   */
  public addPluginData(pluginName: string, data: AnyJson): void {
    const pluginEntry = this.diagnosis.pluginSpecificData[pluginName];
    if (pluginEntry) {
      if (Array.isArray(pluginEntry)) {
        pluginEntry.push(data);
      } else {
        this.diagnosis.pluginSpecificData[pluginName] = [pluginEntry, data];
      }
    } else {
      this.diagnosis.pluginSpecificData[pluginName] = data;
    }
  }

  /**
   * Add a command name that the doctor will run to the diagnosis data for
   * use by diagnostics.
   *
   * @param commandName The name of the command that the doctor will run. E.g., "force:org:list"
   */
  public addCommandName(commandName: string): void {
    this.diagnosis.commandName = commandName;
  }

  /**
   * Returns all the data gathered, paths to doctor files, and recommendations.
   */
  public getDiagnosis(): SfDoctorDiagnosis {
    return Object.assign({}, this.diagnosis);
  }

  /**
   * Get the absolute path for the provided file name. The file name will
   * have the doctor ID prepended to the name.
   *
   * @param fileName The name of the doctor file; e.g., "diagnosis.json"
   * @returns The full path to the doctor file.
   */
  public getFilePath(fileName: string): string {
    return path.join(this.dir, `${this.id}-${fileName}`);
  }

  /**
   * Write a file to the doctor directory. The file name will be prepended
   * with this doctor's id.
   *
   * E.g., `name = myContent.json` will write `1658350735579-myContent.json`
   *
   * @param name The name of the file to write within the SfDocter directory.
   * @param contents The string contents to write.
   */
  public writeFile(name: string, content: string): void {
    fs.writeFileSync(this.getFilePath(name), content);
  }
}
