
import { Command } from "cli-engine-command";
import Analytics from "../../analytics";

export default class AnalyticsClear extends Command<any> {
    public async run(a: any, b: any, c: any) {
        await new Analytics(this.config).clear();
    }
}
