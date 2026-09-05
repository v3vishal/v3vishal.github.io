// crypt // sec-ops — dashboard: lives off the activity log
window.App = window.App || {};

App.dashboard = (() => {
  const { $, esc, fmtAgo, fmtTime } = App.utils;
  let isLoaded = false;
  let refreshInterval = null;

  // Posture score: derived from log events
  const computePosture = () => {
    const events = App.log.all();
    const flags = [];

    // 1. Have any operations been run?
    if (!events.length) {
      flags.push({ type: 'pending', msg: 'no operations yet — interact with tools' });
      return { score: 0, flags };
    }

    // 2. Weak crypto detection
    const weakCipher = events.find(e => e.kind === 'encrypt' && /caesar|vigenere|xor/i.test(e.meta?.algo || ''));
    if (weakCipher) flags.push({ type: 'warn', msg: 'classical / xor cipher used (educational only)' });
    else if (events.some(e => e.kind === 'encrypt')) flags.push({ type: 'good', msg: 'aes-gcm used for encryption' });

    // 3. Weak passwords analysed
    const lastPwd = events.find(e => e.kind === 'pwd' && /score \d+/.test(e.message));
    if (lastPwd) {
      const m = lastPwd.message.match(/score (\d+)/);
      const s = m ? parseInt(m[1], 10) : 0;
      if (s < 40) flags.push({ type: 'bad', msg: `last password scored ${s}/100 — weak` });
      else if (s < 70) flags.push({ type: 'warn', msg: `last password scored ${s}/100 — middling` });
      else flags.push({ type: 'good', msg: `last password scored ${s}/100 — strong` });
    }

    // 4. Cracked hashes
    if (events.some(e => e.kind === 'hash' && /cracked/i.test(e.message)))
      flags.push({ type: 'bad', msg: 'cracked hash discovered (rockyou hit)' });

    // 5. Broken hash family identified
    if (events.some(e => e.kind === 'hash' && e.meta?.family === 'broken'))
      flags.push({ type: 'bad', msg: 'broken hash family encountered (md5 / sha-1)' });

    // 6. Threats analysed
    if (events.some(e => e.kind === 'threat' && /CRITICAL|HIGH/.test(e.message)))
      flags.push({ type: 'warn', msg: 'critical/high payloads observed' });

    // 7. Net headers
    const netEv = events.find(e => e.kind === 'net' && e.meta?.percent != null);
    if (netEv) {
      const p = netEv.meta.percent;
      if (p < 40) flags.push({ type: 'bad', msg: `last header audit: ${p}% posture` });
      else if (p < 75) flags.push({ type: 'warn', msg: `last header audit: ${p}% posture` });
      else flags.push({ type: 'good', msg: `last header audit: ${p}% posture` });
    }

    // 8. Phishing & Smishing scans
    const phishEv = events.find(e => e.kind === 'phish');
    if (phishEv) {
      if (phishEv.meta?.verdict === 'scam') flags.push({ type: 'bad', msg: `phishing detected: ${phishEv.meta?.score || 0}% scam risk` });
      else if (phishEv.meta?.verdict === 'suspicious') flags.push({ type: 'warn', msg: `suspicious message flagged: ${phishEv.meta?.score || 0}% risk` });
      else flags.push({ type: 'good', msg: 'clean message verified (safe)' });
    }

    // Numeric score: weighted sum
    let score = 65;
    for (const f of flags) {
      if (f.type === 'good') score += 7;
      else if (f.type === 'warn') score -= 8;
      else if (f.type === 'bad') score -= 15;
    }
    score = Math.max(0, Math.min(100, score));
    return { score, flags };
  };

  // Render everything
  const refresh = () => {
    if (!isLoaded) return;

    const { score, flags } = computePosture();
    const counts = App.log.countByKind();
    const sev = App.log.countBySeverity();
    const last = App.log.last();

    // Score panel
    $('#score-big').textContent = String(score).padStart(2, '0');
    const scoreBar = $('#score-bar');
    if (scoreBar) scoreBar.style.setProperty('--score', score + '%');
    $('#score-state').textContent = score >= 75 ? 'STRONG' : score >= 45 ? 'PARTIAL' : 'EXPOSED';

    const flagsList = $('#score-flags');
    if (flagsList) {
      const cls = { good: 'flag-good', warn: 'flag-warn', bad: 'flag-bad', pending: 'flag-pending' };
      flagsList.innerHTML = flags.length === 0
        ? '<li class="flag flag-pending"><span class="flag-mark">[·]</span> awaiting signal</li>'
        : flags.map(f =>
            `<li class="flag ${cls[f.type]}"><span class="flag-mark">[${f.type === 'good' ? '✓' : f.type === 'bad' ? '✗' : f.type === 'warn' ? '!' : '·'}]</span> ${esc(f.msg)}</li>`
          ).join('');
    }

    /* The top-bar INTEGRITY meter and THREAT level readout were fed from
       here. Both were functions of how many times you had used the tools —
       not of anything being measured — so they have been removed along with
       the markup. (This block also dereferenced #integrity-value with no null
       check, so it would have thrown the moment the element went away.) */

    // Threat ledger
    $('#th-crit').textContent = String(sev.crit).padStart(3, '0');
    $('#th-high').textContent = String(sev.high).padStart(3, '0');
    $('#th-med').textContent  = String(sev.med).padStart(3, '0');
    $('#th-low').textContent  = String(sev.low).padStart(3, '0');

    // Counters
    $('#ctr-encrypt').textContent = String(counts.encrypt).padStart(4, '0');
    $('#ctr-pwd').textContent     = String(counts.pwd).padStart(4, '0');
    $('#ctr-hash').textContent    = String(counts.hash).padStart(4, '0');
    $('#ctr-threat').textContent  = String(counts.threat).padStart(4, '0');
    $('#ctr-steg').textContent    = String(counts.steg).padStart(4, '0');
    const ctrPhish = $('#ctr-phish');
    if (ctrPhish) ctrPhish.textContent = String(counts.phish || 0).padStart(4, '0');
    $('#ctr-last').textContent    = last ? fmtAgo(last.ts) : '—';

    /* Sidebar "TELEMETRY" (ops_run / threats / session) removed with its
       markup — same reason as the integrity meter above. */

    // Spark
    const buckets = App.log.bucketize(24, 32);
    const lines = [
      [' enc  ', buckets.encrypt || []],
      [' pwd  ', buckets.pwd || []],
      [' hash ', buckets.hash || []],
      [' thrt ', buckets.threat || []],
      [' phsh ', buckets.phish || []],
      [' steg ', buckets.steg || []],
    ];
    const out = lines.map(([label, arr]) => {
      const max = Math.max(1, ...arr);
      const row = arr.map(v => {
        const lvl = v / max;
        if (v === 0) return '░';
        if (lvl < 0.25) return '▁';
        if (lvl < 0.5)  return '▃';
        if (lvl < 0.75) return '▅';
        return '█';
      }).join('');
      const total = arr.reduce((a, b) => a + b, 0);
      return label + row + '  ' + total;
    }).join('\n');
    const spark = $('#sparkbox');
    if (spark) spark.textContent = out;

    // Feed
    const feed = $('#event-feed');
    if (feed) {
      const events = App.log.all().slice(0, 12);
      if (!events.length) {
        feed.innerHTML = '<li class="feed-empty">// no events. interact with any tool to populate.</li>';
      } else {
        const tagClass = { ok: 'tag-ok', warn: 'tag-warn', bad: 'tag-bad', info: '' };
        feed.innerHTML = events.map(e => `
          <li>
            <span class="feed-time">${fmtTime(e.ts)}</span>
            <span class="feed-tag ${tagClass[e.severity] || ''}">${(e.kind || 'evt').padEnd(6)}</span>
            <span class="feed-msg">${esc(e.message)}</span>
          </li>
        `).join('');
      }
    }
  };

  const load = () => {
    if (isLoaded) { refresh(); return; }
    isLoaded = true;
    refresh();
  };

  const init = () => {
    App.log.subscribe(() => { if (isLoaded) refresh(); });

    // Light heartbeat to update "last op" relative-time
    refreshInterval = setInterval(() => { if (isLoaded) refresh(); }, 15000);
  };

  return { init, load, refresh };
})();
