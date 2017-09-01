const { expect, assert } = require("chai");
const { compareVersions } = require("./versions");

describe("compareVersions", () => {
    it("should return 0 when args are undefined", () => {
        expect(compareVersions()).to.equal(0);
    });

    it("should return > 0 when a is 1.1.1 and b is undefined", () => {
        expect(compareVersions("1.1.1")).to.be.greaterThan(0);
    });

    it("should return < 0 when a is null and b is 1.1.1", () => {
        expect(compareVersions(null, "1.1.1")).to.be.lessThan(0);
    });

    it("should return 0 when a and b are both 1.1.1", () => {
        expect(compareVersions("1.1.1", "1.1.1")).to.equal(0);
    });

    it("should return < 0 when a is 1.0.1 and b is 1.1.1", () => {
        expect(compareVersions("1.0.1", "1.1.1")).to.be.lessThan(0);
    });

    it("should return > 0 when a is 1.1.1 and b is 1.0.1", () => {
        expect(compareVersions("1.1.1", "1.0.1")).to.be.greaterThan(0);
    });

    it("should return > 0 when a is 2 and b is 1.1.1", () => {
        expect(compareVersions("2", "1.1.1")).to.be.greaterThan(0);
    });

    it("should return > 0 when a is 1.1.1 and b is 2", () => {
        expect(compareVersions("1.1.1", "2")).to.be.lessThan(0);
    });

    it("should ignore dash suffixes", () => {
        expect(compareVersions("1.1.1-2", "2-1.1.1")).to.be.lessThan(0);
    });
});
