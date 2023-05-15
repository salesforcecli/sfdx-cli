const pjson = require('../package.json');
const shelljs = require('shelljs');

const getVersion = () => {
  const sfdxVersion = pjson.version;

  // Get all npm dist-tags for sfdx-cli
  const distTags = JSON.parse(shelljs.exec('npm view sfdx-cli dist-tags --json', { silent: true }).stdout.trim());

  // Find the dist-tag that matches the sfdx-cli package.json version
  const distTag = Object.entries(distTags).find(([, version]) => version === sfdxVersion)[0];

  // Now get the version of @salesforce/cli for the same dist-tag
  let sfVersion = shelljs.exec(`npm view @salesforce/cli@${distTag} version`, { silent: true }).stdout.trim();

  // Make sure that the version of @salesforce/cli does not start with 2
  if (sfVersion.startsWith('2')) {
    // If it does, get the latest version that starts with 1 (we do not want to ever bundle version 2 of @salesforce/cli)
    // We cannot use @salesforce/cli@^1 because that will not get versions higher than what is tagged as "latest"
    const versions = JSON.parse(
      shelljs.exec('npm view @salesforce/cli versions --json', { silent: true }).stdout.trim()
    );
    sfVersion = versions.reverse().find((v) => v.startsWith('1.') && !v.includes('-'));
  }

  // Leave this console.log so that we can pull this value from stdout when running this script from the command line
  console.log(sfVersion);
  return sfVersion;
};

module.exports = { getVersion };
