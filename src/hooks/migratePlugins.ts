/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Hook, IConfig } from '@oclif/config';
import { AnyJson, definiteEntriesOf, Dictionary, JsonMap } from '@salesforce/ts-types';
import chalk from 'chalk';
import { cli } from 'cli-ux';
import * as Debug from 'debug';
import * as nodeFs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const debug = Debug('sfdx:preupdate:migrate:plugins');

export type FsLib = Pick<typeof nodeFs,
    'access'
  | 'lstat'
  | 'readdir'
  | 'readFile'
  | 'rename'
  | 'rmdir'
  | 'unlink'
  | 'writeFile'
>;

interface V6PackageJson extends JsonMap {
  private: 'true';
  dependencies: Dictionary<string>;
}

interface V7PackageJson extends V6PackageJson {
  oclif: OclifConfig;
}

interface OclifConfig extends JsonMap {
  schema: number;
  plugins: OclifPlugin[];
}

export interface OclifPlugin extends JsonMap {
  name: string;
  tag: string;
  type: string;
}

export type MigratePluginsHookContext = Hook.Context & { fs: FsLib };

// Extend Hook.Preupdate to add fs utility
export type MigratePluginsHook = (this: MigratePluginsHookContext, options: {
  channel: string;
} & {
  config: IConfig;
}) => Promise<void>;

const hook: MigratePluginsHook = async function(options) {
  const fs = this.fs || nodeFs;

  try {
    const v6Dir = path.join(options.config.dataDir, 'plugins');
    const v6Path = path.join(v6Dir, 'package.json');
    if (!(await pathExists(fs, v6Path))) {
      debug('no plugins needing migration found');
      return;
    }

    const v7Dir = options.config.dataDir;
    const v7Path = path.join(v7Dir, 'package.json');
    if (await pathExists(fs, v7Path)) {
      debug('v7 config found, removing obsolete v6 config');
      await remove(fs, v6Path);
      return;
    }

    const v6PackageJson = await readJsonMap<V6PackageJson>(fs, v6Path);
    debug('migrating v6 plugins: %j', v6PackageJson.dependencies);
    cli.action.start('Migrating plugins');

    const v7PackageJson: V7PackageJson = {
      private: 'true',
      oclif: {
        schema: 1,
        plugins: []
      },
      dependencies: {}
    };

    for (const [name, tag] of definiteEntriesOf(v6PackageJson.dependencies)) {
      const pjsonPath = path.join(v6Dir, 'node_modules', name, 'package.json');
      try {
        if (!(await pathExists(fs, pjsonPath))) {
          throw new Error(`Plugin ${name}@${tag} not found and could not be migrated`);
        }
        const pjson = await readJsonMap(fs, pjsonPath);
        if (!pjson.version) {
          throw new Error(`Plugin ${name}@${tag} lacks a version and could not be migrated`);
        }
        if (!pjson.oclif) {
          throw new Error(`Plugin ${name}@${tag} is incompatible and could not be migrated`);
        }
        v7PackageJson.oclif.plugins.push({ name, tag, type: 'user' });
        v7PackageJson.dependencies[name] = `^${pjson.version}`;
      } catch (err) {
        this.warn(chalk.yellow(err.message));
      }
    }

    await writeJson(fs, v7Path, v7PackageJson);
    debug('wrote v7 plugins: %j', v7PackageJson.dependencies);

    await moveIfPossible(fs, path.join(v6Dir, 'node_modules'), path.join(v7Dir, 'node_modules'));
    await moveIfPossible(fs, path.join(v6Dir, 'yarn.lock'), path.join(v7Dir, 'yarn.lock'));
    debug('moved installed plugins and lockfile');

    await remove(fs, v6Dir);

    cli.action.stop();
    debug('cleaned v6 plugin config');
  } catch (err) {
    if (err.code !== 'ENOENT') return this.warn(chalk.yellow(err.message));
    debug('file not found during migration: %s', err.message);
  }
};

// Since we don't plan to keep this hook in the CLI indefinitely, adding new dependencies for a few simple util
// functions seems like overkill.

async function pathExists(fs: FsLib, p: string): Promise<boolean> {
  try {
    await promisify(fs.access)(p);
  } catch {
    return false;
  }
  return true;
}

async function readJsonMap<T extends JsonMap>(fs: FsLib, p: string): Promise<T> {
  return JSON.parse((await promisify(fs.readFile)(p)).toString('utf8'));
}

async function writeJson(fs: FsLib, p: string, json: AnyJson): Promise<void> {
  return await promisify(fs.writeFile)(p, JSON.stringify(json));
}

async function remove(fs: FsLib, p: string): Promise<void> {
  const stat = await promisify(fs.lstat)(p);
  if (stat.isDirectory()) {
    const files = await promisify(fs.readdir)(p);
    await Promise.all(files.map(f => remove(fs, path.join(p, f))));
    await promisify(fs.rmdir)(p);
  } else {
    await promisify(fs.unlink)(p);
  }
}

async function moveIfPossible(fs: FsLib, from: string, to: string): Promise<void> {
  if (await pathExists(fs, from) && !(await pathExists(fs, to))) {
    await promisify(fs.rename)(from, to);
  }
}

export default hook;
