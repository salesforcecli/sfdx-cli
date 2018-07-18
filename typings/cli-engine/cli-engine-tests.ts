import { Config } from 'cli-engine-config';
import CLI from 'cli-engine';
import Lock from 'cli-engine/lib/lock';

const config: Config = {};

new CLI({ argv: [], config }).run();

new Lock(config).upgrade();
