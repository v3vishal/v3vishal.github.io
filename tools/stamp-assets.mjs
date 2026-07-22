#!/usr/bin/env node
/* Stamps a content-hash cache-buster onto every style.css / script.js
   reference in the site's HTML:  style.css?v=<8-char sha1 of the file>.
   Content-addressed, so the query only changes when the asset does —
   no manual ?v= bumping, no forgotten pages.

   Run from anywhere:  node tools/stamp-assets.mjs                    */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['.git', 'node_modules', 'tools', 'fonts', 'res']);

const hashes = {};
for (const asset of ['style.css', 'script.js']) {
    hashes[asset] = createHash('sha1')
        .update(readFileSync(join(root, asset)))
        .digest('hex')
        .slice(0, 8);
}

function* htmlFiles(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (!SKIP.has(entry.name)) yield* htmlFiles(join(dir, entry.name));
        } else if (entry.name.endsWith('.html')) {
            yield join(dir, entry.name);
        }
    }
}

let stamped = 0;
for (const file of htmlFiles(root)) {
    const before = readFileSync(file, 'utf8');
    const after = before.replace(
        /((?:href|src)="[^"]*?(style\.css|script\.js))(?:\?v=[^"]*)?"/g,
        (_, prefix, asset) => `${prefix}?v=${hashes[asset]}"`,
    );
    if (after !== before) {
        writeFileSync(file, after);
        stamped++;
        console.log('stamped', relative(root, file));
    }
}
console.log(`style.css?v=${hashes['style.css']}  script.js?v=${hashes['script.js']}  (${stamped} file(s) updated)`);
