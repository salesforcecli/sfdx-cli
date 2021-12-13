#!/usr/bin/env node

const { spawn } = require('child_process');

var executable = process.platform === 'win32' ? 'run.cmd' : 'run';

var cmd = spawn(`${__dirname}/../bin/${executable}`, ['whatsnew', '--hook'], {
  stdio: ['ignore', 'inherit', 'ignore'],
});

cmd.on('close', (code) => {
  console.log('Exit Code from close:', code);
  // process.exit(0);
});

cmd.on('exit', (code) => {
  console.log('Exit Code from exit:', code);
  // process.exit(0);
});

// ---------------------------------------

// const execFileSync = require('child_process').execFileSync;

// if (process.env.SFDX_HIDE_RELEASE_NOTES === 'true') return;

// var executable = process.platform === 'win32' ? 'run.cmd' : 'run';

// try {
//   execFileSync(`${__dirname}/../bin/${executable}`, ['whatsnew', '--hook'], { stdio: 'inherit' });
// } catch (e) {
//   console.log('ERROR_CAUGHT');
//   process.exit(0);
//   console.log('AFTER_EXIT');
// }

// ----------------------------------------

// Below would exit correctly, but did not have colored output

// var shell = require('shelljs');

// if (process.env.SFDX_HIDE_RELEASE_NOTES === 'true') return;

// try {
//   var executable = process.platform === 'win32' ? 'run.cmd' : 'run';

//   var cmd = shell.exec(`${__dirname}/../bin/${executable} whatsnew --hook`);

// } catch (err) {
//   shell.exit(0);
// }
