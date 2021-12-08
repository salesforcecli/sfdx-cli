var shell = require('shelljs');

shell.set('+v');

try {
  if (process.platform === 'win32') {
    shell.exec('./bin/run.cmd whatsnew --hook');
  } else {
    shell.exec('./bin/run whatsnew --hook');
  }
} catch (err) {
  shell.exit(0);
}
