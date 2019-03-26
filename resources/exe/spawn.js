const join = require('path').join;

const spawn = require(join(__dirname, 'node_modules', 'cross-spawn')).sync;
const result = spawn(join(__dirname, 'sfdx.cmd'), process.argv.slice(2), { stdio: 'inherit' });
process.exitCode = result.status;
