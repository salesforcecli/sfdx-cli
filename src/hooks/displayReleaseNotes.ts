/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { spawn } from 'child_process';
import { Hook } from '@oclif/config';
import { cli } from 'cli-ux';

if (process.env.SFDX_HIDE_RELEASE_NOTES === 'true') process.exit(0);

const hook: Hook.Update = () => {
  const executable = process.platform === 'win32' ? 'run.cmd' : 'run';

  const cmd = spawn(`${__dirname}/../../bin/${executable}`, ['whatsnew', '--hook'], {
    stdio: ['ignore', 'inherit', 'pipe'],
    timeout: 10000,
  });

  cmd.stderr.on('data', (error: Error) => {
    cli.log('NOTE: This error can be ignored in CI and may be silenced in the future');
    cli.log('- Set the SFDX_HIDE_RELEASE_NOTES env var to "true" to skip this script\n');
    cli.log(error.toString());
    process.exit(0);
  });

  // 'exit' fires whether or not the stream are finished
  cmd.on('exit', () => {
    process.exit(0);
  });
};

export default hook;
