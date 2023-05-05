const { execSync } = require('child_process');

(() => {
  const testCliNotVersion = (cli, version) => {
    try {
      return execSync(`${cli} --version`).toString('utf-8').includes(version);
    } catch (e) {
      // if cli isn't installed it'll throw, but that's ok for us
      return false;
    }
  };
  // test sf v2 is not installed
  if (testCliNotVersion('sf', '@salesforce/cli/2.')) {
    throw Error('Unable to install sfdx-cli with @salesforce/cli version 2 installed.');
  }
})();
