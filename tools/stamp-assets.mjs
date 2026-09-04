#!/usr/bin/env node
/* Stamps a content-hash cache-buster onto every style.css / script.js
   reference in the site's HTML:  style.css?v=<8-char sha1 of the file>.
   Content-addressed, so the query only changes when the asset does —
   no manual ?v= bumping, no forgotten pages.

   Run from anywhere:  node tools/stamp-assets.mjs                    */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['.git', 'node_modules', 'tools', 'fonts', 'res']);

/* Hashes are resolved PER REFERENCE, against the directory of the HTML file
   doing the referencing — not once per bare filename.

   This used to hash /style.css and /script.js a single time and stamp that
   value onto every matching reference site-wide. The Crypt app ships its own
   projects/crypt/app/style.css, so its <link href="style.css"> was being
   stamped with the root stylesheet's hash: editing the app's CSS never
   changed its cache-buster, while editing the unrelated root CSS silently
   busted it. Content-addressed caching that addresses the wrong content is
   worse than none, because it looks like it is working. */
const hashCache = new Map();
function hashOf(absPath) {
    if (!hashCache.has(absPath)) {
        hashCache.set(absPath, createHash('sha1')
            .update(readFileSync(absPath))
            .digest('hex')
            .slice(0, 8));
    }
    return hashCache.get(absPath);
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
const seen = new Set();
for (const file of htmlFiles(root)) {
    const before = readFileSync(file, 'utf8');
    const after = before.replace(
        /((?:href|src)=")([^"]*?(?:style\.css|script\.js))(?:\?v=[^"]*)?"/g,
        (whole, attr, url) => {
            // Root-relative URLs resolve from the site root, everything else
            // from the referencing document's own directory.
            const target = url.startsWith('/')
                ? join(root, url.slice(1))
                : join(dirname(file), url);
            if (!existsSync(target)) {
                console.warn('  ! missing asset, left alone:', url, 'in', relative(root, file));
                return whole;
            }
            seen.add(relative(root, target).replace(/\\/g, '/') + '?v=' + hashOf(target));
            return `${attr}${url}?v=${hashOf(target)}"`;
        },
    );
    if (after !== before) {
        writeFileSync(file, after);
        stamped++;
        console.log('stamped', relative(root, file));
    }
}
for (const s of [...seen].sort()) console.log('  ' + s);
console.log(`(${stamped} file(s) updated)`);
