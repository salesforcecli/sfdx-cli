/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { join } from 'path';
import { spawn } from 'child_process';
import { Hook } from '@oclif/config';
import { cli } from 'cli-ux';

if (process.env.SFDX_HIDE_RELEASE_NOTES === 'true') process.exit(0);

const logAndExit = (msg: Error): void => {
  cli.log('NOTE: This error can be ignored in CI and may be silenced in the future');
  cli.log('- Set the SFDX_HIDE_RELEASE_NOTES env var to "true" to skip this script\n');
  cli.log(msg.toString());

  process.exit(0);
};

/*
 * NOTE: Please read "Notes about the hook scripts" in this PR before making changes:
 * https://github.com/salesforcecli/sfdx-cli/pull/407
 */

const hook: Hook.Update = () => {
  // NOTE: This is `sfdx.cmd` here and not `run.cmd` because it gets renamed here:
  // https://github.com/salesforcecli/sfdx-cli/blob/4428505ab69aa6e21214dba96557e2ce396a82e0/src/hooks/postupdate.ts#L62
  const executable = process.platform === 'win32' ? 'sfdx.cmd' : 'run';

  const cmd = spawn(join(__dirname, '..', '..', 'bin', executable), ['whatsnew', '--hook'], {
    stdio: ['ignore', 'inherit', 'pipe'],
    timeout: 10000,
  });

  cmd.stderr.on('data', (error: Error) => {
    logAndExit(error);
  });

  cmd.on('error', (error: Error) => {
    logAndExit(error);
  });

  // 'exit' fires whether or not the stream are finished
  cmd.on('exit', () => {
    process.exit(0);
  });
};

export default hook;
