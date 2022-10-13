/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'os';
import * as path from 'path';

import { CliUx } from '@oclif/core';
import { readFileSync, readJsonSync, writeFileSync } from 'fs-extra';

import { TelemetryGlobal } from '@salesforce/plugin-telemetry/lib/telemetryGlobal';
import { AppInsights } from '@salesforce/telemetry/lib/appInsights';
import { JsonMap } from '@salesforce/ts-types';
import { Hook } from '@oclif/core';

declare const global: TelemetryGlobal;

function sendEvent(data: JsonMap): void {
  if (global.cliTelemetry?.record) {
    global.cliTelemetry.record(data);
  }
}

function suggestAlternatives(): void {
  CliUx.ux.log('Failed to update sf. Try uninstalling the CLI and re-installing it.');
  CliUx.ux.log(
    'Uninstall instructions: https://developer.salesforce.com/docs/atlas.en-us.234.0.sfdx_setup.meta/sfdx_setup/sfdx_setup_uninstall.htm'
  );
  if (process.platform === 'win32') {
    CliUx.ux.log('- installer: https://developer.salesforce.com/media/salesforce-cli/sf/channels/stable/sf-x64.exe');
  } else if (process.platform === 'darwin') {
    CliUx.ux.log('- installer: https://developer.salesforce.com/media/salesforce-cli/sf/channels/stable/sf.pkg');
  } else {
    CliUx.ux.log(
      '- download: https://developer.salesforce.com/media/salesforce-cli/sf/channels/stable/sf-linux-x64.tar.gz'
    );
  }
}

/**
 * In order to make the bundled version of `sf` available after
 * users run `sfdx update` we've added this hook which will copy
 * the sfdx executable and modify it for `sf`.
 */
// eslint-disable-next-line @typescript-eslint/require-await
const hook: Hook.Update = async function (opts): Promise<void> {
  let success = false;

  CliUx.ux.action.start('sfdx-cli: Updating sf');

  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const pjson = readJsonSync(path.join(__dirname, '../../package.json')) as { oclif: { dirname: string } };

    let dataDirBin;
    let sfdxExec;
    let sfExec;
    if (os.type() === 'Windows_NT') {
      dataDirBin = path.join(process.env.LOCALAPPDATA as string, pjson.oclif.dirname, 'client', 'bin');
      sfdxExec = sfExec = path.join(dataDirBin, 'sfdx.cmd');
      sfExec = path.join(dataDirBin, 'sf.cmd');
    } else {
      dataDirBin = path.join(process.env.HOME as string, '.local', 'share', pjson.oclif.dirname, 'client', 'bin');
      sfdxExec = path.join(dataDirBin, 'sfdx');
      sfExec = path.join(dataDirBin, 'sf');
    }

    const sfExecContents = readFileSync(sfdxExec, { encoding: 'utf-8' }).replace(/sfdx/g, 'sf').replace(/SFDX/g, 'SF');
    writeFileSync(sfExec, sfExecContents, { mode: 0o755 });

    success = true;
  } catch (error) {
    const err = error as Error;
    success = false;
    sendEvent({
      eventName: 'POST_SFDX_UPDATE_SF_UPDATE_ERROR',
      type: 'EVENT',
      message: err.message,
      stackTrace: err?.stack?.replace(new RegExp(os.homedir(), 'g'), AppInsights.GDPR_HIDDEN),
      sfdxVersion: opts.config.version,
    });
    return;
  } finally {
    CliUx.ux.action.stop(success ? 'done' : 'failed');
    if (!success) suggestAlternatives();
  }
};

export default hook;
