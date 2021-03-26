#!/usr/bin/env node
/**
 * Script to monitor previously launched just-nuts
 *
 * args:
 *   string representation of a jsoan array that contains the data for each pipeline/workflow to monitor
 *
 */

const got = require('got');
const { isArray } = require('@salesforce/ts-types');
const { sleep, Duration } = require('@salesforce/kit');

const notCompleteStatus = ['running', 'on_hold'];

// circleci
const circleciBaseUrl = 'https://circleci.com/api/v2/';

const orgSlug = (org, repo) => {
  return `github/${org}`;
};
const projectSlug = (org, repo) => {
  return `${orgSlug(org)}/${repo}`;
};

class MonitorPluginNuts {
  pipelineData = {};
  isComplete = false;
  status = 'initial state';
  justNuts = {};
  constructor(pipelineData) {
    this.pipelineData = pipelineData;
  }

  getWorkflowUrl() {
    return `${circleciBaseUrl}pipeline/${this.pipelineData.id}/workflow`;
  }

  getCircleCiUrl() {
    return `https://app.circleci.com/pipelines/${this.justNuts.project_slug}/${this.justNuts.pipeline_number}/workflows/${this.justNuts.id}`;
  }

  async circle(url, options = {}) {
    const defaultOptions = {
      method: 'GET',
      headers: { 'Circle-Token': process.env.CIRCLE_TOKEN, responseType: 'json', resolveBodyOnly: true },
    };
    options = Object.assign(defaultOptions, { ...options });
    try {
      return JSON.parse((await got(url, options)).body);
    } catch (error) {
      console.log(error);
      throw new Error(error && error.response?.body ? error.response.body : error);
    }
  }

  async checkWorkflowState() {
    const url = this.getWorkflowUrl();
    const response = await this.circle(url, {});
    const justNuts = response.items.find((item) => item.name === 'just-nuts');
    if (!justNuts) {
      this.isComplete = true;
      return;
    }
    this.isComplete = notCompleteStatus.some((status) => justNuts.status !== status);
    this.justNuts = justNuts;
  }

  async waitForCompletion() {
    const retries = 30;
    let retryCnt = 0;
    while (!this.isComplete && retryCnt++ <= retries) {
      await sleep(Duration.seconds(5));
      await this.checkWorkflowState();
    }
    if (retryCnt > retries && !this.isComplete) {
      this.status = 'monitor timed out';
    }
  }
  displayWorkflowState() {
    console.log(`Workflow: ${this.justNuts.name} Status: ${this.justNuts.status} URL: ${this.getCircleCiUrl()}`);
  }
}

if (process.argv.length < 3) {
  throw Error('did not receive expected input');
}

let args;
try {
  args = JSON.parse(process.argv[2]);
} catch (error) {
  throw new Error(`error parsing json input ${process.argv[2]}`);
}

if (!isArray(args)) {
  throw new Error('expecting input to be a JSON array');
}

args = [
  {
    org: 'salesforcecli',
    repo: 'data',
    id: 'c1be631e-32ba-4110-bbd5-43d56b50e33a',
    state: 'created',
    number: 0,
    created_at: '2019-08-24T14:15:22Z',
  },
];

const monitors = args.map((arg) => new MonitorPluginNuts(arg));

let rc = 0;

(async () => {
  console.log(`Begin monitoring of ${monitors.length} workflows`);
  await Promise.all(monitors.map(async (monitor) => monitor.waitForCompletion()));
  const exitCode = monitors.some((monitor) => monitor.justNuts?.status !== 'success') ? 1 : 0;
  console.log(
    `End monitoring. Successful workflows ${
      monitors.filter((monitor) => monitor.status === 'success').length
    }. Unsuccessful workflows ${monitors.filter((monitor) => monitor.status !== 'success').length}`
  );
  monitors.forEach((monitor) => monitor.displayWorkflowState());
  process.exit(exitCode);
})();
