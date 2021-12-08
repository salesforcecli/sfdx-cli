var shell = require('shelljs');

try {
  var executable = process.platform === 'win32' ? 'run.cmd' : 'run';

  shell.exec(`${__dirname}/../bin/${executable} whatsnew --hook`);
} catch (err) {
  shell.exit(0);
}
