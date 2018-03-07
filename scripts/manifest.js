#!/usr/bin/env node

/* eslint-disable no-console */
/* eslint-disable no-process-exit */

const fs = require('fs');

const file = process.argv[2];
const fields = process.argv.slice(3);

if (!file || fields.length === 0) {
    console.error('Usage: %s key.path=value [key.path=value]...', process.argv[1]);
    process.exit(1);
}

let json;
try {
    json = JSON.parse(fs.readFileSync(file).toString());
} catch (err) {
    if (err.code !== 'ENOENT') {
        throw err;
    }
    json = {
        released_at: new Date()
    };
}

fields.forEach((field) => {
    const [key, value] = field.split('=', 2);
    if (!key || !value) {
        return;
    }
    const path = key.split('.');
    let parent = json;
    path.forEach((part, i) => {
        if (i < path.length - 1) {
            parent = parent[part] = parent[part] || {};
            return;
        }
        parent[part] = value;
    });
});

fs.writeFileSync(file, JSON.stringify(json, null, 2));
