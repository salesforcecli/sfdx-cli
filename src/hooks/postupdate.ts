/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as os from 'os';
import * as path from 'path';
import { exec, which } from 'shelljs';
import { TelemetryGlobal } from '@salesforce/plugin-telemetry/lib/telemetryGlobal';
import { AppInsights } from '@salesforce/telemetry/lib/appInsights';
import { JsonMap } from '@salesforce/ts-types';
import { cli } from 'cli-ux';

declare const global: TelemetryGlobal;

function sendEvent(data: JsonMap): void {
  if (global.cliTelemetry && global.cliTelemetry.record) {
    global.cliTelemetry.record(data);
  }
}

function suggestAlternatives(): void {
  cli.log('Failed to install sf. Try one of the following:');
  cli.log('- npm: npm install @salesforce/cli --global');
  if (process.platform === 'win32') {
    cli.log('- installer: https://developer.salesforce.com/media/salesforce-cli/sf/channels/stable/sf-x64.exe');
  } else if (process.platform === 'darwin') {
    cli.log('- installer: https://developer.salesforce.com/media/salesforce-cli/sf/channels/stable/sf.pkg');
  } else {
    cli.log('- download: https://developer.salesforce.com/media/salesforce-cli/sf/channels/stable/sf-linux-x64.tar.gz');
  }
}

/**
 * Return true if any part of the sf executable path contains a string that is known
 * to be part of an npm path.
 */
function isNpmInstall(sfPath: string): boolean {
  const nodePathParts = ['node', 'nodejs', '.nvm', '.asdf', 'node_modules', 'npm', '.npm'];
  const sfPathParts = sfPath.split(path.sep);
  return sfPathParts.filter((p) => nodePathParts.includes(p)).length > 0;
}

/**
 * We want to skip the sf installation if there's an existing installation that is NOT
 * from npm. In other words, if the user has already installed sf with the installer,
 * we do not want to overwrite it.
 */
function isBinaryInstall(): boolean {
  const existingSf = which('sf')?.stdout;
  if (existingSf) return !isNpmInstall(existingSf);
  return false;
}

/**
 * In order to install sf for users who use the installers, we've added
 * this hook which will install sf via npm after sfdx update completes.
 *
 * This is not a sufficient solution as there are likely many users who
 * do not have npm installed on their machine. For this reason, we are
 * logging that information to app insights so that we decide which solutions
 * we need to build next to ensure sf is available to all sfdx users.
 *
 */
// eslint-disable-next-line @typescript-eslint/require-await
const hook = async function (): Promise<void> {
  let succcess = false;

  const sfdxVersion = exec('sfdx --version', { silent: true })?.stdout || 'unknown';

  // Skip the install if there's an existing sf that was installed by an installer
  if (isBinaryInstall()) {
    succcess = true;
    return;
  }

  cli.action.start('sfdx-cli: Installing sf');

  try {
    const npmInstallation = which('npm')?.stdout;
    if (!npmInstallation) {
      sendEvent({
        eventName: 'POST_SFDX_UPDATE_SF_INSTALL_ERROR',
        type: 'EVENT',
        message: 'npm not installed on machine',
        sfdxVersion,
      });
      return;
    }

    const installResult = exec('npm install -g @salesforce/cli', { silent: true });
    if (installResult.code > 0) {
      sendEvent({
        eventName: 'POST_SFDX_UPDATE_SF_INSTALL_ERROR',
        type: 'EVENT',
        message: 'npm global install failed',
        stackTrace: installResult.stderr?.replace(new RegExp(os.homedir(), 'g'), AppInsights.GDPR_HIDDEN),
        sfdxVersion,
      });
      return;
    }

    succcess = true;
    const sfVersion = exec('sf --version', { silent: true }).stdout;
    sendEvent({
      eventName: 'POST_SFDX_UPDATE_SF_INSTALL_SUCCESS',
      type: 'EVENT',
      message: 'sf install succeeded',
      sfVersion,
      sfdxVersion,
    });
  } catch (error) {
    const err = error as Error;
    succcess = false;
    sendEvent({
      eventName: 'POST_SFDX_UPDATE_SF_INSTALL_ERROR',
      type: 'EVENT',
      message: err.message,
      stackTrace: err?.stack?.replace(new RegExp(os.homedir(), 'g'), AppInsights.GDPR_HIDDEN),
      sfdxVersion,
    });
    return;
  } finally {
    cli.action.stop(succcess ? 'done' : 'failed');
    if (!succcess) suggestAlternatives();
  }
};

export default hook;
