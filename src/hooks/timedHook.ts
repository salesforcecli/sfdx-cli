import { Hook, Hooks } from '@oclif/config';
import * as Debug from 'debug';

/**
 * Adds debug timing around hook executions.
 *
 * @param name The debugging name of the hook; `sfdx:hook:` is automatically added as a prefix
 * @param hook The hook to wrap with debug timings
 */
export default function timedHook<K extends keyof Hooks>(name: string, hook: Hook<K>) {
    const debug = Debug(`sfdx:hook:${name}`);
    const wrapped: Hook<K> = async function(this: Hook.Context, options) {
        debug('enter');
        try {
            await hook.call(this, options);
        } finally {
            debug('exit');
        }
    };
    return wrapped;
}
