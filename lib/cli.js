const path = require('path');
const CLI = require('cli-engine').default;
const root = path.join(__dirname, '..');
const pjson = require(path.join(root, 'package.json'));

module.exports.create = function (version, channel) {
    const argv = process.argv.slice(1);
    const config = {
        root,
        pjson,
        version,
        channel
    };
    if (process.env.SFDX_AUTOUPDATE_DISABLE === "true") {
        config.updateDisabled =
            // The install method should have provided a message on how to update when disabled
            updateDisabledMessage ||
            // Fallback in case no message is available, but in theory this will not happen
            `A newer version is available, but CLI updates have been disabled by setting "SFDX_AUTOUPDATE_DISABLE=true"`;
    }
    return new CLI({argv, config});
};
