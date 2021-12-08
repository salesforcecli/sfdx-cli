var shell = require('shelljs');

if (process.env.SFDX_HIDE_RELEASE_NOTES === 'true') return;

try {
  var executable = process.platform === 'win32' ? 'run.cmd' : 'run';

  shell.exec(`${__dirname}/../bin/${executable} whatsnew --hook`);
} catch (err) {
  return;
}
