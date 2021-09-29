#!/usr/bin/env node

const path = require('path');
const shelljs = require('shelljs');
const fs = require('fs');

const sfUnixPath = 'node_modules/@salesforce/cli/bin/run';
const sfBin = path.join('bin', 'sf');
const sfdxBin = path.join('bin', 'sfdx');

const sfWinPath = 'node_modules\\@salesforce\\cli\\bin\\run';
const sfCmd = path.join('bin', 'sf.cmd');
const sfdxCmd = path.join('bin', 'sfdx.cmd');

console.log(`---- Including SF ----`);
console.log(`  Updating ${sfdxBin} with references to sf`);
const binContents = fs
  .readFileSync(sfdxBin, 'UTF-8')
  .replace(/sfdx/g, 'sf')
  .replace(/SFDX/g, 'SF')
  .replace(/\$DIR\/run/g, `$(dirname $DIR)/${sfUnixPath}`);

console.log(`  Writing ${sfBin}`);
fs.writeFileSync(sfBin, binContents);
shelljs.chmod('+x', sfBin);

console.log(`  Updating ${sfCmd} with references to sf`);
const cmdContents = fs
  .readFileSync(sfdxCmd, 'UTF-8')
  .replace(/sfdx/g, 'sf')
  .replace(/SFDX/g, 'SF')
  .replace(/bin\\run/g, sfWinPath);

console.log(`  Writing ${sfCmd}`);
fs.writeFileSync(sfCmd, cmdContents);

console.log(`---- Finished ----`);
