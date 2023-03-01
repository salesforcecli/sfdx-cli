/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

const got = require('got');
const fs = require('fs').promises;
const path = require('path');

const { promisify } = require('node:util');
const { exec: execSync } = require('child_process');
const execPromise = promisify(execSync);

(async () => {
  // Get the node version from `process.versions`
  // This matches the default for oclif tarball node versions
  // https://github.com/oclif/oclif/blob/main/src/tarballs/config.ts#L56
  const nodeMajor = process.versions.node.split('.')[0];

  const url = `https://nodejs.org/dist/latest-v${nodeMajor}.x/SHASUMS256.txt`;
  console.log('Retrieving SHA data from:', url);

  const distData = await got(url).text();
  const distRegex = new RegExp(`^([A-z0-9]+)  (node-(v${nodeMajor}.[0-9]+.[0-9]+)-linux-x64.tar.gz)$`, 'm');

  const [, sha, tar, version] = distRegex.exec(distData);

  console.log('Validating checksum...');
  await validateCheckSum(sha, version, tar);
  console.log('Checksum matched.');

  const filepath = path.join(__dirname, '../dockerfiles/Dockerfile_full');
  let oldDockerfile;

  try {
    oldDockerfile = await fs.readFile(filepath, { encoding: 'utf8' });
  } catch (error) {
    throw new Error(`Failed to open '${filepath}' while attempting to update NodeJS version.`, { cause: error });
  }

  const runRegex = new RegExp("^RUN echo '[A-z0-9]+  ./nodejs.tar.gz'[\\s\\S]+ --check node-file-lock.sha$", 'm');

  const runTemplate = `RUN echo '${sha}  ./nodejs.tar.gz' > node-file-lock.sha \\
  && curl -s -o nodejs.tar.gz https://nodejs.org/dist/${version}/${tar} \\
  && shasum --check node-file-lock.sha`;

  const newDockerfile = oldDockerfile.replace(runRegex, runTemplate);

  try {
    await fs.writeFile(filepath, newDockerfile);
  } catch (error) {
    throw new Error(`Updating NodeJS version in '${filepath}' failed`, { cause: error });
  }

  console.log('Dockerfile NodeJS version update complete.');
})();

const validateCheckSum = async (sha, version, tar) => {
  const exec = async (command) => {
    try {
      return await (
        await execPromise(command)
      ).stdout;
    } catch (error) {
      console.log(error.stdout);
      throw new Error(error.message);
    }
  };

  await exec(`curl -s --create-dirs -o tmp/nodejs.tar.gz https://nodejs.org/dist/${version}/${tar}`);
  await exec(`echo "${sha} *tmp/nodejs.tar.gz" | shasum -c`);
};
