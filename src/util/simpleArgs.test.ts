import parseSimpleArgs from "./simpleArgs";
import * as _ from "lodash";
import { expect } from "chai";

console.log(__dirname);

describe("Simple Args Tests", () => {
    it("steel thread", () => {
        const TEST = ["one", "two", "--three", "foo", "--four", "true"];
        const args = parseSimpleArgs(TEST);
        expect(args).to.have.property("three", "foo");
        expect(args).to.have.property("four", "true");
    });

    it("missing value", () => {
        const TEST = ["one", "two", "--three", "foo", "--four"];
        expect(() => parseSimpleArgs(TEST)).to.throw(Error).and.have.property("name", "ParameterMissingValue");
    });

    it("empty array", () => {
        const TEST: string[] = [];
        const args = parseSimpleArgs(TEST);
        expect(_.isEmpty(args)).to.be.equal(true);
    });

    it ("undefined array", () => {
        const TEST = null;
        const args = parseSimpleArgs(TEST);
        expect(args).to.be.equal(undefined);
    });

    it("array without args", () => {
        const TEST = ["one", "two"];
        const args = parseSimpleArgs(TEST);
        expect(_.isEmpty(args)).to.be.equal(true);
    });

    it ("help", () => {
        const TEST = ["-h"];
        const args = parseSimpleArgs(TEST);
        expect(args).to.have.property("help", "true");
    });
});
