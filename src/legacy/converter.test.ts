import { expect } from "chai";
import { convertFromV5, LegacyCommand } from "./converter";

describe("legacy converter", () => {
    describe("convertFromV5", () => {
        it("should export a context", async () => {
            let ctx = {};
            const l: LegacyCommand = {
                args: [],
                command: "bar",
                flags: [],
                init: () => {
                    return Promise.resolve();
                },
                run: (context) => {
                    ctx = context;
                    return Promise.resolve();
                },
                topic: "foo",
            };

            const V5 = convertFromV5(l);
            const cmd = new V5({config: {cacheDir: "/Users/foo/.cache/heroku"}});
            cmd.argv = ["run.js", "topic:command"];
            await cmd.init();
            await cmd.run();
            
            // TODO:
            // expect(ctx.supportsColor).toEqual(cmd.out.color.enabled)
            // args,
            // config: this.config,
            // cwd: process.cwd(),
            // debug: this.config.debug,
            // flags,
            // supportsColor: (this.out.color as any).enabled,
            // version: this.config.userAgent,
        });
    });
});
