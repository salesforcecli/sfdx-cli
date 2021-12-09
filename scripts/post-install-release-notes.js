#!/usr/bin/env node

// const execSync = require('child_process').execSync;
const spawnSync = require('child_process').spawnSync;

if (process.env.SFDX_HIDE_RELEASE_NOTES === 'true') return;

var executable = process.platform === 'win32' ? 'run.cmd' : 'run';

try {
  spawnSync(`${__dirname}/../bin/${executable}`, ['whatsnew', '--hook'], { stdio: 'inherit' });
} catch (e) {
  process.exit(0);
}

// try {
//   execSync(`${__dirname}/../bin/${executable} whatsnew --hook`, { stdio: 'inherit' });
// } catch (e) {
//   process.exit(0);
// }

// var shell = require('shelljs');

// if (process.env.SFDX_HIDE_RELEASE_NOTES === 'true') return;

// try {
//   var executable = process.platform === 'win32' ? 'run.cmd' : 'run';

//   shell.exec(`${__dirname}/../bin/${executable} whatsnew --hook`);
// } catch (err) {
//   shell.exit(0);
// }
