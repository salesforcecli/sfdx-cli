import { Arg, Command, Flag, flags as Flags, InputFlags } from "cli-engine-command";
import { Config } from "cli-engine-config";
import * as vars from "cli-engine-heroku/lib/vars";

export interface LegacyContext {
    supportsColor: boolean;
}

export interface LegacyFlag {
    [key: string]: any;
    name: string;
    description?: string;
    char?: string;
    hasValue?: boolean;
    hidden?: boolean;
    required?: boolean;
    optional?: boolean;
    parse?: any;
}

export interface LegacyCommand {
    topic: string;
    command?: string | null;
    aliases?: string[];
    variableArgs?: boolean;
    args: Arg[];
    flags: LegacyFlag[];
    description?: string | null;
    help?: string | null;
    usage?: string | null;
    hidden?: boolean | null;
    default?: boolean | null;
    init: () => Promise<any>;
    needsApp?: boolean | null;
    needsAuth?: boolean | null;
    needsOrg?: boolean | null;
    wantsApp?: boolean | null;
    wantsOrg?: boolean | null;
    supportsColor?: boolean | null;

    run: (ctx: LegacyContext) => Promise<any>;
}

export function convertFromV5(c: LegacyCommand) {
    class V5 extends Command<InputFlags> {
        public static topic = c.topic;
        public static command = c.command || "";
        public static description = c.description || "";
        public static hidden = !!c.hidden;
        public static args = c.args || [];
        public static flags = convertFlagsFromV5(c.flags);
        public static variableArgs = !!c.variableArgs;
        public static help = c.help || "";
        public static usage = c.usage || "";
        public static aliases = c.aliases || [];

        public static buildHelp(config: Config): string {
            const help = super.buildHelp(config);
            // Strip the possibly ANSI-colored "[flags]" suffix cli-engine appends to usage strings
            return help.replace(/(?:\u001b\[[0-9]+m)?\[flags\](?:\u001b\[[0-9]+m)/, "");
        }

        public async run() {
            const flags: any = this.flags;
            const ctx: any = {
                apiHost: vars.default.apiHost,
                apiToken: "",
                apiUrl: vars.default.apiUrl,
                app: flags.app,
                args: c.variableArgs ? this.argv : this.args,
                auth: {},
                config: this.config,
                cwd: process.cwd(),
                debug: this.config.debug,
                flags,
                gitHost: vars.default.gitHost,
                herokuDir: this.config.cacheDir,
                httpGitHost: vars.default.httpGitHost,
                org: flags.org,
                supportsColor: (this.out.color as any).enabled,
                team: flags.team,
                version: this.config.userAgent,
            };
            const ansi = require("ansi-escapes");
            process.once("exit", () => {
                if (process.stderr.isTTY) {
                    process.stderr.write(ansi.cursorShow);
                }
            });
            return c.run(ctx);
        }
    }

    if (c.needsApp || c.wantsApp) {
        V5.flags.app = (Flags as any).app({ required: !!c.needsApp });
        V5.flags.remote = (Flags as any).remote();
    }
    if (c.needsOrg || c.wantsOrg) {
        const opts = { required: !!c.needsOrg, hidden: false, description: "organization to use" };
        V5.flags.org = (Flags as any).org(opts);
    }

    return V5;
}

function convertFlagsFromV5(flags: (LegacyFlag[] | { [name: string]: Flag<any> }) | null): { [name: string]: any } {
    if (!flags) {
        return {};
    }
    if (!Array.isArray(flags)) {
        return flags;
    }
    return flags.reduce((converted: { [name: string]: any }, flag) => {
        const opts: Flag<any> = {
            char: flag.char as any,
            description: flag.description,
            hidden: flag.hidden,
            optional: flag.optional,
            parse: flag.parse,
            required: flag.required,
        };
        Object.keys(opts).forEach((k) => opts[k] === undefined && delete opts[k]);
        converted[flag.name] = flag.hasValue ? Flags.string(opts) : Flags.boolean(opts as any);
        return converted;
    }, {});
}
