const path = require('path');
const CLI = require('cli-engine').default;
const root = path.join(__dirname, '..');
const pjson = require(path.join(root, 'package.json'));

module.exports.create = function (version, channel) {
  return new CLI({
    argv: process.argv.slice(1),
    config: {
      root,
      pjson,
      version,
      channel,
      updateDisabled: `update CLI with 'npm update -g ${pjson.name}'`
    }
  });
};
