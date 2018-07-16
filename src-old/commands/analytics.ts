import { Command, InputFlags } from 'cli-engine-command';
import Analytics from '../analytics';

export default class AnalyticsGet extends Command<InputFlags> {
    public async run(): Promise<void> {
        this.out.log(JSON.stringify(await new Analytics(this.config).readJSON()));
    }
}
