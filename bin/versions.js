/**
 * Checks the current Node version for compatibility before launching the CLI.  Uses
 * ES5 syntax to prevent earlier Node versions lacking ES6 syntax support from blowing up
 * with syntax errors before the version check can execute.
 */
module.exports.checkVersion = function () {
  var path = require('path');
  var root = path.join(__dirname, '..');
  var pjson = require(path.join(root, 'package.json'));
  var versions = require('./versions');
  var currentVersion = process.versions.node;
  var requiredVersion = pjson.engines.node.slice(2);

  if (compareVersions(currentVersion, requiredVersion) < 0) {
    console.error(
      'Unsupported Node.js version ' + currentVersion +
      ', version ' + requiredVersion + ' or later is required.'
    );
    process.exit(1);
  }
};

function compareVersions(a, b) {
  var re = /(\.0+)+$/;
  var partsA = a.replace(re, '').split('.');
  var partsB = b.replace(re, '').split('.');
  var len = Math.min(partsA.length, partsB.length);
  var diff;
  for (var i = 0; i < len; i++) {
    diff = (partsA[i] >>> 0) - (partsB[i] >>> 0);
    if (diff) return diff;
  }
  return partsA.length - partsB.length;
}
