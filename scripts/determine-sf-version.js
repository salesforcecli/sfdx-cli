const pjson = require('../package.json');
const shelljs = require('shelljs');

const getVersion = () => {
  const sfdxVersion = pjson.version;

  // Get all npm dist-tags for sfdx-cli
  const distTags = JSON.parse(shelljs.exec('npm view sfdx-cli dist-tags --json', { silent: true }).stdout.trim());

  // Attempt to find a dist-tag that matches the sfdx-cli package.json version
  const distTag = Object.entries(distTags).find(([, version]) => version === sfdxVersion);

  // If we found a dist-tag, get the version of @salesforce/cli for the same dist-tag
  // Note: the --silent flag causes the command to return an empty string if the version is not found
  let sfVersion = distTag?.[0]
    ? shelljs.exec(`npm view @salesforce/cli@${distTag[0]} version --silent`, { silent: true }).stdout.trim()
    : undefined;

  // Make sure that sfVersion is set and it does not start with 2
  if (!sfVersion || sfVersion.startsWith('2')) {
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
