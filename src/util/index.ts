/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Optional } from '@salesforce/ts-types';

export async function sleep(millis: number): Promise<void> {
    // tslint:disable-next-line:no-string-based-set-timeout https://github.com/Microsoft/tslint-microsoft-contrib/issues/355
    await new Promise(resolve => setTimeout(resolve, millis));
}

export function compact<T>(a: Array<Optional<T>>): T[] {
    return a.filter((i): i is T => !!i);
}
