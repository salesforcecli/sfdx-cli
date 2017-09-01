const { expect, assert } = require("chai");
const { PreinstallHook } = require("./preinstall-hook");

describe("PreinstallHook", () => {
    it("should allow the salesforcedx plugin versioned 41.x to be installed", () => {
        testHook("41.2.0");
    });

    it("should not allow the salesforcedx plugin versioned 40.x to be installed", () => {
        try {
            testHook("40.9.0");
            assert.fail("Expected exception");
        } catch (err) {
            expect(err.message).to.contain("is not supported");
        }
    });

    function testHook(version) {
        new PreinstallHook(
            (plugin) => {
                return "/foo/bar/salesforcedx/index.js";
            },
            (path) => {
                return {
                    version: version
                };
            },
            (path) => {
                return true;
            }
        ).run({
            config: {version: "6.0.0"},
            plugin: "salesforcedx",
            tag: "alpha"
        });
    }
});
