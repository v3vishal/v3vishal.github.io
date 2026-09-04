/* ============================================================
   v3x.is-a.dev — rev.07 client script
   Progressive enhancement throughout: pages are fully readable
   with JavaScript disabled. Every feature initialises inside
   safe() so a quirk in one browser can never kill the rest.
   ============================================================ */

(function () {
    'use strict';

    var root = document.documentElement;
    var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var FINE_POINTER = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    function safe(label, fn) {
        try { fn(); }
        catch (e) { if (window.console && console.warn) console.warn('v3x [' + label + ']:', e); }
    }

    /* ---------- universal link resolution ----------
       Markup uses root-absolute links (/projects/crypt/, /#contact) which
       are only correct when the site is mounted at the domain root. Derive
       the real site root from this script tag's src and rewrite links so
       they work everywhere: GitHub Pages, file://, VS Code's embedded
       browser, or any sub-path hosting. */
    var FILE_MODE = window.location.protocol === 'file:';
    var scriptTag = document.currentScript ||
        document.querySelector('script[src*="script.js"]');
    var scriptSrc = scriptTag ? (scriptTag.getAttribute('src') || '') : '';
    /* Strip any ?v= cache-buster before deriving the root — a bare
       $= selector match breaks the moment a query string is added. */
    var SITE_ROOT = scriptSrc.split(/[?#]/)[0].replace(/script\.js$/, '');

    function localizeHref(href) {
        if (!href || href.charAt(0) !== '/') return href;
        var p = href.slice(1);
        var base = SITE_ROOT || './';
        var index = FILE_MODE ? 'index.html' : '';
        if (p === '') return (base + index) || './';
        if (p.charAt(0) === '#') return base + index + p;
        if (p.slice(-1) === '/') return base + p + index;
        return base + p;
    }

    function localizeLinks(container) {
        var links = container.querySelectorAll('a[href^="/"]');
        for (var i = 0; i < links.length; i++) {
            links[i].setAttribute('href', localizeHref(links[i].getAttribute('href')));
        }
    }

    safe('links', function () { localizeLinks(document); });

    /* ---------- speculative prefetch ----------
       Fetch an internal page the moment its link is hovered (desktop)
       or touched (mobile) — the navigation that follows ~100-300ms
       later then comes straight from cache. Skips Save-Data users. */
    safe('prefetch', function () {
        if (FILE_MODE) return;
        var conn = navigator.connection;
        if (conn && (conn.saveData || /(^|-)2g/.test(conn.effectiveType || ''))) return;
        var done = {};

        function prefetch(a) {
            var raw = a.getAttribute('href') || '';
            if (!raw || raw.charAt(0) === '#') return;
            var url;
            try { url = new URL(raw, window.location.href); } catch (e) { return; }
            if (url.origin !== window.location.origin) return;
            if (done[url.pathname] || url.pathname === window.location.pathname) return;
            done[url.pathname] = true;
            var link = document.createElement('link');
            link.rel = 'prefetch';
            link.as = 'document';
            link.href = url.pathname;
            document.head.appendChild(link);
        }

        function onIntent(e) {
            var t = e.target;
            var a = t && t.closest ? t.closest('a[href]') : null;
            if (a) prefetch(a);
        }

        document.addEventListener('mouseover', onIntent);
        document.addEventListener('touchstart', onIntent, { passive: true });
    });

    var MARK_SVG =
        '<svg class="mark" viewBox="0 0 24 16" width="20" height="13" aria-hidden="true">' +
        '<path class="mark__ai" d="M2 3 C 9 3, 10 13, 22 13"/>' +
        '<path class="mark__sec-halo" d="M2 13 C 9 13, 10 3, 22 3"/>' +
        '<path class="mark__sec" d="M2 13 C 9 13, 10 3, 22 3"/></svg>';

    /* ---------- theme ---------- */
    var themeToggle = document.getElementById('themeToggle');
    var themeMeta = document.querySelector('meta[name="theme-color"]');

    function currentTheme() {
        if (root.getAttribute('data-theme')) return root.getAttribute('data-theme');
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function applyTheme(theme, persist) {
        root.setAttribute('data-theme', theme);
        if (themeMeta) themeMeta.setAttribute('content', theme === 'dark' ? '#141716' : '#f7f8f7');
        if (themeToggle) {
            themeToggle.setAttribute('aria-label',
                theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
        }
        if (persist) {
            try { localStorage.setItem('theme', theme); } catch (e) { /* storage unavailable */ }
        }
    }

    safe('theme', function () {
        applyTheme(currentTheme(), false);
        if (themeToggle) {
            themeToggle.addEventListener('click', function () {
                applyTheme(currentTheme() === 'dark' ? 'light' : 'dark', true);
            });
        }
    });

    /* ---------- track highlight ---------- */
    var chips = Array.prototype.slice.call(document.querySelectorAll('[data-track-toggle]'));

    function setTrack(track) {
        if (track) document.body.setAttribute('data-track-active', track);
        else document.body.removeAttribute('data-track-active');
        chips.forEach(function (chip) {
            chip.setAttribute('aria-pressed',
                String(chip.getAttribute('data-track-toggle') === track));
        });
    }

    safe('tracks', function () {
        chips.forEach(function (chip) {
            chip.addEventListener('click', function () {
                var track = chip.getAttribute('data-track-toggle');
                var active = document.body.getAttribute('data-track-active');
                setTrack(active === track ? null : track);
            });
        });
    });

    /* ---------- reveal on scroll + hand-drawn accents ---------- */
    safe('reveal', function () {
        if (prefersReducedMotion || !('IntersectionObserver' in window)) return;
        var revealEls = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
        root.classList.add('js-anim');

        var initiallyVisible = revealEls.filter(function (el) {
            var r = el.getBoundingClientRect();
            return r.top < window.innerHeight && r.bottom > 0;
        });
        initiallyVisible.forEach(function (el, i) {
            el.style.setProperty('--reveal-delay', (i * 90) + 'ms');
        });

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-in');
                observer.unobserve(entry.target);
                // Once revealed, drop the attribute so the reveal transition
                // can never fight hover transforms (tilt) later on.
                setTimeout(function () {
                    entry.target.removeAttribute('data-reveal');
                    entry.target.style.removeProperty('--reveal-delay');
                }, 1200);
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });

        revealEls.forEach(function (el) { observer.observe(el); });

        var circled = document.querySelector('.circled');
        if (circled) setTimeout(function () { circled.classList.add('is-drawn'); }, 350);
    });

    /* ---------- copy buttons ---------- */
    safe('copy', function () {
        document.querySelectorAll('.copy-btn').forEach(function (btn) {
            var original = btn.textContent;
            btn.addEventListener('click', function () {
                var text = btn.getAttribute('data-copy');
                if (!navigator.clipboard) return;
                navigator.clipboard.writeText(text).then(function () {
                    btn.textContent = 'Copied';
                    btn.setAttribute('data-copied', '');
                    setTimeout(function () {
                        btn.textContent = original;
                        btn.removeAttribute('data-copied');
                    }, 1600);
                }).catch(function () { /* clipboard blocked — text is selectable */ });
            });
        });
    });

    /* ---------- footer year ---------- */
    safe('year', function () {
        var year = document.getElementById('year');
        if (year) year.textContent = String(new Date().getFullYear());
    });

    /* ---------- split-flap (departures-board) text ---------- */
    safe('flap', function () {
        var flapEls = Array.prototype.slice.call(document.querySelectorAll('[data-flap]'));
        if (prefersReducedMotion || !('IntersectionObserver' in window) || !flapEls.length) return;
        var FLAP_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789@./-';

        function flap(el) {
            if (el.__flapping) return;
            el.__flapping = true;
            var target = el.textContent;
            var frame = 0;
            var timer = setInterval(function () {
                frame++;
                var out = '';
                for (var i = 0; i < target.length; i++) {
                    if (frame > i + 4 || target[i] === ' ') out += target[i];
                    else out += FLAP_CHARS[Math.floor(Math.random() * FLAP_CHARS.length)];
                }
                el.textContent = out;
                if (frame > target.length + 4) {
                    clearInterval(timer);
                    el.textContent = target;
                    el.__flapping = false;
                }
            }, 42);
        }

        var flapObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                flapObserver.unobserve(entry.target);
                flap(entry.target);
            });
        }, { threshold: 0.4 });

        flapEls.forEach(function (el) {
            flapObserver.observe(el);
            if (FINE_POINTER) {
                el.addEventListener('mouseenter', function () { flap(el); });
            }
        });
    });

    /* ============================================================
       Site map — the two tracks, literally. Stations are pages;
       on the homepage a packet rides the line to your destination.
       ============================================================ */
    var mapToggle = document.getElementById('mapToggle');
    var sitemapEl = null;
    var closeMap = null;

    var STATIONS = [
        { id: 'home',           href: '/',                          label: 'home',           lines: 'sec ai', x: 80,  pill: [72, 50, 16, 108],  labelPos: [80, 180, 'middle'] },
        { id: 'projects',       href: '/#projects',                 label: 'projects',       lines: 'sec ai', x: 238, pill: [230, 50, 16, 108], labelPos: [238, 196, 'middle'] },
        { id: 'crypt',          href: '/projects/crypt/',           label: 'crypt',          lines: 'sec',    x: 310, stop: [310, 61, 'sec'],   labelPos: [310, 44, 'middle'] },
        { id: 'agri-fincaster', href: '/projects/agri-fincaster/',  label: 'agri-fincaster', lines: 'ai',     x: 292, stop: [292, 150, 'ai'],   labelPos: [292, 172, 'middle'] },
        { id: 'monie',          href: '/projects/monie/',           label: 'monie',          lines: 'ai',     x: 386, stop: [386, 145, 'ai'],   labelPos: [386, 167, 'middle'] },
        { id: 'writeups',       href: '/blog/',                     label: 'writeups',       lines: 'branch', x: 416, stop: [416, 28, 'sec'],  labelPos: [428, 12, 'start'] },
        { id: 'contact',        href: '/#contact',                  label: 'contact',        lines: 'sec ai', x: 468, dot: [468, 100], interchange: true, labelPos: [468, 128, 'middle'] }
    ];

    function stationById(id) {
        for (var i = 0; i < STATIONS.length; i++) {
            if (STATIONS[i].id === id) return STATIONS[i];
        }
        return null;
    }

    function buildSitemap() {
        var stationsSvg = STATIONS.map(function (s) {
            var shape;
            if (s.pill) {
                shape = '<rect x="' + s.pill[0] + '" y="' + s.pill[1] + '" width="' + s.pill[2] + '" height="' + s.pill[3] + '" rx="8" class="sitemap__pill"/>';
            } else if (s.dot) {
                var dotClass = 'sitemap__pill' + (s.interchange ? ' sitemap__pill--interchange' : '');
                shape = '<circle cx="' + s.dot[0] + '" cy="' + s.dot[1] + '" r="8" class="' + dotClass + '"/>';
            } else {
                shape = '<circle cx="' + s.stop[0] + '" cy="' + s.stop[1] + '" r="6" class="sitemap__stop sitemap__stop--' + s.stop[2] + '"/>';
            }
            // The counter-rotation pivot is baked in as an exact SVG-native
            // transform (rotating about this label's own x,y), which is
            // more precise than CSS transform-box:fill-box for anchored
            // text. CSS cancels this attribute outright on desktop
            // (.sitemap__label{transform:none}) since it's only meant to
            // apply under the mobile rotated-map treatment. (The viewBox
            // below was extended vertically for a separate, bigger reason:
            // rotated labels near its old y-edges were getting clipped by
            // the SVG's own intrinsic boundary — see that comment.)
            return '<a href="' + s.href + '" class="sitemap__station" data-station="' + s.id + '" data-lines="' + s.lines + '" data-x="' + s.x + '" role="listitem" aria-label="' + s.label + '">' +
                shape +
                '<text x="' + s.labelPos[0] + '" y="' + s.labelPos[1] + '" text-anchor="' + s.labelPos[2] + '" class="sitemap__label" transform="rotate(-90 ' + s.labelPos[0] + ' ' + s.labelPos[1] + ')">' + s.label + '</text></a>';
        }).join('');

        var el = document.createElement('div');
        el.id = 'sitemap';
        el.className = 'sitemap';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-label', 'Site map');
        el.hidden = true;
        el.innerHTML =
            '<div class="sitemap__panel">' +
            '<header class="sitemap__bar"><span class="sitemap__title">site map</span>' +
            '<button id="mapClose" class="sitemap__close" type="button" aria-label="Close site map">✕</button></header>' +
            '<div class="sitemap__body">' +
            '<span class="sitemap__legend">' +
            '<span class="sitemap__legend-item"><svg class="thread thread--security" viewBox="0 0 14 8" width="14" height="8" aria-hidden="true"><path d="M1 6 C 5 6, 9 2, 13 2"/></svg>security line</span>' +
            '<span class="sitemap__legend-item"><svg class="thread thread--ai" viewBox="0 0 14 8" width="14" height="8" aria-hidden="true"><path d="M1 2 C 5 2, 9 6, 13 6"/></svg>ai line</span>' +
            '<span class="sitemap__legend-item"><svg viewBox="0 0 14 8" width="14" height="8" aria-hidden="true"><path d="M1 6 L13 2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 2"/></svg>writeups branch</span>' +
            '<span class="sitemap__legend-item"><svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true"><rect x="2" y="2" width="10" height="10" rx="4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>interchange</span>' +
            '</span>' +
            '<div class="sitemap__svg-wrap">' +
            // viewBox extended from "0 0 560 210" to "0 -60 560 365" — some
            // labels (projects, agri-fincaster, writeups) sit close to the
            // original y:0/210 edges, which is fine for horizontal desktop
            // text but not for the mobile rotated map: a rotated label's
            // bounding box is as tall as the ORIGINAL text was wide, and
            // that exceeded the viewBox bounds for the longer labels — the
            // SVG's own intrinsic edge-clipping (independent of any CSS
            // overflow rule) then silently ate a couple of characters off
            // one end. Extending the viewBox gives every rotated label
            // room without moving any station's actual coordinates. This
            // does make the desktop map render a bit taller (blank
            // padding above/below, ~560:365 aspect instead of ~8:3) —
            // checked visually and it reads as fine, not broken.
            //
            // The extra height (320 -> 365, on top of the original 0-60
            // bump) is specifically for agri-fincaster: giving it a
            // non-centered text-anchor on mobile (see the CSS mobile
            // block) to stop its label overlapping its own dot pushes
            // its rotated bounding box further toward this edge than a
            // centered anchor ever did — verified against a real render,
            // not estimated, after a first attempt at 320 still clipped
            // "agri-" off the front of the label.
            '<svg class="sitemap__svg" viewBox="0 -60 560 365" role="list" aria-label="Pages">' +
            '<defs><linearGradient id="interchangeGrad" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0%" stop-color="var(--security)"/><stop offset="100%" stop-color="var(--ai)"/>' +
            '</linearGradient></defs>' +
            '<path id="line-sec" class="sitemap__line sitemap__line--sec" d="M32 62 C 110 57, 150 67, 238 62 C 300 58, 330 64, 358 62 C 402 59, 447 77, 468 98"/>' +
            '<path id="line-ai" class="sitemap__line sitemap__line--ai" d="M32 148 C 110 153, 150 143, 238 148 C 300 152, 330 146, 368 146 C 412 146, 449 121, 468 102"/>' +
            '<path id="line-branch" class="sitemap__line sitemap__line--sec sitemap__line--branch" d="M350 62 C 372 56, 396 45, 416 28"/>' +
            '<circle id="mapPacket" class="sitemap__packet" r="4.5" hidden></circle>' +
            stationsSvg +
            '</svg></div>' +
            '<p class="sitemap__readout" id="mapReadout" aria-live="polite"></p>' +
            '</div></div>';
        document.body.appendChild(el);
        return el;
    }

    safe('map', function () {
        if (!mapToggle) return;
        sitemapEl = buildSitemap();
        localizeLinks(sitemapEl);

        var mapClose = document.getElementById('mapClose');
        var readout = document.getElementById('mapReadout');
        var packet = document.getElementById('mapPacket');
        var paths = {
            sec: document.getElementById('line-sec'),
            ai: document.getElementById('line-ai'),
            branch: document.getElementById('line-branch')
        };
        var hereId = document.body.getAttribute('data-station') || 'home';
        var stationEls = Array.prototype.slice.call(sitemapEl.querySelectorAll('.sitemap__station'));

        // Mark "you are here" with a pulsing ring. Coordinates come from
        // STATIONS data — measuring SVG geometry inside a hidden dialog
        // throws in Firefox and would kill this feature.
        stationEls.forEach(function (a) {
            if (a.getAttribute('data-station') !== hereId) return;
            a.classList.add('is-here');
            var s = stationById(hereId);
            if (!s) return;
            var cx, cy, r;
            if (s.pill)      { cx = s.pill[0] + s.pill[2] / 2; cy = s.pill[1] + s.pill[3] / 2; r = 16; }
            else if (s.dot)  { cx = s.dot[0];  cy = s.dot[1];  r = 16; }
            else             { cx = s.stop[0]; cy = s.stop[1]; r = 14; }
            var pulse = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            pulse.setAttribute('cx', cx);
            pulse.setAttribute('cy', cy);
            pulse.setAttribute('r', r);
            pulse.setAttribute('class', 'sitemap__pulse');
            a.parentNode.insertBefore(pulse, a);
        });

        function setReadout(html) { if (readout) readout.innerHTML = html; }

        function hereLabel() {
            var s = stationById(hereId);
            if (!s) return 'you are here: <span class="t-warn">●</span> off the map — pick a station.';
            var tint = s.lines.indexOf('sec') !== -1 ? 't-sec' : 't-ai';
            return 'you are here: <span class="' + tint + '">●</span> ' + s.label;
        }
        setReadout(hereLabel());

        function isMapOpen() { return !sitemapEl.hidden; }

        function openMap() {
            sitemapEl.hidden = false;
            requestAnimationFrame(function () { sitemapEl.classList.add('is-open'); });
            mapToggle.setAttribute('aria-expanded', 'true');
            setReadout(hereLabel());
            var here = sitemapEl.querySelector('.sitemap__station.is-here') || stationEls[0];
            if (here) here.focus();
        }

        closeMap = function () {
            sitemapEl.classList.remove('is-open');
            mapToggle.setAttribute('aria-expanded', 'false');
            var hide = function () { sitemapEl.hidden = true; };
            prefersReducedMotion ? hide() : setTimeout(hide, 250);
            mapToggle.focus();
        };

        // Find the length along a path where the point is nearest to x.
        function lengthAtX(path, x) {
            var total = path.getTotalLength();
            var best = 0, bestDist = Infinity;
            for (var i = 0; i <= 100; i++) {
                var len = (total * i) / 100;
                var pt = path.getPointAtLength(len);
                var d = Math.abs(pt.x - x);
                if (d < bestDist) { bestDist = d; best = len; }
            }
            return best;
        }

        function legsFor(station) {
            var homeX = 80;
            if (station.lines === 'branch') {
                return [
                    { path: paths.sec, from: lengthAtX(paths.sec, homeX), to: lengthAtX(paths.sec, 350) },
                    { path: paths.branch, from: 0, to: paths.branch.getTotalLength() }
                ];
            }
            var line = station.lines.indexOf('sec') !== -1 ? paths.sec : paths.ai;
            return [{ path: line, from: lengthAtX(line, homeX), to: lengthAtX(line, station.x) }];
        }

        function ridePacket(station, done) {
            var legs = legsFor(station);
            var totalDist = legs.reduce(function (sum, l) { return sum + Math.abs(l.to - l.from); }, 0);
            var duration = Math.max(420, Math.min(900, totalDist * 2.2));
            var start = null;
            packet.removeAttribute('hidden'); // .hidden property is a no-op on SVG elements
            setReadout('routing → ' + station.label + ' …');

            function frame(ts) {
                if (start === null) start = ts;
                var p = Math.min(1, (ts - start) / duration);
                var eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
                var travelled = eased * totalDist;
                for (var i = 0; i < legs.length; i++) {
                    var leg = legs[i];
                    var legDist = Math.abs(leg.to - leg.from);
                    if (travelled <= legDist || i === legs.length - 1) {
                        var along = leg.from + Math.sign(leg.to - leg.from) * Math.min(travelled, legDist);
                        var pt = leg.path.getPointAtLength(along);
                        packet.setAttribute('cx', pt.x);
                        packet.setAttribute('cy', pt.y);
                        break;
                    }
                    travelled -= legDist;
                }
                if (p < 1) requestAnimationFrame(frame);
                else done();
            }
            requestAnimationFrame(frame);
        }

        stationEls.forEach(function (a) {
            a.addEventListener('click', function (e) {
                var id = a.getAttribute('data-station');
                if (id === hereId) { e.preventDefault(); closeMap(); return; }
                // The packet ride only makes sense from the 'home' origin;
                // elsewhere (or with modifiers / reduced motion) navigate plainly.
                // Close the map regardless of which branch runs: hash-only
                // hrefs (e.g. '/#contact') navigate without unloading the
                // document, so without this the dialog stayed open on top
                // of the section you just "went to."
                if (prefersReducedMotion || hereId !== 'home' || e.metaKey || e.ctrlKey || e.shiftKey) {
                    closeMap();
                    return;
                }
                e.preventDefault();
                var station = stationById(id);
                ridePacket(station, function () {
                    closeMap();
                    window.location.href = a.getAttribute('href');
                });
            });
        });

        mapToggle.addEventListener('click', function () {
            isMapOpen() ? closeMap() : openMap();
        });
        mapClose.addEventListener('click', closeMap);
        sitemapEl.addEventListener('click', function (e) {
            if (e.target === sitemapEl) closeMap();
        });
    });

    /* ============================================================
       Terminal — a small, honest shell. No eval, no network,
       all user input escaped before rendering.
       ============================================================ */
    var termToggle = document.getElementById('termToggle');
    var termOpenFns = { isOpen: function () { return false; }, close: function () {} };

    safe('terminal', function () {
        if (!termToggle) return;

        var el = document.createElement('div');
        el.id = 'terminal';
        el.className = 'terminal';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-label', 'Interactive terminal');
        el.hidden = true;
        el.innerHTML =
            '<div class="terminal__panel">' +
            '<header class="terminal__bar">' + MARK_SVG +
            '<span class="terminal__title">vishal@v3x:~</span>' +
            '<span class="terminal__hint">help · tab completes · ↑ history · esc closes</span>' +
            '<button id="termClose" class="terminal__close" type="button" aria-label="Close terminal">✕</button></header>' +
            '<div id="termScreen" class="terminal__screen">' +
            '<div id="termHistory" class="terminal__history"></div>' +
            '<div class="terminal__inputrow">' +
            '<label class="terminal__ps1" for="termInput" aria-hidden="true">$</label>' +
            '<input id="termInput" class="terminal__input" type="text" aria-label="Terminal command" autocomplete="off" autocapitalize="off" spellcheck="false">' +
            '</div></div></div>';
        document.body.appendChild(el);

        var term = {
            rootEl: el,
            close: el.querySelector('#termClose'),
            screen: el.querySelector('#termScreen'),
            history: el.querySelector('#termHistory'),
            input: el.querySelector('#termInput')
        };

        var cmdHistory = [];
        var histIdx = -1;
        var welcomed = false;

        function escapeHtml(s) {
            return String(s).replace(/[&<>"']/g, function (c) {
                return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
            });
        }

        function print(html) {
            var div = document.createElement('div');
            div.innerHTML = html;
            term.history.appendChild(div);
        }

        function scrollDown() { term.screen.scrollTop = term.screen.scrollHeight; }

        /* ---- keyboard-aware placement (phones) ----
           position:fixed resolves against the layout viewport, which does not
           shrink when the on-screen keyboard opens — so the panel ends up
           behind the keyboard the moment you focus the input, i.e. precisely
           when you need to see it. visualViewport reports what is genuinely
           visible; the difference between the two is the keyboard. Listeners
           are attached only while the terminal is open, so this costs nothing
           the rest of the time, and the whole block no-ops on desktop and on
           browsers without visualViewport. */
        var vv = window.visualViewport;
        function syncKeyboardInset() {
            if (!vv) return;
            var gap = window.innerHeight - vv.height - vv.offsetTop;
            /* Small deltas are just URL-bar chrome, not a keyboard. */
            var inset = gap > 60 ? Math.round(gap) : 0;
            term.rootEl.style.setProperty('--kb-inset', inset + 'px');
            term.rootEl.style.setProperty('--kb-vh', Math.round(vv.height) + 'px');
            if (inset) scrollDown();
        }
        function watchKeyboard(on) {
            if (!vv) return;
            if (on) {
                vv.addEventListener('resize', syncKeyboardInset);
                vv.addEventListener('scroll', syncKeyboardInset);
                syncKeyboardInset();
            } else {
                vv.removeEventListener('resize', syncKeyboardInset);
                vv.removeEventListener('scroll', syncKeyboardInset);
                term.rootEl.style.removeProperty('--kb-inset');
                term.rootEl.style.removeProperty('--kb-vh');
            }
        }

        function openTerm() {
            term.rootEl.hidden = false;
            watchKeyboard(true);
            requestAnimationFrame(function () { term.rootEl.classList.add('is-open'); });
            termToggle.setAttribute('aria-expanded', 'true');
            if (!welcomed) {
                welcomed = true;
                print('<span class="t-sec">v3x shell</span> <span class="t-dim">— type</span> help <span class="t-dim">to look around.</span>');
                print('');
            }
            term.input.focus();
            scrollDown();
        }

        function closeTerm() {
            term.rootEl.classList.remove('is-open');
            termToggle.setAttribute('aria-expanded', 'false');
            watchKeyboard(false);
            var hide = function () { term.rootEl.hidden = true; };
            prefersReducedMotion ? hide() : setTimeout(hide, 300);
            termToggle.focus();
        }

        function isTermOpen() { return !term.rootEl.hidden; }
        termOpenFns.isOpen = isTermOpen;
        termOpenFns.close = closeTerm;

        var projects = {
            'agri-fincaster': {
                tint: 't-ai',
                line: 'ML crop-yield forecasting from government agricultural data. Built with Vihaan S, CBSE Science Exhibition 2024–25.',
                page: '/projects/agri-fincaster/',
                repo: 'https://github.com/v3vishal/agri-fincaster'
            },
            'monie': {
                tint: 't-ai',
                line: 'Personal-finance ML — spending patterns, anomaly flags, budget suggestions. In development.',
                page: '/projects/monie/'
            },
            'crypt': {
                tint: 't-sec',
                line: 'Python security toolkit — encryption, password-strength analysis, educational cracking sims. Stable.',
                page: '/projects/crypt/'
            }
        };

        var commands = {
            help: function () {
                var rows = [
                    ['help',            'this list'],
                    ['whoami',          'who runs this site'],
                    ['projects',        'list projects'],
                    ['experience',      'where i\'ve worked'],
                    ['cat <project>',   'project details (try: cat crypt)'],
                    ['map',             'open the site map'],
                    ['stack',           'current toolkit'],
                    ['skills',          'skill summary'],
                    ['contact',         'ways to reach me'],
                    ['blog',            'open the writeups page'],
                    ['theme [dark|light]', 'switch the site theme'],
                    ['track [security|ai|off]', 'highlight a track on the page'],
                    ['clear',           'clear the screen'],
                    ['exit',            'close the terminal'],
                    ['sudo',            'go ahead, try it']
                ];
                rows.forEach(function (r) {
                    print('  <span class="t-cmd">' + escapeHtml(r[0].padEnd(26, ' ')) + '</span><span class="t-dim">' + escapeHtml(r[1]) + '</span>');
                });
                print('');
            },

            whoami: function () {
                print('<span class="t-cmd">vishal v v</span> <span class="t-dim">— cs student, two tracks:</span> <span class="t-sec">security</span> <span class="t-dim">&amp;</span> <span class="t-ai">applied ai</span>');
                print('<span class="t-dim">builds voice agents (livekit), typed llm systems (pydantic ai), ml models, and security tooling. learns by shipping.</span>');
                print('<span class="t-dim">software engineering intern @ kenpath technologies — accessibility, agri-tech, voice agents.</span>');
                print('');
            },

            experience: function () {
                print('  <span class="t-cmd">kenpath technologies</span> <span class="t-dim">— software engineering intern</span>');
                print('  <span class="t-dim">· accessibility-first android apps — kotlin, expo, react native</span>');
                print('  <span class="t-dim">· agri-tech: mobile ↔ esp32/arduino hardware + livestock-disease ai agents</span>');
                print('  <span class="t-dim">· livekit voice study companion — realtime + telephony + doc retrieval</span>');
                print('  <span class="t-dim">· infra hardening: phishing protection, biometric auth, rbac</span>');
                print('');
            },

            projects: function () {
                Object.keys(projects).forEach(function (k) {
                    var p = projects[k];
                    print('  <span class="' + p.tint + '">●</span> <span class="t-cmd">' + k + '</span>  <span class="t-dim">' + escapeHtml(p.line) + '</span>');
                });
                print('<span class="t-dim">try</span> cat &lt;project&gt; <span class="t-dim">for links.</span>');
                print('');
            },

            cat: function (args) {
                if (!args.length) { print('<span class="t-warn">cat: missing file.</span> <span class="t-dim">try: cat crypt</span>'); print(''); return; }
                var key = args[0].toLowerCase().replace(/^\.?\//, '');
                var match = projects[key] ? key : Object.keys(projects).filter(function (k) { return k.indexOf(key) === 0; })[0];
                var p = match ? projects[match] : null;
                if (!p) { print('<span class="t-warn">cat: ' + escapeHtml(args[0]) + ': no such file.</span>'); print(''); return; }
                print('<span class="t-cmd">' + escapeHtml(p.line) + '</span>');
                print('  → <a href="' + localizeHref(p.page) + '">case study</a>');
                if (p.repo) print('  → <a href="' + p.repo + '" target="_blank" rel="noopener">github</a>');
                else print('  <span class="t-dim">code coming soon</span>');
                print('');
            },

            map: function () {
                if (mapToggle) {
                    print('<span class="t-dim">opening the site map…</span>');
                    print('');
                    closeTerm();
                    mapToggle.click();
                } else {
                    print('<span class="t-warn">map: not available on this page.</span>');
                    print('');
                }
            },

            stack: function () {
                print('  <span class="t-cmd">python      </span><span class="t-dim">daily language — typed, async, ml + security</span>');
                print('  <span class="t-cmd">livekit     </span><span class="t-dim">real-time voice agents — stt → llm → tts</span>');
                print('  <span class="t-cmd">pydantic ai </span><span class="t-dim">typed agents, structured output, validation</span>');
                print('  <span class="t-cmd">ag-ui       </span><span class="t-dim">agent ↔ ui protocol — streaming, state sync</span>');
                print('');
            },

            skills: function () {
                print('  <span class="t-sec">security</span> <span class="t-dim">— network, crypto, passwords, web/api, linux</span>');
                print('  <span class="t-ai">ai / ml</span> <span class="t-dim">— supervised models, llm tools, voice agents, evals</span>');
                print('  <span class="t-cmd">certs</span>    <span class="t-dim">— tryhackme pre-security, advent of cyber 2024, toi young ai explorer</span>');
                print('');
            },

            contact: function () {
                print('  email    → <a href="mailto:vcubegalaxy@gmail.com">vcubegalaxy@gmail.com</a>');
                print('  github   → <a href="https://github.com/v3vishal" target="_blank" rel="noopener">@v3vishal</a>');
                print('  linkedin → <a href="https://linkedin.com/in/v3-vishal" target="_blank" rel="noopener">in/v3-vishal</a>');
                print('  discord  → <span class="t-cmd">v3xg</span>');
                print('');
            },

            blog: function () {
                print('<span class="t-dim">opening /blog/ …</span>');
                print('');
                window.location.href = localizeHref('/blog/');
            },

            theme: function (args) {
                var target = args[0];
                if (target !== 'dark' && target !== 'light') {
                    target = currentTheme() === 'dark' ? 'light' : 'dark';
                }
                applyTheme(target, true);
                print('<span class="t-dim">theme → ' + target + '</span>');
                print('');
            },

            track: function (args) {
                var t = (args[0] || '').toLowerCase();
                if (t === 'security' || t === 'ai') {
                    setTrack(t);
                    print('<span class="t-dim">highlighting</span> <span class="' + (t === 'ai' ? 't-ai' : 't-sec') + '">' + t + '</span> <span class="t-dim">on the page.</span>');
                } else {
                    setTrack(null);
                    print('<span class="t-dim">track highlight off.</span>');
                }
                print('');
            },

            date: function () {
                print('<span class="t-dim">' + escapeHtml(new Date().toString()) + '</span>');
                print('');
            },

            echo: function (args) {
                print('<span class="t-cmd">' + escapeHtml(args.join(' ')) + '</span>');
                print('');
            },

            clear: function () { term.history.innerHTML = ''; },

            sudo: function () {
                print('<span class="t-warn">[sudo]</span> <span class="t-dim">permission denied: this shell is read-only. nice try though.</span>');
                print('');
            },

            coffee: function () {
                print('<span class="t-warn">[418]</span> <span class="t-dim">i’m a teapot.</span>');
                print('');
            },

            exit: function () { closeTerm(); }
        };
        commands.ls = commands.projects;
        commands.exp = commands.experience;
        commands.man = commands.help;
        commands.about = commands.whoami;
        commands.cls = commands.clear;

        function run(raw) {
            var cmd = raw.trim();
            print('<span class="t-sec">$</span> <span class="t-cmd">' + escapeHtml(raw) + '</span>');
            if (!cmd) return;
            cmdHistory.unshift(cmd);
            if (cmdHistory.length > 50) cmdHistory.pop();
            var parts = cmd.split(/\s+/);
            var fn = commands[parts[0].toLowerCase()];
            if (fn) fn(parts.slice(1));
            else {
                print('<span class="t-warn">' + escapeHtml(parts[0]) + ': command not found.</span> <span class="t-dim">try</span> help<span class="t-dim">.</span>');
                print('');
            }
        }

        termToggle.addEventListener('click', function () {
            isTermOpen() ? closeTerm() : openTerm();
        });
        term.close.addEventListener('click', closeTerm);
        term.screen.addEventListener('click', function () { term.input.focus(); });

        term.input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                run(term.input.value);
                term.input.value = '';
                histIdx = -1;
                scrollDown();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (!cmdHistory.length) return;
                histIdx = Math.min(histIdx + 1, cmdHistory.length - 1);
                term.input.value = cmdHistory[histIdx];
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                histIdx = Math.max(histIdx - 1, -1);
                term.input.value = histIdx === -1 ? '' : cmdHistory[histIdx];
            } else if (e.key === 'Tab') {
                e.preventDefault();
                var partial = term.input.value.trim().toLowerCase();
                if (!partial) return;
                var matches = Object.keys(commands).filter(function (n) { return n.indexOf(partial) === 0; });
                if (matches.length === 1) term.input.value = matches[0];
                else if (matches.length > 1) {
                    print('<span class="t-dim">' + matches.join('  ') + '</span>');
                    scrollDown();
                }
            } else if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) {
                e.preventDefault();
                commands.clear();
            }
        });

        document.addEventListener('keydown', function (e) {
            var active = document.activeElement;
            var typing = active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName);
            if (e.key === '`' && !typing) {
                e.preventDefault();
                isTermOpen() ? closeTerm() : openTerm();
            }
        });
    });

    /* ---------- global Escape: map, then terminal, then track ---------- */
    safe('escape', function () {
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            if (sitemapEl && !sitemapEl.hidden && closeMap) closeMap();
            else if (termOpenFns.isOpen()) termOpenFns.close();
            else setTrack(null);
        });
    });

    /* ============================================================
       Pointer FX — mouse-only decoration (fine pointers, motion OK):
       scroll rail, packet cursor, click pings, cursor-revealed grid,
       glow borders, magnetic buttons, damped tilt.
       ============================================================ */
    /* All of these effects used to be independent listeners: one pointermove
       on the document, one per glow card, one per magnetic button, one per
       tiltable project — each doing its own getBoundingClientRect() and its
       own style writes, synchronously, on every single event.

       That is fine at 60Hz. It is not fine at 144/240Hz, where pointermove
       fires several times more often, and where every extra read-after-write
       in the same handler risks a forced synchronous layout. The site felt
       "capped at 60" because the main thread was doing per-event layout work
       instead of per-frame work.

       Everything below is now driven by ONE listener that records state and
       ONE rAF that applies it, split into a read phase and a write phase so
       measurement never interleaves with mutation. Pointer events beyond the
       first in a frame cost nothing but two number assignments, so the work
       is now bounded by refresh rate rather than by mouse polling rate.
       The loop also parks itself once the packet stops moving, so an idle
       page schedules no frames at all. */
    safe('pointer-fx', function () {
        if (!FINE_POINTER || prefersReducedMotion) return;
        root.classList.add('pointer-fx');

        /* scroll progress rail */
        var rail = document.createElement('div');
        rail.className = 'scroll-rail';
        rail.setAttribute('aria-hidden', 'true');
        document.body.appendChild(rail);

        /* cursor-revealed dot grid */
        var ambient = document.querySelector('.ambient');
        var grid = null;
        if (ambient) {
            grid = document.createElement('div');
            grid.className = 'ambient__grid';
            ambient.appendChild(grid);
        }

        /* packet cursor — a dot that rides behind the pointer */
        var dot = document.createElement('div');
        dot.className = 'cursor-packet';
        dot.setAttribute('aria-hidden', 'true');
        dot.style.opacity = '0';
        document.body.appendChild(dot);

        var GLOW_SEL = '.project, .skills__group';
        var MAG_SEL = '.track-chip, .map-toggle, .term-toggle, .theme-toggle, .copy-btn';
        document.querySelectorAll(GLOW_SEL).forEach(function (c) { c.classList.add('glow-card'); });
        document.querySelectorAll(MAG_SEL).forEach(function (b) { b.classList.add('magnetic'); });

        var mx = -100, my = -100, px = -100, py = -100;
        var moved = false, pointerDirty = false, scrollDirty = true, running = false;
        var hoverCard = null, hoverBtn = null, ringKey = '';

        function schedule() {
            if (running) return;
            running = true;
            requestAnimationFrame(frame);
        }

        document.addEventListener('pointermove', function (e) {
            if (e.pointerType && e.pointerType !== 'mouse') return;
            mx = e.clientX; my = e.clientY;
            if (!moved) { moved = true; px = mx; py = my; }
            /* closest() walks the DOM but touches no geometry, so it is safe
               to do here; everything that measures waits for the frame. */
            var interactive = e.target && e.target.closest
                ? e.target.closest('a, button, input, [role="button"]') : null;
            /* The track chips carry `data-track-toggle`, not `data-track`, so
               reading only the latter meant the two chips — the one place the
               security/AI split is the entire point of the control — never
               actually tinted the cursor. Both attributes are read now. */
            var tracked = interactive ? e.target.closest('[data-track], [data-track-toggle]') : null;
            var trackVal = tracked && tracked.getAttribute
                ? (tracked.getAttribute('data-track') || tracked.getAttribute('data-track-toggle') || '')
                : '';
            ringKey = interactive ? (trackVal === 'security' ? 'sec' : trackVal === 'ai' ? 'ai' : 'on') : '';
            hoverCard = e.target && e.target.closest ? e.target.closest(GLOW_SEL) : null;
            hoverBtn = e.target && e.target.closest ? e.target.closest(MAG_SEL) : null;
            pointerDirty = true;
            schedule();
        }, { passive: true });

        window.addEventListener('scroll', function () { scrollDirty = true; schedule(); }, { passive: true });
        window.addEventListener('resize', function () { scrollDirty = true; schedule(); }, { passive: true });

        /* Elements the previous frame transformed, so they can be reset the
           moment the pointer leaves without needing per-element listeners. */
        var lastCard = null, lastBtn = null, lastTilt = null, appliedRing = null;

        function frame() {
            running = false;

            /* ---- READ phase: every measurement happens up here, before a
               single style write, so nothing can force a synchronous
               relayout mid-frame. ---- */
            var cardRect = null, btnRect = null, railScale = null;
            if (pointerDirty) {
                if (hoverCard) cardRect = hoverCard.getBoundingClientRect();
                if (hoverBtn) btnRect = hoverBtn.getBoundingClientRect();
            }
            if (scrollDirty) {
                var h = document.documentElement;
                var max = h.scrollHeight - h.clientHeight;
                railScale = max > 0 ? h.scrollTop / max : 0;
                scrollDirty = false;
            }

            /* ---- WRITE phase ---- */
            if (railScale !== null) rail.style.transform = 'scaleX(' + railScale + ')';

            if (pointerDirty) {
                if (grid) {
                    grid.style.setProperty('--mx', mx + 'px');
                    grid.style.setProperty('--my', my + 'px');
                }
                /* Only touch classList when the state actually changed —
                   the old code removed and re-added classes on every event. */
                if (appliedRing !== ringKey) {
                    dot.classList.toggle('is-ring', ringKey !== '');
                    dot.classList.toggle('is-sec', ringKey === 'sec');
                    dot.classList.toggle('is-ai', ringKey === 'ai');
                    appliedRing = ringKey;
                }
                if (lastCard && lastCard !== hoverCard) lastCard.style.transform = '';
                if (lastBtn && lastBtn !== hoverBtn) lastBtn.style.transform = '';
                if (lastTilt && lastTilt !== hoverCard) lastTilt.style.transform = '';

                if (hoverCard && cardRect) {
                    hoverCard.style.setProperty('--gx', (mx - cardRect.left) + 'px');
                    hoverCard.style.setProperty('--gy', (my - cardRect.top) + 'px');
                    /* damped tilt, project rows only */
                    if (hoverCard.classList.contains('project') && cardRect.width && cardRect.height) {
                        var fx = (mx - cardRect.left) / cardRect.width - 0.5;
                        var fy = (my - cardRect.top) / cardRect.height - 0.5;
                        hoverCard.style.transform = 'perspective(700px) rotateX(' +
                            (-fy * 1.5).toFixed(2) + 'deg) rotateY(' + (fx * 2).toFixed(2) + 'deg)';
                        lastTilt = hoverCard;
                    }
                }
                if (hoverBtn && btnRect) {
                    var relX = mx - btnRect.left - btnRect.width / 2;
                    var relY = my - btnRect.top - btnRect.height / 2;
                    hoverBtn.style.transform = 'translate(' +
                        (relX * 0.2).toFixed(1) + 'px,' + (relY * 0.28).toFixed(1) + 'px)';
                }
                lastCard = hoverCard;
                lastBtn = hoverBtn;
                pointerDirty = false;
            }

            /* packet easing — `translate`, never left/top: left/top are layout
               properties and writing them per frame forced a full document
               layout every frame (measured, then measured again at 0.00). */
            if (moved) {
                var dx = mx - px, dy = my - py;
                px += dx * 0.22;
                py += dy * 0.22;
                dot.style.translate = px + 'px ' + py + 'px';
                if (dot.style.opacity !== '') dot.style.opacity = '';
                /* Keep animating only while there is visible distance left;
                   below half a pixel nothing more would be drawn. */
                if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) schedule();
            }
        }

        /* The pointer can leave for the browser chrome without ever emitting a
           move over another element, which would otherwise strand the last
           hovered card mid-tilt. The per-element pointerleave listeners this
           replaces covered that case; this one covers it once. */
        document.addEventListener('pointerleave', function () {
            hoverCard = hoverBtn = null;
            ringKey = '';
            pointerDirty = true;
            schedule();
        }, { passive: true });

        /* click ping */
        document.addEventListener('pointerdown', function (e) {
            if (e.button !== 0 || (e.pointerType && e.pointerType !== 'mouse')) return;
            var ping = document.createElement('div');
            ping.className = 'cursor-ping';
            ping.style.left = e.clientX + 'px';
            ping.style.top = e.clientY + 'px';
            document.body.appendChild(ping);
            setTimeout(function () { if (ping.parentNode) ping.parentNode.removeChild(ping); }, 500);
        }, { passive: true });

        schedule();
    });

})();
