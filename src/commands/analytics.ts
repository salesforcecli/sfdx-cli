import { Command } from '@oclif/command';
import Analytics from '../analytics';

export default class AnalyticsGet extends Command {
    public async run(): Promise<void> {
        this.log(JSON.stringify(await new Analytics(this.config).readJSON()));
    }
}
