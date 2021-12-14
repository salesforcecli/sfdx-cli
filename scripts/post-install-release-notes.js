#!/usr/bin/env node

const { spawn } = require('child_process');

if (process.env.SFDX_HIDE_RELEASE_NOTES === 'true') process.exit(0);

var executable = process.platform === 'win32' ? 'run.cmd' : 'run';

var cmd = spawn(`${__dirname}/../bin/${executable}`, ['whatsnew', '--hook'], {
  stdio: ['ignore', 'inherit', 'pipe'],
  timeout: 10000,
});

cmd.stderr.on('data', (error) => {
  console.log('NOTE: This error can be ignored in CI and may be silenced in the future');
  console.log(error.toString());
  process.exit(0);
});

// 'exit' fires whether or not the stream are finished
cmd.on('exit', (code) => {
  console.log('Exit Code from exit:', code);
  process.exit(0);
});
