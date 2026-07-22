/* Headless regression check for site navigation, run at desktop AND
   mobile viewports:
     1. every nav / breadcrumb / transit-map link on key pages resolves
        to the correct root path (catches relative-path stacking bugs),
     2. the transit-map hop chain crypt -> writeups -> monie lands on
        clean URLs,
     3. no request leaves localhost (fonts and assets are self-hosted).

   Setup (once):  cd tools && npm install
   Run:           node tools/verify-nav.js                              */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const SITE = path.join(__dirname, '..');
const PORT = 8931;

function findChromium() {
    const base = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
    const candidates = [];
    try {
        for (const dir of fs.readdirSync(base)) {
            if (dir.startsWith('chromium_headless_shell-'))
                candidates.push(path.join(base, dir, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'));
            else if (dir.startsWith('chromium-'))
                candidates.push(path.join(base, dir, 'chrome-win64', 'chrome.exe'));
        }
    } catch (e) { /* no ms-playwright dir */ }
    candidates.push('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe');
    const found = candidates.find(fs.existsSync);
    if (!found) throw new Error('No Chromium/Edge executable found');
    return found;
}

const MIME = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
    '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.xml': 'application/xml',
    '.txt': 'text/plain',
};

const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    fs.readFile(path.join(SITE, p), (err, data) => {
        if (err) { res.writeHead(404); res.end('not found'); return; }
        res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
        res.end(data);
    });
});

(async () => {
    await new Promise(r => server.listen(PORT, r));
    const browser = await chromium.launch({ executablePath: findChromium() });
    let page;
    let fail = 0;
    const externalRequests = new Set();

    async function checkPage(url, expected) {
        await page.goto('http://localhost:' + PORT + url, { waitUntil: 'load' });
        const links = await page.$$eval('.site-nav a, .breadcrumb a, .sitemap__station',
            els => els.map(e => {
                const href = e.getAttribute('href') || '';
                return { text: (e.textContent || '').trim().slice(0, 20), href, abs: new URL(href, location.href).href };
            }));
        console.log('\n== ' + url);
        for (const l of links) {
            const absPath = l.abs.replace('http://localhost:' + PORT, '');
            const ok = expected.some(x => absPath === x || absPath.startsWith(x));
            if (!ok) fail++;
            console.log((ok ? '  OK  ' : '  BAD ') + (l.text || '(station)').padEnd(20) + l.href + '  ->  ' + absPath);
        }
    }

    async function mapHop(station, want) {
        await page.dispatchEvent('#mapToggle', 'click');
        await page.waitForSelector('.sitemap__station[data-station="' + station + '"]');
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'load' }),
            page.dispatchEvent('.sitemap__station[data-station="' + station + '"]', 'click'),
        ]);
        const landed = new URL(page.url()).pathname;
        console.log('map hop -> ' + station + ' lands on: ' + landed);
        if (landed !== want) fail++;
    }

    const EXPECTED = ['/', '/#projects', '/#contact', '/blog/', '/projects/'];
    const VIEWPORTS = [
        { name: 'desktop 1280x900', viewport: { width: 1280, height: 900 } },
        { name: 'mobile 390x844', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    ];

    for (const vp of VIEWPORTS) {
        console.log('\n===== ' + vp.name + ' =====');
        page = await browser.newPage({ viewport: vp.viewport, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
        page.on('request', req => {
            const u = new URL(req.url());
            // kaspersky-labs.com: local antivirus web protection injects its
            // own script into every page — machine noise, not a site asset.
            if (u.hostname !== 'localhost' && !u.hostname.endsWith('kaspersky-labs.com'))
                externalRequests.add(u.origin + u.pathname);
        });
        await checkPage('/', EXPECTED);
        await checkPage('/projects/crypt/', EXPECTED);
        await checkPage('/blog/hello-writeups/', EXPECTED);
        await page.goto('http://localhost:' + PORT + '/projects/crypt/', { waitUntil: 'load' });
        await mapHop('writeups', '/blog/');
        await mapHop('monie', '/projects/monie/');
        await page.close();
    }

    if (externalRequests.size) {
        fail++;
        console.log('\nBAD external requests (site should be fully self-hosted):');
        externalRequests.forEach(u => console.log('  ' + u));
    } else {
        console.log('\nOK no external requests — fully self-hosted');
    }

    await browser.close();
    server.close();
    console.log(fail === 0 ? '\nALL NAV CHECKS PASSED' : '\n' + fail + ' FAILURE(S)');
    process.exit(fail === 0 ? 0 : 1);
})();
