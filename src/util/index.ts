export async function sleep(millis: number): Promise<void> {
    // tslint:disable-next-line:no-string-based-set-timeout https://github.com/Microsoft/tslint-microsoft-contrib/issues/355
    await new Promise(resolve => setTimeout(resolve, millis));
}
