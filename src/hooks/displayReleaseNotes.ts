/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { join } from 'path';
import { spawn } from 'child_process';
import { Hook, CliUx } from '@oclif/core';

const logError = (msg: Error): void => {
  CliUx.ux.log('NOTE: This error can be ignored in CI and may be silenced in the future');
  CliUx.ux.log('- Set the SFDX_HIDE_RELEASE_NOTES env var to "true" to skip this script\n');
  CliUx.ux.log(msg.toString());
};

/*
 * NOTE: Please read "Notes about the hook scripts" in this PR before making changes:
 * https://github.com/salesforcecli/sfdx-cli/pull/407
 */

const hook: Hook.Update = async (): Promise<void> =>
  new Promise((resolve) => {
    if (process.env.SFDX_HIDE_RELEASE_NOTES === 'true') {
      resolve();
    }

    // NOTE: This is `sfdx.cmd` here and not `run.cmd` because it gets renamed here:
    // https://github.com/salesforcecli/sfdx-cli/blob/4428505ab69aa6e21214dba96557e2ce396a82e0/src/hooks/postupdate.ts#L62
    const executable = process.platform === 'win32' ? 'sfdx.cmd' : 'run';
    const cmd = spawn(join(__dirname, '..', '..', 'bin', executable), ['whatsnew', '--hook'], {
      stdio: ['ignore', 'inherit', 'pipe'],
      timeout: 10000,
    });

    cmd.stderr.on('data', (error: Error) => {
      logError(error);
      resolve();
    });

    cmd.on('error', (error: Error) => {
      logError(error);
      resolve();
    });

    // 'exit' fires whether or not the stream are finished
    cmd.on('exit', () => {
      resolve();
    });

    cmd.on('close', () => {
      resolve();
    });
  });

export default hook;
