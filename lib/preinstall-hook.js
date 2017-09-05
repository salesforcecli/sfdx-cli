const path = require("path");
const {compareVersions} = require("./versions");

// All known force namespace plugins
const FORCE_PLUGINS = [
    "salesforcedx",
    "salesforce-alm",
    "force-language-services",
    "lightning-cli"
];

// Minimum plugin version supported y the v6 CLI
const MIN_FORCE_PLUGIN_VERSION = "41.2.0";

module.exports = function (options) {
    new PreinstallHook().run();
};

class PreinstallHook {
    constructor(res = require.resolve, req = require, exists = require("fs").existsSync) {
        this.resolveModule = res;
        this.requireModule = req;
        this.existsSync = exists;
    }

    /**
     * A v6 CLI plugin preinstall hook that checks that the plugin's version is v6-compatible,
     * if it is recognized as a force namespace plugin.
     */
    run({config, plugin, tag}) {
        if (FORCE_PLUGINS.includes(plugin)) {
            const pjson = this._loadPjson(plugin);
            if (compareVersions(pjson.version, MIN_FORCE_PLUGIN_VERSION) < 0) {
                throw new Error(`Plugin version '${pjson.version}' is not supported by SFDX CLI version '${config.version}'.`);
            }
        }
    }

    /**
     * Load plugin's package.json file.
     * 
     * @param {string} plugin Name of the plugin's node module
     * @returns The parsed package.json object
     * @throws If the plugin couldn't be resolved or no package.json was found
     */
    _loadPjson(plugin) {
        let info = this._pjsonInfo(this.resolveModule(plugin));
        while (info.dir && !this.existsSync(info.path)) {
            info = this._pjsonInfo(info.dir);
        }
        if (!info.dir) {
            throw new Error(`Unable to load package.json for plugin '${plugin}'`);
        }
        return this.requireModule(info.path);
    }

    /**
     * Returns a parent dir and possible package.json path for a plugin given a file path.
     * 
     * @param {string} lastPath The path from which to derive the new dir and path info
     * @returns {object} An object containing a parent dir and possible package.json path
     */
    _pjsonInfo(lastPath) {
        let dir = path.dirname(lastPath);
        if (dir === path.dirname(dir)) return {};
        let newPath = path.join(dir, "package.json");
        return {dir, path: newPath};
    }
}

module.exports.PreinstallHook = PreinstallHook;
