import { Config } from 'cli-engine-config';
import timedHook from './timedHook';

function init(config: Config, { argv }: { argv: string[] }) {
}

export = timedHook('init', init);
