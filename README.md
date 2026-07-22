# Welcome to my website repository!
This is the repository which hosts [my website](https://v3x.is-a.dev) :)

## Dev tooling (`tools/`)
- `node tools/stamp-assets.mjs` — restamps the `?v=` cache-buster on every `style.css` / `script.js` reference with a content hash. Run after editing either asset; never bump `?v=` by hand.
- `node tools/verify-nav.js` — headless-Chromium regression check: every nav/breadcrumb/transit-map link resolves correctly at desktop + mobile viewports, and no request leaves the origin. One-time setup: `cd tools && npm install`.
