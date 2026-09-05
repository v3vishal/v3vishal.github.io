// crypt // sec-ops — central activity log + counters
// Every module funnels events through App.log.event(...).
// Dashboard derives all visible numbers from this log.

window.App = window.App || {};

App.log = (() => {
  const KEY = 'crypt.activity.v1';
  const LIMIT = 250;

  const TAG_COLORS = {
    ok: 'tag-ok', warn: 'tag-warn', bad: 'tag-bad', info: 'tag-info'
  };

  let entries = [];
  let listeners = [];

  const load = () => {
    try {
      const raw = localStorage.getItem(KEY);
      entries = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(entries)) entries = [];
    } catch (e) { entries = []; }
  };

  const persist = () => {
    try { localStorage.setItem(KEY, JSON.stringify(entries.slice(0, LIMIT))); } catch (e) {}
  };

  const event = (kind, message, opts = {}) => {
    const e = {
      ts: Date.now(),
      kind,                                   // 'encrypt' | 'pwd' | 'hash' | 'threat' | 'steg' | 'net'
      message,
      severity: opts.severity || 'info',      // 'ok' | 'warn' | 'bad' | 'info'
      meta: opts.meta || null
    };
    entries.unshift(e);
    if (entries.length > LIMIT) entries.length = LIMIT;
    persist();
    listeners.forEach(fn => { try { fn(e); } catch (err) {} });
    return e;
  };

  const all = () => entries.slice();

  const countByKind = () => {
    const c = { encrypt: 0, pwd: 0, hash: 0, threat: 0, steg: 0, net: 0, phish: 0 };
    for (const e of entries) if (c[e.kind] != null) c[e.kind]++;
    return c;
  };

  const countBySeverity = () => {
    const c = { crit: 0, high: 0, med: 0, low: 0 };
    for (const e of entries) {
      if (e.severity === 'bad') c.crit++;
      else if (e.severity === 'warn') c.high++;
      else if (e.severity === 'info') c.med++;
      else c.low++;
    }
    return c;
  };

  const clear = () => {
    entries = [];
    persist();
    listeners.forEach(fn => { try { fn(null); } catch (err) {} });
  };

  const subscribe = (fn) => {
    listeners.push(fn);
    return () => { listeners = listeners.filter(l => l !== fn); };
  };

  const last = () => entries[0] || null;

  // bucketize last N hours into M cells for sparklines
  const bucketize = (hours = 24, cells = 32) => {
    const now = Date.now();
    const span = hours * 3600 * 1000;
    const buckets = {};
    ['encrypt','pwd','hash','threat','phish','steg'].forEach(k => buckets[k] = new Array(cells).fill(0));
    for (const e of entries) {
      const age = now - e.ts;
      if (age < 0 || age > span) continue;
      if (!buckets[e.kind]) continue;
      const idx = Math.min(cells - 1, Math.floor((cells - 1) * (1 - age / span)));
      buckets[e.kind][idx]++;
    }
    return buckets;
  };

  load();
  return { event, all, countByKind, countBySeverity, clear, subscribe, last, bucketize, TAG_COLORS };
})();
