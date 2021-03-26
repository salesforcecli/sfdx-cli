#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const execSync = require('child_process').execSync;
const got = require('got');

const circleciBaseUrl = 'https://circleci.com/api/v2/';

/**
 * Script to locate and launch NUTs across sfdx modules
 *
 * Script requires that the env var CIRCLECI_API_TOKEN is set to a valid CircleCi API Token
 *
 * args:
 *   sfdx-cli version: z.y.z | latest | latest-rc
 *
 * Flow:
 *   load sfdx-cli package.json
 *   For each entry in oclif.plugins
 *     Identify repo organization and project i.e. @salesforce/plugin-auth -> salesforcecli/plugin-auth via "npm show @salesforce/plugin-auth homepage"
 *     Identify if plugin supports script test:nuts i.e. "npm show @salesforce/plugin-auth scripts | grep test:nuts"
 *     Check if org/project is known in circleci
 *       Trigger test nuts workflow for plugin with required parameters
 */

const manualRepoOverrides = {
  'salesforce-alm': {
    org: 'salesforce-cli',
    repo: 'toolbelt',
  },
};

const hasTestNuts = (module) => {
  const results = execSync(`npm show ${module} scripts`);
  return results.includes('test:nuts');
};

const getNpmDependencies = (module) => {
  const results = execSync(`npm show ${module} dependencies --json`);
  return JSON.parse(results);
};

const getOrgAndProject = (module) => {
  const results = execSync(`npm show ${module} homepage`);
  if (Reflect.ownKeys(manualRepoOverrides).includes(module)) {
    return manualRepoOverrides[module];
  }
  const repoUrl = new URL(results.toString().trim());
  const [, org, repo] = repoUrl.pathname.split('/');
  return { org, repo };
};

const orgSlug = (org, repo) => {
  return `github/${org}`;
};
const projectSlug = (org, repo) => {
  return `${orgSlug(org)}/${repo}`;
};

/**
 * Triggers the just-nuts workflow for the named org/repo/branch
 * @param sfdxVersion
 * @param org
 * @param repo
 * @param branch
 * @returns {Promise<*>}
 */
const triggerNutsForProject = async (sfdxVersion, org, repo, branch = 'main') => {
  const body = {
    branch: branch,
    parameters: {
      'run-auto-workflows': false,
      'run-just-nuts': true,
      sfdx_version: sfdxVersion,
    },
  };
  return circle(`${circleciBaseUrl}project/${projectSlug(org, repo)}/pipeline`, { method: 'POST', json: body });
};

/**
 * Triggers the nuts monitoring workflow
 * @param jobData
 * @param branch
 * @returns {Promise<*>}
 */
const triggerNutsMonitor = async (jobData, branch = 'main') => {
  const body = {
    branch: branch,
    parameters: {
      'run-auto-workflows': false,
      'run-just-nuts': true,
      nuts_job_data: JSON.stringify(jobData),
    },
  };
  return circle(`${circleciBaseUrl}project/${projectSlug('salesforcecli', 'sfdx-cli')}/pipeline`, {
    method: 'POST',
    json: body,
  });
};
/**
 * Makes a request to named URL. Ensures that auth token is applied.
 * @param url
 * @param options
 * @returns {Promise<any>}
 */
const circle = async (url, options = {}) => {
  const defaultOptions = {
    method: 'GET',
    headers: { 'Circle-Token': process.env.CIRCLECI_API_TOKEN, responseType: 'json', resolveBodyOnly: true },
  };
  options = { ...defaultOptions, ...options };
  const response = await (async () => {
    try {
      return await got(url, options);
    } catch (error) {
      console.log(error);
      throw new Error(error && error.response?.body ? error.response.body : error);
    }
  })();
  return JSON.parse(response.body);
};

/**
 * Examines a lit of plugins to determine which have NUT tests
 * @param plugins
 * @returns {*}
 */
const qualifyPluginsWithNonUnitTests = (plugins) => {
  return (
    plugins
      // find plugins that may have NUT tests
      .filter((plugin) => plugin === 'salesforcedx' || plugin.startsWith('@salesforce'))
      // handle sub-aggregate plugins by fetching that plugins dependencies
      .map((plugin) => {
        if (plugin === 'salesforcedx') {
          const dxDependencies = Reflect.ownKeys(getNpmDependencies(plugin));
          return dxDependencies;
        } else {
          return plugin;
        }
      })
      // flatten arrays
      .reduce((a, b) => {
        return a.concat(b);
      }, [])
      // find plugins that have a script named 'test:nuts'
      .filter((plugin) => hasTestNuts(plugin))
      // establish github org and repo name
      .map((plugin) => Object.assign({}, { plugin, info: getOrgAndProject(plugin) }))
  );
};

if (process.argv.length < 3) {
  throw Error('did not receive expected input');
}

const sfdxVersion = process.argv[2];

if (/^[0-9]+\.[0-9]+\.[0-9]+?.*|latest(-rc)?/g.test(sfdxVersion)) {
  console.log(`Triggering just-nuts pipelines for sfdx-cli version ${sfdxVersion}`);
} else {
  throw new Error(`Input sfdx-cli version '${sfdxVersion} is mot valid.`);
}

// load package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json')));

// find qualifying plugins
const plugins = qualifyPluginsWithNonUnitTests(packageJson.oclif.plugins);

// kickoff pipelines for just nuts
(async () => {
  let nutPipelinesStarted = [];
  for (const plugin of plugins) {
    console.log(`launching Just NUTs for plugin ${JSON.stringify(plugin)}`);
    const triggerResults = await triggerNutsForProject(sfdxVersion, plugin.org, plugin.repo);
    nutPipelinesStarted.push({ org: plugin.org, repo: plugin.repo, ...triggerResults });
  }
  // if any piplines were started, kickoff monitor
  if (nutPipelinesStarted.length) {
    await triggerNutsMonitor(nutPipelinesStarted);
  }
})();
