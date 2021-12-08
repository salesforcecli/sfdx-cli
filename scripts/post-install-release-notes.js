var shell = require('shelljs');

shell.set('+v');

try {
  var executable = process.platform === 'win32' ? 'run.cmd' : 'run';

  shell.exec(`node ${__dirname}/../bin/${executable} whatsnew --hook`);
} catch (err) {
  shell.exit(0);
}
