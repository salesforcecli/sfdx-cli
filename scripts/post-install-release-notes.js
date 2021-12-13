#!/usr/bin/env node

const execSync = require('child_process').execSync;

if (process.env.SFDX_HIDE_RELEASE_NOTES === 'true') return;

var executable = process.platform === 'win32' ? 'run.cmd' : 'run';

try {
  execSync(`${__dirname}/../bin/${executable} whatsnew --hook`, { stdio: 'inherit' });
} catch (e) {
  console.log('ERROR_CAUGHT');
  process.exit(0);
  console.log('AFTER_EXIT');
}

// Below would exit correctly, but did not have colored output

// var shell = require('shelljs');

// if (process.env.SFDX_HIDE_RELEASE_NOTES === 'true') return;

// try {
//   var executable = process.platform === 'win32' ? 'run.cmd' : 'run';

//   shell.exec(`${__dirname}/../bin/${executable} whatsnew --hook`);
// } catch (err) {
//   shell.exit(0);
// }
