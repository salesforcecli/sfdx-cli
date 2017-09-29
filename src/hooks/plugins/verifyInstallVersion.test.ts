import { assert, expect } from "chai";
import hook = require("./verifyInstallVersion");

describe("verifyInstallVersion preinstall hook", () => {
    it("should allow the salesforcedx plugin with tag '41.2.0' to be installed", async () => {
        await testHook("41.2.0");
    });

    it("should allow the salesforcedx plugin with tag 'pre-release' to be installed", async () => {
        await testHook("pre-release");
    });

    it("should not allow the salesforcedx plugin with tag '41.1.0' to be installed", async () => {
        try {
            await testHook("41.1.0");
            assert.fail("Expected exception");
        } catch (err) {
            expect(err.message).to.contain("can only be installed");
        }
    });

    it("should not allow the salesforcedx plugin with tag 'latest' to be installed", async () => {
        try {
            await testHook("41.1.0");
            assert.fail("Expected exception");
        } catch (err) {
            expect(err.message).to.contain("can only be installed");
        }
    });

    async function testHook(tag: string) {
        await hook(
            { version: "6.0.0" },
            { plugin: "salesforcedx", tag },
        );
    }
});
