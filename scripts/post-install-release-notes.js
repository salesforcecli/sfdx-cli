#!/usr/bin/env node

var shell = require('shelljs');

if (!shell.which('sfdx')) {
  shell.exit(0);
}

shell.exec('sfdx whatsnew --hook');
