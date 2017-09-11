import { expect, assert } from "chai";
import hook = require("./preinstall");

describe("plugins:preinstall hook", () => {
    it("should allow the salesforcedx plugin with tag '41.2.0' to be installed", () => {
        testHook("41.2.0");
    });

    it("should not allow the salesforcedx plugin with tag '41.1.0' to be installed", () => {
        try {
            testHook("41.1.0");
            assert.fail("Expected exception");
        } catch (err) {
            expect(err.message).to.contain("can only be installed");
        }
    });

    it("should not allow the salesforcedx plugin with tag 'latest' to be installed", () => {
        try {
            testHook("41.1.0");
            assert.fail("Expected exception");
        } catch (err) {
            expect(err.message).to.contain("can only be installed");
        }
    });

    function testHook(tag) {
        hook(
            {version: "6.0.0"},
            {plugin: "salesforcedx", tag: tag}
        );
    }
});
