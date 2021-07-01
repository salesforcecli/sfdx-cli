#!/usr/bin/env node

/**
 * This should normally be run without any environment changes and will build, tag, and push 2 docker images for latest-rc
 * Should you ever need to manually run this script, then
 * 1. make sure you've logged into docker from its CLI `docker login`
 * 3. provide the version, example: SALESFORCE_CLI_VERSION=7.100.0 ./scripts/docker-publish
 * 4. you can add NO_PUBLISH=true if you want to only do local builds from the script
 */
const shell = require('shelljs');
const got = require('got');
const dockerShared = require('./docker-shared');

shell.set('-e');
shell.set('+v');

const DOCKER_HUB_REPOSITORY = dockerShared.repo;

// look in the versions file, and if not, try the latest-rc buildmanifest (which doesn't hit the versions file until it's promoted to latest)
const getDownloadUrl = async (version) => {
  let { body } = await got(
    'https://developer.salesforce.com/media/salesforce-cli/sfdx/versions/sfdx-linux-x64-tar-xz.json',
    { responseType: 'json' }
  );
  if (body[version]) {
    console.log(`Found download URL ${body[version]} in versions file`);
    return body[version];
  }

  let rcResponse = await got(
    'https://developer.salesforce.com/media/salesforce-cli/sfdx/channels/stable-rc/sfdx-linux-x64-buildmanifest',
    { responseType: 'json' }
  );
  if (rcResponse.body.version === version && rcResponse.body.xz) {
    console.log(`Found download URL ${rcResponse.body.xz} in latest-rc build manifest`);
    return rcResponse.body.xz;
  }
  throw new Error(`could not find version ${version}`);
};

(async () => {
  dockerShared.validateDockerEnv();

  // If not in the env, read the package.json to get the version number we'll use for latest-rc
  const SALESFORCE_CLI_VERSION = await dockerShared.getCliVersion();
  const CLI_DOWNLOAD_URL = await getDownloadUrl(SALESFORCE_CLI_VERSION);

  // build from local dockerfiles
  shell.exec(
    `docker build --file ./dockerfiles/Dockerfile_slim --build-arg DOWNLOAD_URL=${CLI_DOWNLOAD_URL} --tag ${DOCKER_HUB_REPOSITORY}:${SALESFORCE_CLI_VERSION}-slim --no-cache .`
  );

  if (process.env.NO_PUBLISH) return;
  // Push to the Docker Hub Registry
  shell.exec(`docker push ${DOCKER_HUB_REPOSITORY}:${SALESFORCE_CLI_VERSION}-slim`);

  // This normally defaults to latest-rc.  If you've supplied it in the environment, we're not tagging latest-rc.
  if (process.env['SALESFORCE_CLI_VERSION']) return;
  // tag the newly created version as latest-rc
  shell.exec(
    `docker tag ${DOCKER_HUB_REPOSITORY}:${SALESFORCE_CLI_VERSION}-slim ${DOCKER_HUB_REPOSITORY}:latest-rc-slim`
  );
  shell.exec(`docker push ${DOCKER_HUB_REPOSITORY}:latest-rc-slim`);
})();
