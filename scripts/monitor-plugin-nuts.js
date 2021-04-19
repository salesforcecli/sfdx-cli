#!/usr/bin/env node
/**
 * Script to monitor previously launched just-nuts
 *
 * Script requires that the env var CIRCLECI_API_TOKEN is set to a valid CircleCi API Token
 *
 * Wait duration for pipeline completion can be controlled by env var NUTS_WAIT_TIME.
 * The wait time is expressed in seconds and defaults to 900
 *
 * The script also considers the env var NUTS_COMPLETION_RETRY_CNT (default 30), which is the number of times the
 * will check the status of a pipeline.
 *
 * The interval between checks is determined by dividing NUTS_WAIT_TIME by NUTS_COMPLETION_RETRY_CNT.
 *
 * Using default values for wait and retry, the interval is 900/30 or 30 seconds.
 *
 * args:
 *   string representation of a jsoan array that contains the data for each pipeline/workflow to monitor
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

/**
 * MonitorPluginNuts is responsible for monitoring the progress of the supplied
 * circleci pipeline until completion or the job runtime exceeds wait time
 */
class MonitorPluginNuts {
  pipelineData = {};
  isComplete = false;
  status = 'initial state';
  justNuts = {};
  nutsWaitInterval;
  nutsCompletionRetryCnt;
  constructor(pipelineData) {
    this.pipelineData = pipelineData;
    this.nutsCompletionRetryCnt = parseInt(process.env.NUTS_COMPLETION_RETRY_CNT ?? '30');
    const totalWaitTime = parseInt(process.env.NUTS_WAIT_TIME ?? '900');
    if (!(this.nutsCompletionRetryCnt <= totalWaitTime)) {
      throw new Error(
        `NUTS_WAIT_TIME ${totalWaitTime} must be greater than retry count ${this.nutsCompletionRetryCnt}`
      );
    }
    this.nutsWaitInterval = Math.floor(parseInt(process.env.NUTS_WAIT_TIME ?? 900) / this.nutsCompletionRetryCnt);
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
      throw new Error(error && error.response?.body ? error.response.body : error);
    }
  }

  async checkWorkflowState() {
    const url = this.getWorkflowUrl();
      const response = await this.circle(url, {});
      const justNuts = response.items.find((item) => item.name === 'just-nuts');
      // could not find 'just-nuts' in the workflow - stop monitoring the job
      if (!justNuts) {
        this.isComplete = true;
        this.status = 'success';
        return;
      }
      this.isComplete = !notCompleteStatus.some((status) => justNuts.status === status);
      this.justNuts = justNuts;
  }

  async waitForCompletion() {
    try {
      let retryCnt = 0;
      while (!this.isComplete && retryCnt++ <= this.nutsCompletionRetryCnt) {
        await sleep(Duration.seconds(this.nutsWaitInterval));
        await this.checkWorkflowState();
        // display workflow state to give feedback that something is actually happening
        this.displayWorkflowState();
      }
      if (retryCnt > retries && !this.isComplete) {
        this.status = 'monitor timed out';
        this.isComplete = true;
      }
    } catch(error) {
      this.status = `exception occured while monitor job ${error}`;
      this.isComplete = true;
    }
  }
  displayWorkflowState() {
    console.log(`Workflow: ${this.justNuts.name} Status: ${this.justNuts.status ?? this.status} URL: ${this.getCircleCiUrl()}`);
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

const monitors = args.map((arg) => new MonitorPluginNuts(arg));

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
