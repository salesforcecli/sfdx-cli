import * as _ from "lodash";

import { NamedError } from "./NamedError";

const CLI_KEY_MARKER = "--";

export default function parseSimpleArgs(cliArgs: string[] | undefined | null) {
    if (cliArgs) {
        return cliArgs.reduce((accum: object, arg: string, currentIndex: number, _array: string[]) => {

            if (arg && (arg === "--help" || arg === "-h")) {
                return _.set(accum, "help", "true");
            }

            if (arg && arg.startsWith(CLI_KEY_MARKER)) {
                const potentialValue = _array[currentIndex + 1];
                const argTrimmed = _.trim(_.split(arg, CLI_KEY_MARKER)[1]);
                // Case where there is no value because it's an "enable" kinda thing, Don"t specify if false.
                if (!potentialValue || potentialValue.startsWith(CLI_KEY_MARKER)) {
                    throw new NamedError("ParameterMissingValue", `The parameter ${arg} is missing it"s value` );
                } else {
                    // otherwise a value was set.
                    return _.set(accum, argTrimmed, _.trim(potentialValue));
                }
            } else {
                return accum;
            }
        }, {});
    }
}
