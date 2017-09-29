import { Config } from 'cli-engine-config';
import timedHook from './timedHook';

function run(config: Config) {
    // TODO: Add analytics submit when moved from force-com-toolbelt
}

export = timedHook('update', run);
