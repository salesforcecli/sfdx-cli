const path = require('path');
const root = path.join(__dirname, '..');

// Check node version before requiring additional packages
require(path.join(root, 'dist', 'versions'))
    .checkNodeVersion();

const pjson = require(path.join(root, 'package.json'));
require(path.join(root, 'dist', 'experiments'));
require(path.join(root, 'dist', 'cli'))
    .create(pjson.version, pjson.cli.channel)
    .run();
