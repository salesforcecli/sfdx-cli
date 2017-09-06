/**
 * Compares two semantic version strings.
 * 
 * @param {string} a The first version
 * @param {string} b The second version
 * @returns {number} < 0 if a < b, 0 if a == b, > 0 if a > b
 */
function compareVersions(a, b) {
    a = a || "0";
    b = b || "0";
    var ignore = /-.*$/;
    var partsA = a.replace(ignore, '').split('.');
    var partsB = b.replace(ignore, '').split('.');
    var len = Math.min(partsA.length, partsB.length);
    var diff;
    for (var i = 0; i < len; i++) {
        diff = (partsA[i] >>> 0) - (partsB[i] >>> 0);
        if (diff) return diff;
    }
    return partsA.length - partsB.length;
}

module.exports.compareVersions = compareVersions;

/**
 * Checks the current Node version for compatibility before launching the CLI.  Uses
 * ES5 syntax to prevent earlier Node versions lacking ES6 syntax support from blowing up
 * with syntax errors before the version check can execute.
 */
function checkNodeVersion() {
    var path = require('path');
    var root = path.join(__dirname, '..');
    var pjson = require(path.join(root, 'package.json'));
    var currentVersion = process.versions.node;
    var requiredVersion = pjson.engines.node.slice(2); // chop '>=' prefix

    if (compareVersions(currentVersion, requiredVersion) < 0) {
        console.error(
            'Unsupported Node.js version ' + currentVersion +
            ', version ' + requiredVersion + ' or later is required.'
        );
        process.exit(1);
    }
};

module.exports.checkNodeVersion = checkNodeVersion;
