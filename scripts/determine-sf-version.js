const pjson = require('../package.json');
const shelljs = require('shelljs');

const getVersion = () => {
  // Now that `sf@2.x` is released, we will only ever bundle sf@legacy
  const sfVersion = shelljs.exec('npm view @salesforce/cli@legacy version --silent', { silent: true }).stdout.trim();

  // Make sure that sfVersion is set and it does not start with 2
  if (!sfVersion) {
    throw new Error('Unable to determine the version of @salesforce/cli@legacy');
  }

  if (sfVersion.startsWith('2')) {
    throw new Error(`@salesforce/cli@legacy version ${sfVersion} starts with 2. Only bundle 1.x versions.`);
  }

  // Leave this console.log so that we can pull this value from stdout when running this script from the command line
  console.log(sfVersion);
  return sfVersion;
};

module.exports = { getVersion };
