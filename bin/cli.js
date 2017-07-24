const path = require('path');
const root = path.join(__dirname, '..');
const pjson = require(path.join(root, 'package.json'));
const CLI = require('cli-engine').default;

module.exports = new CLI({
  argv: process.argv.slice(1),
  config: {
    root,
    pjson,
    updateDisabled: `update CLI with 'npm update -g ${pjson.name}'`
  }
});
