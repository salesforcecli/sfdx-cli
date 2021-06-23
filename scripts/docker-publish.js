#!/usr/bin/env node

const shell = require('shelljs');
shell.set('-e');
shell.set('+v');

// This needs to change when we are ready to publish
const DOCKER_HUB_REPOSITORY = 'salesforce/salesforcedx';

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
const gitStatus = shell.exec(`git status --porcelain`).stdout.trim();
if (gitStatus) {
  shell.echo(
    'You have git changes in the current branch. You should probably not be releasing until you have committed your changes.'
  );
  shell.exit(-1);
}

const SALESFORCE_CLI_VERSION = process.env['SALESFORCE_CLI_VERSION'];
if (!SALESFORCE_CLI_VERSION) {
  shell.echo(
    'You need to specify the version that you want to publish using the SALESFORCE_CLI_VERSION environment variable.'
  );
  shell.exit(-1);
}

const DOCKER_IMAGE_VERSION = process.env['DOCKER_IMAGE_VERSION']
  ? process.env['DOCKER_IMAGE_VERSION']
  : SALESFORCE_CLI_VERSION;

// Checks that a tag of the next version doesn't already exist
const checkTags = shell.exec('git tag', { silent: true }).stdout;
if (checkTags.includes(DOCKER_IMAGE_VERSION)) {
  shell.echo(
    `There is already a git tag called ${DOCKER_IMAGE_VERSION}. You should probably use a new tag since we want to keep tags immutable.`
  );
  process.exit(-1);
}

// Proceed to build using the right CLI version

/* SLIM VERSION */
const slim_dockerBuildExitCode = shell.exec(
  `docker build --file ./dockerfiles/Dockerfile_slim --build-arg SALESFORCE_CLI_VERSION=${SALESFORCE_CLI_VERSION} --tag ${DOCKER_HUB_REPOSITORY}:${DOCKER_IMAGE_VERSION}-slim --no-cache .`
);
/* FULL VERSION */
const full_dockerBuildExitCode = shell.exec(
  `docker build --file ./dockerfiles/Dockerfile_full --build-arg SALESFORCE_CLI_VERSION=${SALESFORCE_CLI_VERSION} --tag ${DOCKER_HUB_REPOSITORY}:${DOCKER_IMAGE_VERSION}-full --no-cache .`
);

// Push to the Docker Hub Registry

/* SLIM VERSION */
const slim_dockerPushExitCode = shell.exec(`docker push ${DOCKER_HUB_REPOSITORY}:${DOCKER_IMAGE_VERSION}-slim`);
/* FULL VERSION */
const full_dockerPushExitCode = shell.exec(`docker push ${DOCKER_HUB_REPOSITORY}:${DOCKER_IMAGE_VERSION}-full`);

// If we are on the main branch, also update the latest tag on Dockerhub
const currentBranch = shell.exec('git rev-parse --abbrev-ref HEAD', {
  silent: true,
}).stdout;
if (/main/.test(currentBranch)) {
  shell.echo('We are on the main branch. Proceeding to also tag latest-slim and latest-full builds');
  shell.exec(`docker tag ${DOCKER_HUB_REPOSITORY}:${SALESFORCE_CLI_VERSION}-slim ${DOCKER_HUB_REPOSITORY}:latest-slim`);
  shell.exec(`docker push ${DOCKER_HUB_REPOSITORY}:latest-slim`);
  shell.exec(`docker tag ${DOCKER_HUB_REPOSITORY}:${SALESFORCE_CLI_VERSION}-full ${DOCKER_HUB_REPOSITORY}:latest-full`);
  shell.exec(`docker push ${DOCKER_HUB_REPOSITORY}:latest-full`);
}

// Create a git tag if we are publishing a specific version
if (!/latest/.test(DOCKER_IMAGE_VERSION)) {
  shell.exec(`echo ${DOCKER_IMAGE_VERSION} > version.txt`);
  shell.exec(`git add version.txt`);
  shell.exec(`git commit -a -m "Publish version: ${DOCKER_IMAGE_VERSION}"`);
  shell.exec(`git push --set-upstream origin ${currentBranch}`);
  shell.exec(`git tag ${DOCKER_IMAGE_VERSION}`);
  shell.exec(`git push --tags`);
}
