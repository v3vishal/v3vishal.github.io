// crypt // sec-ops — shared utilities
window.App = window.App || {};

App.utils = (() => {

  // ----- DOM helpers -----
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const el = (tag, attrs = {}, ...kids) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (v === false || v == null) continue;
      else if (v === true) node.setAttribute(k, '');
      else node.setAttribute(k, v);
    }
    for (const kid of kids) {
      if (kid == null || kid === false) continue;
      node.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
    }
    return node;
  };

  // ----- Random + encoding -----
  const randBytes = (n) => {
    const a = new Uint8Array(n);
    crypto.getRandomValues(a);
    return a;
  };

  // unbiased random integer in [0, max)
  const randInt = (max) => {
    if (max <= 0) return 0;
    const range = 2 ** 32;
    const limit = range - (range % max);
    const a = new Uint32Array(1);
    let v;
    do { crypto.getRandomValues(a); v = a[0]; } while (v >= limit);
    return v % max;
  };

  const pickRandom = (arr) => arr[randInt(arr.length)];

  const toHex = (bytes) => Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const fromHex = (hex) => {
    const clean = hex.replace(/[^0-9a-f]/gi, '');
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i*2, 2), 16);
    return out;
  };

  const toB64 = (bytes) => btoa(String.fromCharCode(...bytes));
  const fromB64 = (b64) => {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  };

  // ----- Hashing via SubtleCrypto -----
  const sha = async (algo, text) => {
    const buf = typeof text === 'string'
      ? new TextEncoder().encode(text)
      : text;
    const algos = { md5: null, sha1: 'SHA-1', sha256: 'SHA-256', sha512: 'SHA-512' };
    // SubtleCrypto deliberately does not implement MD5 (it is broken, which
    // is exactly why this toolkit demonstrates it), so it is done by hand
    // below. Note this now hashes `buf` — the real bytes — in every branch.
    if (algo === 'md5') return md5Hex(buf);
    const digest = await crypto.subtle.digest(algos[algo], buf);
    return toHex(new Uint8Array(digest));
  };

  /* MD5 (RFC 1321), ~40 lines, operating directly on bytes.
     This replaces a 48KB crypto-js bundle pulled from a public CDN on every
     page load — with no Subresource Integrity attribute, so anyone able to
     tamper with that response could run arbitrary script inside a page whose
     entire premise is security tooling. It was loaded solely for this one
     function; everything else here already uses SubtleCrypto. Removing it
     also drops the app's last third-party request, which is what the rest of
     the site already promises (see tools/verify-nav.js).

     The previous version routed byte input through String.fromCharCode and
     let crypto-js UTF-8-encode it, which silently corrupted any byte above
     0x7F — hashing bytes directly fixes that too. Verified against the
     RFC 1321 test-suite vectors. */
  const MD5_S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  const MD5_K = (() => {
    const k = new Uint32Array(64);
    for (let i = 0; i < 64; i++) k[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296);
    return k;
  })();

  const md5Hex = (bytes) => {
    const len = bytes.length;
    const withOne = len + 1;
    const total = withOne + ((56 - (withOne % 64)) + 64) % 64 + 8;
    const m = new Uint8Array(total);
    m.set(bytes);
    m[len] = 0x80;
    const bitLen = len * 8;
    const lo = bitLen >>> 0;
    const hi = Math.floor(bitLen / 4294967296) >>> 0;
    for (let i = 0; i < 4; i++) {
      m[total - 8 + i] = (lo >>> (i * 8)) & 0xff;
      m[total - 4 + i] = (hi >>> (i * 8)) & 0xff;
    }

    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    const M = new Uint32Array(16);
    for (let off = 0; off < total; off += 64) {
      for (let i = 0; i < 16; i++) {
        const j = off + i * 4;
        M[i] = (m[j] | (m[j + 1] << 8) | (m[j + 2] << 16) | (m[j + 3] << 24)) >>> 0;
      }
      let A = a0, B = b0, C = c0, D = d0;
      for (let i = 0; i < 64; i++) {
        let F, g;
        if (i < 16)      { F = (B & C) | (~B & D);  g = i; }
        else if (i < 32) { F = (D & B) | (~D & C);  g = (5 * i + 1) % 16; }
        else if (i < 48) { F = B ^ C ^ D;           g = (3 * i + 5) % 16; }
        else             { F = C ^ (B | ~D);        g = (7 * i) % 16; }
        F = (F + A + MD5_K[i] + M[g]) >>> 0;
        A = D; D = C; C = B;
        const s = MD5_S[i];
        B = (B + (((F << s) | (F >>> (32 - s))) >>> 0)) >>> 0;
      }
      a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0;
      c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
    }

    let hex = '';
    for (const v of [a0, b0, c0, d0]) {
      for (let i = 0; i < 4; i++) hex += ((v >>> (i * 8)) & 0xff).toString(16).padStart(2, '0');
    }
    return hex;
  };

  // ----- Format -----
  const fmtTime = (ts) => {
    const d = new Date(ts);
    return d.toTimeString().slice(0, 8);
  };
  const fmtAgo = (ts) => {
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 5) return 'now';
    if (sec < 60) return sec + 's ago';
    if (sec < 3600) return Math.floor(sec / 60) + 'm ago';
    if (sec < 86400) return Math.floor(sec / 3600) + 'h ago';
    return Math.floor(sec / 86400) + 'd ago';
  };
  const pad = (n, w = 2, ch = '0') => String(n).padStart(w, ch);

  const fmtCrackTime = (seconds) => {
    if (!isFinite(seconds) || seconds > 31536000 * 1e6) return 'effectively never';
    if (seconds < 0.001) return '< 1 ms';
    if (seconds < 1) return Math.round(seconds * 1000) + ' ms';
    if (seconds < 60) return Math.round(seconds) + ' sec';
    if (seconds < 3600) return Math.round(seconds / 60) + ' min';
    if (seconds < 86400) return Math.round(seconds / 3600) + ' hr';
    if (seconds < 31536000) return Math.round(seconds / 86400) + ' days';
    if (seconds < 31536000 * 1000) return Math.round(seconds / 31536000) + ' yrs';
    return Math.round(seconds / 31536000 / 1000) + 'k yrs';
  };

  // ----- ASCII bar -----
  const asciiBar = (value, width = 32, max = 1) => {
    const v = Math.max(0, Math.min(1, value / (max || 1)));
    const on = Math.round(v * width);
    return '█'.repeat(on) + '░'.repeat(width - on);
  };

  // ----- Clipboard -----
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      App.ui && App.ui.toast('clipboard', 'copied to clipboard', 'success');
      return true;
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); App.ui && App.ui.toast('clipboard', 'copied', 'success'); }
      catch { App.ui && App.ui.toast('clipboard', 'copy failed', 'error'); }
      document.body.removeChild(ta);
      return false;
    }
  };

  const copyByEl = (id) => {
    const e = typeof id === 'string' ? document.getElementById(id) : id;
    if (e) copy(e.value != null ? e.value : e.textContent);
  };

  // ----- Tiny escape for safely injecting user text -----
  const esc = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  return { $, $$, el, randBytes, randInt, pickRandom, toHex, fromHex, toB64, fromB64,
           sha, md5Hex, fmtTime, fmtAgo, pad, fmtCrackTime,
           asciiBar, copy, copyByEl, esc };
})();
