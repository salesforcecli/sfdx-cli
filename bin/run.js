#!/usr/bin/env node

const path = require('path');
const root = path.join(__dirname, '..');

// Check node version before requiring additional packages
require(path.join(root, 'dist', 'versions'))
    .checkNodeVersion();

// Check and prune CLI-defined flags
require(path.join(root, 'dist', 'flags'))
    .processCliFlags(process);

const pjson = require(path.join(root, 'package.json'));
require(path.join(root, 'dist', 'experiments', 'lazy-modules'));

const overrides = {/*@OVERRIDES@*/};
const version = overrides.version || pjson.version;
const channel = overrides.channel || pjson.cli.channel;
require(path.join(root, 'dist', 'cli'))
    .create(version, channel)
    .run();
