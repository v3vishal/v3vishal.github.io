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
    if (algo === 'md5') return cryptoJsMd5(typeof text === 'string' ? text : bytesToBin(text));
    const digest = await crypto.subtle.digest(algos[algo], buf);
    return toHex(new Uint8Array(digest));
  };

  const cryptoJsMd5 = (text) => {
    // CryptoJS is already loaded as a CDN dep.
    return CryptoJS.MD5(text).toString(CryptoJS.enc.Hex);
  };

  const bytesToBin = (bytes) => {
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return s;
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
           sha, cryptoJsMd5, bytesToBin, fmtTime, fmtAgo, pad, fmtCrackTime,
           asciiBar, copy, copyByEl, esc };
})();
