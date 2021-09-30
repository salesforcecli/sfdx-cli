#!/usr/bin/env node

const path = require('path');
const shelljs = require('shelljs');
const fs = require('fs');

try {
  const sfGlobalPath = path.join(shelljs.exec('npm list -g --depth 0 | head -1').stdout, 'node_modules', '@salesforce', 'cli');

  // Copy sf to the bin/cli dir of sfdx
  shelljs.mv('-f', sfGlobalPath, path.join(process.cwd(), 'bin', 'sf-cli'));
} catch (e) {
  console.error('Error: can\'t find the global sf install.')  
  throw e;
}

const sfUnixPath = 'bin/sf-cli/bin/run';
const sfBin = path.join('bin', 'sf');
const sfdxBin = path.join('bin', 'sfdx');

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

const sfWinPath = 'bin\\sf-cli\\bin\\run';
const sfCmd = path.join('bin', 'sf.cmd');
const sfdxCmd = path.join('bin', 'sfdx.cmd');

console.log(`  Updating ${sfCmd} with references to sf`);
const cmdContents = fs
  .readFileSync(sfdxCmd, 'UTF-8')
  .replace(/sfdx/g, 'sf')
  .replace(/SFDX/g, 'SF')
  .replace(/bin\\run/g, sfWinPath);

console.log(`  Writing ${sfCmd}`);
fs.writeFileSync(sfCmd, cmdContents);

console.log(`---- Finished ----`);
