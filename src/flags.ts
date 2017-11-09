export function processCliFlags(process) {
    process.argv = process.argv.filter((arg) => {
        let match = true;
        switch (arg) {
            case '--dev-debug': {
                process.env.DEBUG = '*';
                process.env.SFDX_DEBUG = '1';
                break;
            }
            case '--exp-lazy-load': {
                process.env.SFDX_LAZY_LOAD_MODULES = 'true';
                break;
            }
            case '--exp-lazy-load-trace': {
                process.env.SFDX_LAZY_LOAD_MODULES = 'true';
                process.env.SFDX_LAZY_LOAD_MODULES_TRACE = 'true';
                process.env.DEBUG = process.env.DEBUG || 'sfdx:lazy-modules';
                break;
            }
            default: {
                match = false;
            }
        }
        return !match;
    });
}
