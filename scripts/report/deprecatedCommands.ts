#!/usr/bin/env ./node_modules/.bin/ts-node

import { exec } from 'child_process';
import { promisify } from 'util';
import { compareVersions } from '../../src/versions';

const execAsync = promisify(exec);

// This could use sfdx instead of bin/run
const command: string = 'bin/run force:doc:commands:display --json';

// Only really care about the SFDX first version and above.
const MIN_SUPPORTED_VERSION: string = '38.0';

const numberOfSpaceChar: number = 4;

const versionToCompareWith = process.argv[2];

interface Flag {
  deprecated: {
    version: string;
  };
}

interface Command {
  flags: Flag[];
  deprecated: {
    version: string;
  };
  values: number[];
}

/**
 * Returns true if the deprecated version is less that or equal to the version the user provided.
 * @pvyas version -  deprecated version
 */
function isFilteredDeprecated(version: string) {
  const _version: number = compareVersions(version, versionToCompareWith);
  return _version <= 0;
}

/**
 * Returns a new flags array only containing deprecated flags
 * @pvyas flags List of all flags for a command
 */
function filterCommandFlags(flags: Flag[]): Flag[] {
  if (flags) {
    const newFlags = flags.filter((flag) => {
      return flag.deprecated && isFilteredDeprecated(flag.deprecated.version);
    });
    return newFlags;
  }
}

/**
 * Used to filter the entire list of commands down to only those that are deprecated.
 * @pvyas cliSchema - All the CLI commands.
 */
function filterCommandsAndTopics(cliSchema: Command[]): Command[] {
  const deprecatedCommands = cliSchema.filter((commandOrTopic) => {
    const newFlags: Flag[] = filterCommandFlags(commandOrTopic.flags);
    if (newFlags && newFlags.length > 0) {
      commandOrTopic.flags = newFlags;
      return commandOrTopic;
    } else if (commandOrTopic.deprecated && isFilteredDeprecated(commandOrTopic.deprecated.version)) {
      return commandOrTopic;
    }
  });
  return deprecatedCommands;
}

(async () => {
  try {
    if (!(versionToCompareWith && compareVersions(versionToCompareWith, MIN_SUPPORTED_VERSION) > 0)) {
      console.error(`Please specify a valid version greater than ${MIN_SUPPORTED_VERSION}. ex. 44.0`);
      process.exit(1);
    } else {
      const cmdResult: { stdout: string; stderr: string } = await execAsync(command, { maxBuffer: 1025 * 500 });
      if (cmdResult.stdout) {
        const cliSchema = JSON.parse(cmdResult.stdout).result;
        const deprecatedCommands: Command[] = filterCommandsAndTopics(cliSchema);
        if (deprecatedCommands.length === 0) {
          console.log(`No deprecated command elements found at version ${versionToCompareWith}`);
          process.exit(0);
        } else {
          console.log(JSON.stringify(deprecatedCommands, null, numberOfSpaceChar));
          console.error('Found deprecated commands elements.');
          process.exit(171);
        }
      } else {
        console.error(`ERROR! ${cmdResult.stderr}`);
        process.exit(1);
      }
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
})();
