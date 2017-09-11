const path = require("path");
const root = path.join(__dirname, "..");

// Check node version before requiring additional packages
require(path.join(root, "lib", "versions"))
    .checkNodeVersion();

const pjson = require(path.join(root, "package.json"));
require(path.join(root, "lib", "cli"))
    .create(pjson.version, pjson.cli.channel)
    .run();
