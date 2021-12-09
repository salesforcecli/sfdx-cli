#!/usr/bin/env node

const execSync = require('child_process').execSync;

if (process.env.SFDX_HIDE_RELEASE_NOTES === 'true') return;

var executable = process.platform === 'win32' ? 'run.cmd' : 'run';

try {
  execSync(`${__dirname}/../bin/${executable} whatsnew --hook`, { stdio: 'inherit' });
} catch (e) {
  return;
}
