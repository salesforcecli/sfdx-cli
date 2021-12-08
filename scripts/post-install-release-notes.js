var shell = require('shelljs');

shell.set('+v');

if (!shell.which('sfdx')) {
  shell.exit(0);
}

shell.exec('sfdx whatsnew --hook');
