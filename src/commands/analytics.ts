
import { Command } from 'cli-engine-command';
import Analytics from '../analytics';

export default class AnalyticsGet extends Command<any> {
    public async run(a: any, b: any, c: any) {
        this.out.log(await new Analytics(this.config).readJSON());
    }
}
