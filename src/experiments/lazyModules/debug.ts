import env from '../../util/env';
import Debug = require('debug');

const doTrace = env.getBoolean('SFDX_LAZY_LOAD_MODULES') && env.getBoolean('SFDX_LAZY_LOAD_MODULES_TRACE');

export const debug = Debug('sfdx:lazy-modules');
export const trace = doTrace ? debug : (...args) => {};
