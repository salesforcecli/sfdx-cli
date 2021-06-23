const shell = require('shelljs');
shell.set('-e');
shell.set('+v');

const getCliVersion = () => {
  // If not in the env, read the package.json to get the version number we'll use for latest-rc
  const SALESFORCE_CLI_VERSION = process.env['SALESFORCE_CLI_VERSION'] ?? (await fs.readJson('package.json')).version;
  if (!SALESFORCE_CLI_VERSION) {
    shell.echo('No Salesforce CLI version was available.');
    shell.exit(-1);
  }
  shell.echo(`Using Salesforce CLI Version ${SALESFORCE_CLI_VERSION}`);
  return SALESFORCE_CLI_VERSION;
};

const validateDockerEnv = () => {
  // Checks that you have the Docker CLI installed
  if (!shell.which('docker')) {
    shell.echo('You do not have the Docker CLI installed.');
    shell.exit(-1);
  }

  // Checks that you have logged into docker hub
  // Unfortunately I don't think there is a way to check what repositories you have access to
  const AUTH_REGEX = '"https://index.docker.io/v1/"';
  if (!new RegExp(AUTH_REGEX).test(shell.grep(AUTH_REGEX, '~/.docker/config.json').stdout)) {
    shell.echo('You are not logged into Docker Hub. Try `docker login`.');
    shell.exit(-1);
  }

  // Checks that there are no uncommitted changes
  // const gitStatus = shell.exec(`git status --porcelain`).stdout.trim();
  // if (gitStatus) {
  //   shell.echo(
  //     'You have git changes in the current branch. You should probably not be releasing until you have committed your changes.'
  //   );
  //   shell.exit(-1);
  // }
};

module.exports.validateDockerEnv = validateDockerEnv;
module.exports.repo = 'salesforce/salesforcedx';
module.exports.getCliVersion = getCliVersion;
