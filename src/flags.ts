export function processCliFlags(process) {
    process.argv = process.argv.filter((arg) => {
        let match = true;
        switch (arg) {
            case '--dev-debug': {
                process.env.DEBUG = '*';
                process.env.SFDX_DEBUG = '1';
                process.env.SFDX_ENV = 'development';
                break;
            }
            case '--x-lazy-load': {
                process.env.SFDX_LAZY_LOAD_MODULES = 'true';
                break;
            }
            case '--x-lazy-load-all': {
                process.env.SFDX_LAZY_LOAD_MODULES = 'true';
                process.env.SFDX_LAZY_LOAD_MODULES_ALL = 'true';
                break;
            }
            case '--x-lazy-load-trace': {
                process.env.SFDX_LAZY_LOAD_MODULES = 'true';
                process.env.SFDX_LAZY_LOAD_MODULES_ALL = 'true';
                process.env.SFDX_LAZY_LOAD_MODULES_TRACE = 'true';
                process.env.DEBUG = process.env.DEBUG || 'sfdx:lazy-modules';
                break;
            }
            case '--x-lazy-load-reset': {
                process.env.SFDX_LAZY_LOAD_MODULES_RESET = 'true';
                break;
            }
            default: {
                match = false;
            }
        }
        return !match;
    });
}
