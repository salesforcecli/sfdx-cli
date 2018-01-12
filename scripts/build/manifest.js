#!/usr/bin/env node

/* eslint-disable no-console */
/* eslint-disable no-process-exit */

const fields = process.argv.slice(2);

if (fields.length === 0) {
    console.error('Usage: %s key.path=value [key.path=value]...', process.argv[1]);
    process.exit(1);
}

const json = {
    released_at: new Date(),
    version: '',
    channel: '',
    builds: {}
};

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

console.log(JSON.stringify(json, null, 2));
