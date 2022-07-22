/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, Lifecycle } from '@salesforce/core';
import { exec } from 'shelljs';
import { Doctor as SFDoctor, SfDoctorDiagnosis } from '../doctor';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('sfdx-cli', 'doctor');

export default class Doctor extends SfdxCommand {
  public static description = messages.getMessage('commandDescription');

  protected static flagsConfig = {
    command: flags.string({
      char: 'c',
      description: messages.getMessage('flags.command'),
    }),
    newissue: flags.boolean({
      char: 'i',
      description: messages.getMessage('flags.newissue'),
    }),
    plugin: flags.string({
      char: 'p',
      description: messages.getMessage('flags.plugin'),
    }),
  };

  public async run(): Promise<SfDoctorDiagnosis> {
    const promises: Array<Promise<void>> = [];
    const doctor = SFDoctor.getInstance();
    const lifecycle = Lifecycle.getInstance();
    const { command, newissue, plugin } = this.flags;

    if (command) {
      const cmdString = this.parseCommand(command);
      this.ux.log(`Running Command: ${cmdString}\n`);
      const cmdName = cmdString.split(' ')[1];
      doctor.addCommandName(cmdName);

      const execPromise = new Promise<void>((resolve) => {
        const execOptions = {
          async: true,
          silent: true,
          env: Object.assign({}, process.env),
        };

        exec(cmdString, execOptions, (code, stdout, stderr) => {
          const stdoutWithCode = `Command exit code: ${code}\n\n${stdout}`;
          const stdoutFileName = `${cmdName}-stdout.log`;
          const stderrFileName = `${cmdName}-stderr.log`;
          doctor.writeFile(stdoutFileName, stdoutWithCode);
          doctor.writeFile(stderrFileName, stderr);
          const stdoutLogLocation = doctor.getFilePath(stdoutFileName);
          const debugLogLocation = doctor.getFilePath(stderrFileName);
          this.ux.log(`Wrote command stdout log to: ${stdoutLogLocation}`);
          this.ux.log(`Wrote command debug log to: ${debugLogLocation}`);
          resolve();
        });
      });
      promises.push(execPromise);
    }

    if (plugin) {
      // verify the plugin flag matches an installed plugin
      if (!this.config.plugins.some((p) => p.name === plugin)) {
        const errMsg = `Specified plugin [${plugin}] is not installed. Please install it or choose another plugin.`;
        throw Error(errMsg);
      }

      // run the diagnostics for a specific plugin
      this.ux.log(`Running diagnostics for plugin: ${plugin}`);
      promises.push(lifecycle.emit(`sf-doctor-${plugin}`, doctor));
    } else {
      this.ux.log('Running diagnostics for all plugins and the core CLI');
      // run all diagnostics
      promises.push(lifecycle.emit('sf-doctor', doctor));

      // @ts-ignore Seems like a TypeScript bug. Compiler thinks
      //            doctor.diagnose() returns `void`.
      doctor.diagnose().forEach((prom) => promises.push(prom));
    }

    await Promise.all(promises);

    const diagnosis = doctor.getDiagnosis();
    doctor.writeFile('diagnosis.json', JSON.stringify(diagnosis, null, 2));
    const diagnosisLocation = doctor.getFilePath('diagnosis.json');
    this.ux.log(`Wrote doctor diagnosis to: ${diagnosisLocation}`);

    if (newissue) {
      // create a new issue via prompts (Inquirer)

      // See https://docs.github.com/en/enterprise-server@3.1/issues/tracking-your-work-with-issues/creating-an-issue#creating-an-issue-from-a-url-query
      // Example: https://github.com/forcedotcom/cli/issues/new?title=PLEASE+UPDATE&body=Autofill+info+collected+by+doctor...&labels=doctor

      this.ux.log('\nCreating a new GitHub issue for the CLI...\n');
      const isItNew = await this.ux.prompt(
        'Have you first checked the list of GitHub issues to ensure it has not already been posted? (y/n)'
      );

      if (isItNew.toLowerCase() === 'y') {
        const title = await this.ux.prompt('What is the subject of the issue?');
        this.ux.log('Encoded title=', encodeURI(title));
        this.ux.log("I'll create an issue for you with that title and attach the doctor diagnostics.");
      } else {
        this.ux.log('Please check https://github.com/forcedotcom/cli/issues first');
      }
    }

    return diagnosis;
  }

  // Takes the command flag and:
  //   1. ensures it begins with `${config.bin}`; typicall "sfdx" or "sf"
  //   2. ensures the `--dev-debug` flag is set
  private parseCommand(command: string): string {
    let fullCmd = command.trim();

    if (!fullCmd.startsWith(`${this.config.bin} `)) {
      fullCmd = `${this.config.bin} ${fullCmd}`;
    }

    if (!command.includes('--dev-debug')) {
      fullCmd += ' --dev-debug';
    }

    // TODO: We could also ensure the command is found within the list of plugins

    return fullCmd;
  }
}
