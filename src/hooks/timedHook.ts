import * as Debug from 'debug';

/**
 * Adds debug timing around hook executions.
 *
 * @param name The debugging name of the hook; `sfdx:hook:` is automatically added as a prefix
 * @param hook The hook to wrap with debug timings
 */
export default function timedHook(name: string, hook: (...args: any[]) => any) {
    const debug = Debug(`sfdx:hook:${name}`);
    return async (...args: any[]) => {
        debug('enter');
        try {
            return await hook(...args);
        } finally {
            debug('exit');
        }
    };
}
