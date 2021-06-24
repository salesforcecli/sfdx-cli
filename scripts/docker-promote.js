#!/usr/bin/env node

/**
 * pulls the latest-rc and promotes it to latest
 * You can override the version by passing in VERSION_TO_PROMOTE
 * example: VERSION_TO_PROMOTE=7.100.0 ./scripts/docker-promote.js
 */

const shell = require('shelljs');
const dockerShared = require('./docker-shared');

dockerShared.validateDockerEnv();

const versionToPromote = process.env.VERSION_TO_PROMOTE ?? 'latest-rc';

shell.exec(`docker pull ${dockerShared.repo}:${versionToPromote}-slim`);
shell.exec(`docker tag ${dockerShared.repo}:${versionToPromote}-slim ${dockerShared.repo}:latest-slim`);
shell.exec(`docker push ${dockerShared.repo}:latest-slim`);

shell.exec(`docker pull ${dockerShared.repo}:${versionToPromote}-full`);
shell.exec(`docker tag ${dockerShared.repo}:${versionToPromote}-full ${dockerShared.repo}:latest-full`);
shell.exec(`docker push ${dockerShared.repo}:latest-full`);
