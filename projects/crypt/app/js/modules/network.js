// crypt // sec-ops — network forensics: HTTP header + CSP + JWT inspector
window.App = window.App || {};

App.network = (() => {
  const { $, esc } = App.utils;
  let isLoaded = false;

  // ---- Header analysis -----
  const SECURITY_HEADERS = [
    { name: 'Strict-Transport-Security', guidance: 'enforce HTTPS in browsers (HSTS)', critical: true,
      check: (v) => /max-age\s*=\s*\d+/i.test(v) && /\bincludesubdomains\b/i.test(v) ? 'strong'
                  : /max-age\s*=\s*\d+/i.test(v) ? 'partial' : 'weak' },
    { name: 'Content-Security-Policy', guidance: 'limits script / style sources, mitigates XSS', critical: true,
      check: (v) => /unsafe-inline|unsafe-eval/i.test(v) ? 'weak' : /default-src\s*'?self'?|default-src\s*'?none'?/i.test(v) ? 'strong' : 'partial' },
    { name: 'X-Frame-Options', guidance: 'clickjacking defence', critical: false,
      check: (v) => /deny|sameorigin/i.test(v) ? 'strong' : 'weak' },
    { name: 'X-Content-Type-Options', guidance: 'blocks MIME-sniff attacks', critical: false,
      check: (v) => /nosniff/i.test(v) ? 'strong' : 'weak' },
    { name: 'Referrer-Policy', guidance: 'limits referer leakage', critical: false,
      check: (v) => /no-referrer|strict-origin/i.test(v) ? 'strong' : 'partial' },
    { name: 'Permissions-Policy', guidance: 'restricts browser features (camera, geolocation, etc.)', critical: false,
      check: () => 'strong' },
    { name: 'Cross-Origin-Opener-Policy', guidance: 'process isolation against side-channel leaks', critical: false,
      check: (v) => /same-origin/i.test(v) ? 'strong' : 'partial' },
    { name: 'Cross-Origin-Embedder-Policy', guidance: 'pairs with COOP for full isolation', critical: false,
      check: (v) => /require-corp/i.test(v) ? 'strong' : 'partial' },
    { name: 'X-XSS-Protection', guidance: 'legacy header; modern browsers ignore', critical: false, deprecated: true,
      check: () => 'partial' },
    { name: 'Server',         guidance: 'avoid leaking server software/version', critical: false, leakInfo: true, check: () => 'leak' },
    { name: 'X-Powered-By',   guidance: 'avoid leaking backend (PHP, ASP.NET, etc.)', critical: false, leakInfo: true, check: () => 'leak' }
  ];

  const parseHeaders = (raw) => {
    const out = {};
    raw.split(/\r?\n/).forEach(line => {
      const m = line.match(/^([A-Za-z0-9-]+)\s*:\s*(.+)$/);
      if (m) {
        const k = m[1].toLowerCase();
        out[k] = (out[k] ? out[k] + ', ' : '') + m[2].trim();
      }
    });
    return out;
  };

  const analyseHeaders = (raw) => {
    const parsed = parseHeaders(raw);
    const findings = [];
    let score = 0, max = 0;

    for (const h of SECURITY_HEADERS) {
      const v = parsed[h.name.toLowerCase()];
      const present = v != null;
      let level = 'missing';
      if (present) level = h.check(v);
      if (h.leakInfo && present) level = 'leak';

      findings.push({ ...h, value: v || null, level });

      if (!h.leakInfo && !h.deprecated) {
        const weight = h.critical ? 3 : 1;
        max += weight;
        if (level === 'strong') score += weight;
        else if (level === 'partial') score += weight * 0.5;
      }
    }
    return { parsed, findings, score, max, percent: Math.round(100 * score / Math.max(1, max)) };
  };

  // ---- JWT decoder -----
  const decodeJwt = (token) => {
    const parts = token.trim().split('.');
    if (parts.length !== 3) throw new Error('JWT must have 3 dot-separated parts');
    const b64url = (s) => s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4);
    const header = JSON.parse(atob(b64url(parts[0])));
    const payload = JSON.parse(atob(b64url(parts[1])));
    return { header, payload, sig: parts[2] };
  };

  // ---- View ----
  const load = () => {
    const view = $('#network-view');
    if (!view || isLoaded) return;

    view.innerHTML = `
      <div class="view-headerline">
        <h1 class="view-title">// net forensics</h1>
        <div class="view-meta">header audit · jwt decoder · offline · paste curl output</div>
      </div>

      <div class="tabs">
        <button class="tab active" data-ntab="headers">headers</button>
        <button class="tab" data-ntab="jwt">jwt</button>
      </div>

      <div id="ntab-headers">
        <div class="tool">
          <div class="panel">
            <header class="panel-head">
              <span class="panel-tag">[ 01 ]</span>
              <h2>raw response headers</h2>
              <span class="panel-state">paste output of <code>curl -I</code></span>
            </header>
            <div class="field">
              <textarea class="textarea code" id="nh-input" style="min-height:240px" placeholder="HTTP/1.1 200 OK&#10;Server: nginx&#10;Strict-Transport-Security: max-age=31536000; includeSubDomains&#10;..."></textarea>
            </div>
            <div class="flex gap">
              <button class="brkbtn primary" id="nh-go">[ audit ]</button>
              <button class="brkbtn" id="nh-sample">[ load sample ]</button>
            </div>
          </div>

          <div class="panel">
            <header class="panel-head">
              <span class="panel-tag">[ 02 ]</span>
              <h2>posture report</h2>
              <span class="panel-state" id="nh-score">--%</span>
            </header>
            <div id="nh-result">
              <div class="result empty">// paste a response and click audit.</div>
            </div>
          </div>
        </div>
      </div>

      <div id="ntab-jwt" class="hidden">
        <div class="tool">
          <div class="panel">
            <header class="panel-head">
              <span class="panel-tag">[ 01 ]</span>
              <h2>token</h2>
              <span class="panel-state">decode only — no verification</span>
            </header>
            <div class="field">
              <label class="field-label">paste JWT</label>
              <textarea class="textarea code" id="nj-input" placeholder="eyJhbGciOi..."></textarea>
            </div>
            <button class="brkbtn primary block" id="nj-go">[ decode ]</button>
          </div>
          <div class="panel">
            <header class="panel-head">
              <span class="panel-tag">[ 02 ]</span>
              <h2>decoded</h2>
              <span class="panel-state" id="nj-state">none</span>
            </header>
            <div id="nj-result">
              <div class="result empty">// paste a JWT to decode.</div>
            </div>
          </div>
        </div>
      </div>
    `;

    bind();
    isLoaded = true;
  };

  const SAMPLE_HEADERS = `HTTP/2 200
server: nginx/1.18.0
content-type: text/html; charset=utf-8
strict-transport-security: max-age=31536000
x-frame-options: SAMEORIGIN
x-content-type-options: nosniff
content-security-policy: default-src 'self'; script-src 'self' 'unsafe-inline'
x-powered-by: Express`;

  const bind = () => {
    document.querySelectorAll('[data-ntab]').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('[data-ntab]').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        const t = b.getAttribute('data-ntab');
        $('#ntab-headers').classList.toggle('hidden', t !== 'headers');
        $('#ntab-jwt').classList.toggle('hidden', t !== 'jwt');
      });
    });

    $('#nh-go').addEventListener('click', runAudit);
    $('#nh-sample').addEventListener('click', () => { $('#nh-input').value = SAMPLE_HEADERS; });
    $('#nj-go').addEventListener('click', runJwt);
  };

  const runAudit = () => {
    const raw = $('#nh-input').value.trim();
    if (!raw) { App.ui.toast('net', 'paste headers first', 'warning'); return; }
    const r = analyseHeaders(raw);
    $('#nh-score').textContent = r.percent + '%';

    const rows = r.findings.map(f => {
      const colorMap = { strong: 'phosphor', partial: 'amber', weak: 'crimson', missing: 'crimson', leak: 'amber' };
      const color = colorMap[f.level] || 'fg-mute';
      const badge = { strong: 'OK', partial: 'WEAK', weak: 'BAD', missing: 'MISSING', leak: 'LEAK' }[f.level];
      return `<tr>
        <td><span class="tag" style="color:var(--${color})">${badge}</span></td>
        <td class="mono">${f.name}${f.critical ? ' <span class="muted">*</span>' : ''}</td>
        <td class="muted">${f.value ? esc(f.value.slice(0, 90)) : '—'}</td>
        <td class="muted">${esc(f.guidance)}</td>
      </tr>`;
    }).join('');

    $('#nh-result').innerHTML = `
      <table class="data-table">
        <thead><tr><th>state</th><th>header</th><th>value</th><th>purpose</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="muted" style="font-size:11px;margin-top:8px;">* = critical · score ${r.percent}% of essential headers configured</div>
    `;

    App.log.event('net', `header audit: ${r.percent}% posture`,
      { severity: r.percent >= 75 ? 'ok' : r.percent >= 40 ? 'warn' : 'bad',
        meta: { percent: r.percent } });
    App.dashboard?.refresh?.();
  };

  const runJwt = () => {
    const raw = $('#nj-input').value.trim();
    if (!raw) { App.ui.toast('net', 'paste a JWT', 'warning'); return; }
    try {
      const { header, payload, sig } = decodeJwt(raw);

      const warnings = [];
      if (header.alg === 'none') warnings.push('alg=none — signature verification disabled (CVE-class)');
      if (header.alg && /HS\d+/.test(header.alg)) warnings.push('HMAC alg — verify the secret has high entropy');
      if (payload.exp && payload.exp * 1000 < Date.now()) warnings.push('token expired at ' + new Date(payload.exp * 1000).toISOString());
      if (!payload.exp) warnings.push('no exp claim — non-expiring token');
      if (!payload.iss) warnings.push('no iss claim');

      const ts = (claim) => payload[claim]
        ? `${payload[claim]}  <span class="muted">(${new Date(payload[claim]*1000).toISOString()})</span>`
        : '—';

      $('#nj-result').innerHTML = `
        <div class="kv-list">
          <div class="kv"><span class="kv-k">algorithm</span><span class="kv-v ${header.alg==='none'?'bad':'ok'}">${esc(header.alg || '?')}</span></div>
          <div class="kv"><span class="kv-k">type</span><span class="kv-v">${esc(header.typ || '?')}</span></div>
          <div class="kv"><span class="kv-k">issuer</span><span class="kv-v">${esc(payload.iss || '—')}</span></div>
          <div class="kv"><span class="kv-k">subject</span><span class="kv-v">${esc(payload.sub || '—')}</span></div>
          <div class="kv"><span class="kv-k">issued at</span><span class="kv-v">${ts('iat')}</span></div>
          <div class="kv"><span class="kv-k">expires</span><span class="kv-v">${ts('exp')}</span></div>
          <div class="kv"><span class="kv-k">signature</span><span class="kv-v code">${esc(sig.slice(0, 32))}…</span></div>
        </div>
        <hr class="divider">
        <div class="muted" style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;">full payload (json)</div>
        <pre class="result" style="margin-top:6px;">${esc(JSON.stringify(payload, null, 2))}</pre>
        ${warnings.length ? `
        <hr class="divider">
        <div class="muted" style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;">warnings</div>
        <ul style="list-style:none;padding-left:0;font-size:12px;color:var(--amber);">
          ${warnings.map(w => '<li>⚠ ' + esc(w) + '</li>').join('')}
        </ul>` : ''}
      `;
      $('#nj-state').textContent = 'decoded';
      App.log.event('net', `decoded JWT (alg=${header.alg})`,
        { severity: warnings.length ? 'warn' : 'ok', meta: { alg: header.alg, warnings: warnings.length } });
      App.dashboard?.refresh?.();
    } catch (e) {
      $('#nj-result').innerHTML = `<div class="result empty">// ${esc(e.message)}</div>`;
      $('#nj-state').textContent = 'failed';
      App.ui.toast('net', e.message, 'error');
    }
  };

  const init = () => {};
  return { init, load };
})();
