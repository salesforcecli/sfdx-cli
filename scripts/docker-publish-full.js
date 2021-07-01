#!/usr/bin/env node

/**
 * This should normally be run without any environment changes and will build, tag, and push 2 docker images for latest-rc
 * Should you ever need to manually run this script, then
 * 1. make sure you've logged into docker from its CLI `docker login`
 * 3. provide the version, example: SALESFORCE_CLI_VERSION=7.100.0 ./scripts/docker-publish
 * 4. you can add NO_PUBLISH=true if you want to only do local builds from the script
 */
const shell = require('shelljs');
const fs = require('fs-extra');
const dockerShared = require('./docker-shared');

shell.set('-e');
shell.set('+v');

const DOCKER_HUB_REPOSITORY = dockerShared.repo;

(async () => {
  dockerShared.validateDockerEnv();
  const SALESFORCE_CLI_VERSION = await dockerShared.getCliVersion();

  shell.exec(
    `docker build --file ./dockerfiles/Dockerfile_full --build-arg SALESFORCE_CLI_VERSION=${SALESFORCE_CLI_VERSION} --tag ${DOCKER_HUB_REPOSITORY}:${SALESFORCE_CLI_VERSION}-full --no-cache .`
  );

  if (process.env.NO_PUBLISH) return;

  // Push to the Docker Hub Registry
  shell.exec(`docker push ${DOCKER_HUB_REPOSITORY}:${SALESFORCE_CLI_VERSION}-full`);

  // This normally defaults to latest-rc.  If you've supplied it in the environment, we're not tagging latest-rc.
  if (process.env['SALESFORCE_CLI_VERSION']) return;

  // tag the newly created version as latest-rc
  shell.exec(
    `docker tag ${DOCKER_HUB_REPOSITORY}:${SALESFORCE_CLI_VERSION}-full ${DOCKER_HUB_REPOSITORY}:latest-rc-full`
  );
  shell.exec(`docker push ${DOCKER_HUB_REPOSITORY}:latest-rc-full`);
})();
