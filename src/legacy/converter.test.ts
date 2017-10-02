import { expect } from 'chai';
import { convertFromV5, LegacyCommand } from './converter';

describe('legacy converter', () => {
    describe('convertFromV5', () => {
        it('should export a context', async () => {
            let ctx: any = {};
            const lc: LegacyCommand = {
                args: [{name: 'foo'}],
                command: 'bar',
                flags: [{name: 'bar'}],
                init: () => {
                    return Promise.resolve();
                },
                run: (context) => {
                    ctx = context;
                    return Promise.resolve();
                },
                topic: 'foo'
            };

            const V5 = convertFromV5(lc);
            const config = {
                cacheDir: '/Users/foo/.cache/sfdx',
                debug: 1,
                userAgent: 'test'
            };
            const v5 = new V5({config});
            v5.argv = ['run.js', 'topic:command', 'foo', '--bar'];
            await v5.init();
            await v5.run();

            expect(ctx.args).to.deep.equal({foo: 'foo'});
            expect(ctx.config).to.include.keys(config);
            expect(ctx.cwd).to.equal(process.cwd());
            expect(ctx.debug).to.equal(config.debug);
            expect(ctx.flags).to.deep.equal({bar: true});
            expect(ctx.supportsColor).to.equal((v5.out.color as any).enabled);
            expect(ctx.version).to.equal(config.userAgent);
        });
    });
});
