import { Command, InputFlags } from 'cli-engine-command';
import Analytics from '../../analytics';

export default class AnalyticsClear extends Command<InputFlags> {
    public async run(): Promise<void> {
        await new Analytics(this.config).clear();
    }
}
