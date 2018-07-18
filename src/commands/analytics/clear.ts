import { Command } from '@oclif/command';
import Analytics from '../../analytics';

export default class AnalyticsClear extends Command {
    public async run(): Promise<void> {
        await new Analytics(this.config).clear();
    }
}
