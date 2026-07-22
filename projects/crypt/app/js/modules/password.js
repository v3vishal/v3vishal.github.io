// crypt // sec-ops — password lab (real engine)
window.App = window.App || {};

App.password = (() => {
  const { $, randInt, randBytes, sha, fmtCrackTime, esc, copy } = App.utils;
  let isLoaded = false;
  let analyseTimer = null;
  let lastScore = 0;

  // ----- Charset detection -----
  const detectCharset = (pw) => {
    let size = 0;
    if (/[a-z]/.test(pw)) size += 26;
    if (/[A-Z]/.test(pw)) size += 26;
    if (/[0-9]/.test(pw)) size += 10;
    if (/[^a-zA-Z0-9]/.test(pw)) size += 33;
    return size || 1;
  };

  // ----- Penalty detection (zxcvbn-style heuristics) -----
  const detectIssues = (pw) => {
    const issues = [];
    const lower = pw.toLowerCase();

    // 1. Repeats: aaa, 111
    if (/(.)\1{2,}/.test(pw))
      issues.push({ label: 'character repeated 3+ times', penalty: 0.45 });

    // 2. Numeric run
    if (/\b(?:0123|1234|2345|3456|4567|5678|6789|01234|12345|23456|34567|45678|56789)\b/.test(pw))
      issues.push({ label: 'sequential digits', penalty: 0.4 });

    // 3. Alpha run
    if (/(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i.test(pw))
      issues.push({ label: 'sequential letters', penalty: 0.4 });

    // 4. Keyboard rows
    for (const row of App.data.keyboard_rows) {
      for (let len = 4; len <= 6 && len <= row.length; len++) {
        for (let i = 0; i <= row.length - len; i++) {
          const slice = row.slice(i, i + len);
          if (lower.includes(slice)) {
            issues.push({ label: `keyboard run "${slice}"`, penalty: 0.4 });
            i = row.length; break;
          }
        }
      }
    }

    // 5. Year / date hints
    if (/\b(19|20)\d{2}\b/.test(pw))
      issues.push({ label: 'year fragment (1900-2099)', penalty: 0.2 });

    // 6. Dictionary word in top10k
    const list = (window.App.rockyouTop || App.data.common_passwords);
    if (list.includes(lower)) {
      issues.push({ label: 'exact match in rockyou-top10k', penalty: 0.95 });
    } else if (lower.length >= 4) {
      // contains common word
      const probe = list.find(w => w.length >= 4 && lower.includes(w) && w !== lower);
      if (probe) issues.push({ label: `contains common word "${probe}"`, penalty: 0.55 });
    }

    // 7. l33t-substituted dictionary
    const unleet = lower
      .replace(/4/g, 'a').replace(/@/g, 'a')
      .replace(/3/g, 'e').replace(/1/g, 'i')
      .replace(/!/g, 'i').replace(/0/g, 'o')
      .replace(/5/g, 's').replace(/\$/g, 's')
      .replace(/7/g, 't');
    if (unleet !== lower && list.includes(unleet))
      issues.push({ label: `leetspeak of common word "${unleet}"`, penalty: 0.85 });

    return issues;
  };

  const analyse = (pw) => {
    if (!pw) return blank();

    const charset = detectCharset(pw);
    const rawEntropy = pw.length * Math.log2(charset);
    const issues = detectIssues(pw);
    const totalPenalty = Math.min(0.95, issues.reduce((s, i) => s + i.penalty, 0));
    const effectiveEntropy = rawEntropy * (1 - totalPenalty);

    // Attempts per second (offline GPU MD5-style) ~ 1e10
    const attempts = 2 ** effectiveEntropy;
    const offlineSec = attempts / 1e10;
    const onlineSec = attempts / 1000;

    // Level 0-4 like zxcvbn
    let level;
    if (effectiveEntropy < 24) level = 0;
    else if (effectiveEntropy < 36) level = 1;
    else if (effectiveEntropy < 50) level = 2;
    else if (effectiveEntropy < 70) level = 3;
    else level = 4;

    // 0-100 score
    const score = Math.max(0, Math.min(100, Math.round(effectiveEntropy * 1.4)));

    return {
      length: pw.length,
      charset,
      rawEntropy,
      effectiveEntropy,
      issues,
      level,
      score,
      crackOffline: fmtCrackTime(offlineSec),
      crackOnline: fmtCrackTime(onlineSec)
    };
  };

  const blank = () => ({
    length: 0, charset: 0, rawEntropy: 0, effectiveEntropy: 0,
    issues: [], level: 0, score: 0,
    crackOffline: '—', crackOnline: '—'
  });

  // ----- Generator: CSPRNG -----
  const generate = (opts) => {
    let pool = '';
    if (opts.upper) pool += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (opts.lower) pool += 'abcdefghijklmnopqrstuvwxyz';
    if (opts.digits) pool += '0123456789';
    if (opts.symbols) pool += '!@#$%^&*()-_=+[]{}<>?/,.';
    if (opts.excludeAmbiguous) pool = pool.replace(/[0O1lI|`'"]/g, '');
    if (!pool) return '';
    let out = '';
    for (let i = 0; i < opts.length; i++) {
      out += pool.charAt(randInt(pool.length));
    }
    return out;
  };

  const generateDiceware = (words, separator = '-') => {
    const list = App.data.diceware;
    const parts = [];
    for (let i = 0; i < words; i++) parts.push(list[randInt(list.length)]);
    return parts.join(separator);
  };

  // ----- Render -----
  const load = () => {
    const view = $('#password-view');
    if (!view || isLoaded) return;

    view.innerHTML = `
      <div class="view-headerline">
        <h1 class="view-title">// password lab</h1>
        <div class="view-meta">engine: zxcvbn-style + rockyou-top10k · csprng generation</div>
        <div class="view-actions">
          <button class="brkbtn" id="pw-deep-scan">[ deep scan ]</button>
        </div>
      </div>

      <div class="tool">
        <div class="panel">
          <header class="panel-head">
            <span class="panel-tag">[ 01 ]</span>
            <h2>analyse</h2>
            <span class="panel-state" id="pw-state">awaiting input</span>
          </header>
          <div class="field">
            <label class="field-label" for="pw-input">password</label>
            <div class="input-row">
              <input class="input" type="password" id="pw-input" placeholder="type or paste a candidate" autocomplete="off" spellcheck="false">
              <button class="brkbtn" id="pw-reveal">[ ◑ ]</button>
            </div>
          </div>

          <div class="meter-strip" id="pw-meter">${'<span></span>'.repeat(20)}</div>
          <div class="flex between" style="align-items:baseline;">
            <span class="strength-label" id="pw-label" data-level="0">UNKNOWN</span>
            <span class="muted">score <span id="pw-score">000</span>/100</span>
          </div>

          <hr class="divider">

          <div class="checks" id="pw-checks">
            ${[
              ['len',   'min length 12 characters'],
              ['upper', 'uppercase a–z'],
              ['lower', 'lowercase a–z'],
              ['digit', 'digits 0–9'],
              ['sym',   'symbols (33-char OWASP set)'],
              ['uniq',  'no triple-repeat character'],
              ['seq',   'no sequential / keyboard run'],
              ['dict',  'not in rockyou top-10k'],
            ].map(([k, label]) => `
              <div class="check-row" id="chk-${k}">
                <span class="mark">[ ]</span>
                <span>${label}</span>
                <span class="muted mark"></span>
              </div>`).join('')}
          </div>
        </div>

        <div class="tool-stack">
          <div class="panel">
            <header class="panel-head">
              <span class="panel-tag">[ 02 ]</span>
              <h2>diagnostics</h2>
              <span class="panel-state">live</span>
            </header>
            <div class="kv-list" id="pw-kv">
              <div class="kv"><span class="kv-k">length</span><span class="kv-v" id="kv-length">0</span></div>
              <div class="kv"><span class="kv-k">charset size</span><span class="kv-v" id="kv-charset">0</span></div>
              <div class="kv"><span class="kv-k">raw entropy</span><span class="kv-v" id="kv-raw">0.0 bits</span></div>
              <div class="kv"><span class="kv-k">effective entropy</span><span class="kv-v" id="kv-eff">0.0 bits</span></div>
              <div class="kv"><span class="kv-k">offline crack (1e10/s)</span><span class="kv-v" id="kv-crackoff">—</span></div>
              <div class="kv"><span class="kv-k">online crack (1k/s)</span><span class="kv-v" id="kv-crackon">—</span></div>
              <div class="kv"><span class="kv-k">issues detected</span><span class="kv-v mute" id="kv-issues">none</span></div>
              <div class="kv"><span class="kv-k">breach status</span><span class="kv-v mute" id="kv-breach">not checked</span></div>
            </div>
          </div>

          <div class="panel">
            <header class="panel-head">
              <span class="panel-tag">[ 03 ]</span>
              <h2>generator</h2>
              <span class="panel-state" id="gen-state">csprng</span>
            </header>
            <div class="tabs">
              <button class="tab active" data-gen="random">random</button>
              <button class="tab" data-gen="diceware">diceware</button>
            </div>

            <div id="gen-random" class="gen-pane">
              <div class="field">
                <label class="field-label">length: <span class="mono" id="gen-len-value">20</span></label>
                <input type="range" id="gen-len" class="range" min="8" max="64" value="20">
              </div>
              <div class="group-stack">
                <label class="check"><input type="checkbox" id="gen-upper" checked><span class="glyph"></span><span class="label">uppercase a–z</span></label>
                <label class="check"><input type="checkbox" id="gen-lower" checked><span class="glyph"></span><span class="label">lowercase a–z</span></label>
                <label class="check"><input type="checkbox" id="gen-digit" checked><span class="glyph"></span><span class="label">digits 0–9</span></label>
                <label class="check"><input type="checkbox" id="gen-sym" checked><span class="glyph"></span><span class="label">symbols</span></label>
                <label class="check"><input type="checkbox" id="gen-amb"><span class="glyph"></span><span class="label">exclude ambiguous (0 O 1 l I)</span></label>
              </div>
            </div>

            <div id="gen-diceware" class="gen-pane hidden">
              <div class="field">
                <label class="field-label">words: <span class="mono" id="dw-len-value">5</span></label>
                <input type="range" id="dw-len" class="range" min="3" max="10" value="5">
              </div>
              <div class="field">
                <label class="field-label">separator</label>
                <select class="select" id="dw-sep">
                  <option value="-">- (dash)</option>
                  <option value=".">. (dot)</option>
                  <option value=" ">space</option>
                  <option value="_">_ (underscore)</option>
                </select>
              </div>
            </div>

            <hr class="divider">

            <div class="input-row">
              <input class="input" id="gen-out" readonly placeholder="press generate">
              <button class="brkbtn" id="gen-copy">[ copy ]</button>
            </div>
            <div style="height:8px"></div>
            <button class="brkbtn primary block" id="gen-go">[ generate ]</button>
          </div>
        </div>
      </div>
    `;

    bind();
    isLoaded = true;
    render(blank());
  };

  const bind = () => {
    const input = $('#pw-input');
    input.addEventListener('input', () => {
      const value = input.value;
      clearTimeout(analyseTimer);
      analyseTimer = setTimeout(() => {
        const r = analyse(value);
        render(r);
        if (value && r.score !== lastScore) {
          lastScore = r.score;
          App.log.event('pwd', `analysed (score ${r.score}/100, ${r.level + 1}/5)`,
            { severity: r.level >= 3 ? 'ok' : r.level >= 2 ? 'warn' : 'bad',
              meta: { entropy: r.effectiveEntropy.toFixed(1) } });
          App.dashboard?.refresh?.();
        }
      }, 90);
    });

    $('#pw-reveal').addEventListener('click', () => {
      input.type = input.type === 'password' ? 'text' : 'password';
    });

    $('#pw-deep-scan').addEventListener('click', deepScan);

    // Generator
    const lenRange = $('#gen-len');
    const lenValue = $('#gen-len-value');
    lenRange.addEventListener('input', () => lenValue.textContent = lenRange.value);

    const dwRange = $('#dw-len');
    const dwValue = $('#dw-len-value');
    dwRange.addEventListener('input', () => dwValue.textContent = dwRange.value);

    $('#gen-go').addEventListener('click', runGen);
    $('#gen-copy').addEventListener('click', () => {
      const v = $('#gen-out').value;
      if (v) copy(v);
    });

    document.querySelectorAll('[data-gen]').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('[data-gen]').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        const mode = b.getAttribute('data-gen');
        $('#gen-random').classList.toggle('hidden', mode !== 'random');
        $('#gen-diceware').classList.toggle('hidden', mode !== 'diceware');
        $('#gen-state').textContent = mode === 'diceware' ? 'csprng · diceware' : 'csprng';
      });
    });
  };

  const runGen = () => {
    const isDice = $('#gen-diceware') && !$('#gen-diceware').classList.contains('hidden');
    let pw;
    if (isDice) {
      pw = generateDiceware(parseInt($('#dw-len').value, 10), $('#dw-sep').value);
    } else {
      pw = generate({
        length: parseInt($('#gen-len').value, 10),
        upper: $('#gen-upper').checked,
        lower: $('#gen-lower').checked,
        digits: $('#gen-digit').checked,
        symbols: $('#gen-sym').checked,
        excludeAmbiguous: $('#gen-amb').checked
      });
    }
    if (!pw) {
      App.ui.toast('gen', 'select at least one character class', 'warning');
      return;
    }
    $('#gen-out').value = pw;
    $('#pw-input').value = pw;
    $('#pw-input').type = 'text';
    const r = analyse(pw);
    render(r);
    App.log.event('pwd', `generated ${isDice ? 'passphrase' : 'password'} (${pw.length} ch, score ${r.score})`,
      { severity: 'ok', meta: { mode: isDice ? 'diceware' : 'random' } });
    App.dashboard?.refresh?.();
    App.ui.toast('gen', 'password generated', 'success');
  };

  // ----- Deep scan: stream rockyou.txt remotely -----
  let deepCache = null; // cached Set if we've already loaded
  const ROCKYOU_URL = 'https://github.com/brannondorsey/naive-hashcat/releases/download/data/rockyou.txt';

  const deepScan = async () => {
    const pw = $('#pw-input').value;
    if (!pw) { App.ui.toast('deep', 'enter a password first', 'warning'); return; }

    // Fast path: in-memory cache or top10k
    if (deepCache && deepCache.has(pw)) {
      flagBreach(true, 'matched (cached rockyou full)');
      return;
    }
    if ((window.App.rockyouTop || []).includes(pw)) {
      flagBreach(true, 'matched in rockyou top-10k');
      return;
    }

    if (deepCache) { flagBreach(false, 'not found in rockyou full (cached)'); return; }

    App.ui.showOverlay('streaming rockyou (~138MB)');
    App.ui.setCmdState('deep scan', 'busy');
    try {
      const resp = await fetch(ROCKYOU_URL, { mode: 'cors' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const reader = resp.body.getReader();
      const decoder = new TextDecoder('latin1');
      const set = new Set();
      let buf = '';
      let bytes = 0;
      const total = parseInt(resp.headers.get('content-length'), 10) || 138e6;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.length;
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl);
          if (line) set.add(line);
          buf = buf.slice(nl + 1);
        }
        if (bytes % (4 * 1024 * 1024) < 65536) {
          const pct = Math.min(100, Math.round(100 * bytes / total));
          App.ui.setCmdState('deep scan ' + pct + '%', 'busy');
        }
      }
      if (buf) set.add(buf);
      deepCache = set;
      App.ui.hideOverlay();
      App.ui.setCmdState('idle');
      const hit = set.has(pw);
      flagBreach(hit, hit ? 'matched in rockyou full (' + set.size.toLocaleString() + ' entries)'
                          : 'not found in rockyou full (' + set.size.toLocaleString() + ' entries)');
    } catch (e) {
      console.error(e);
      App.ui.hideOverlay();
      App.ui.setCmdState('deep scan failed', 'bad');
      App.ui.toast('deep', 'fetch failed (CORS / network). top-10k still works.', 'error', 5000);
    }
  };

  const flagBreach = (hit, msg) => {
    const node = $('#kv-breach');
    if (!node) return;
    node.className = 'kv-v ' + (hit ? 'bad' : 'ok');
    node.textContent = msg;
    App.log.event('pwd', 'deep scan: ' + msg, { severity: hit ? 'bad' : 'ok' });
    App.ui.toast('deep', msg, hit ? 'warning' : 'success');
  };

  // ----- Render -----
  const render = (r) => {
    const meter = $('#pw-meter');
    if (meter) {
      const cells = meter.querySelectorAll('span');
      const on = Math.round((r.score / 100) * cells.length);
      const cls = r.level <= 1 ? 'on-bad' : r.level === 2 ? 'on-warn' : 'on';
      cells.forEach((c, i) => {
        c.className = i < on ? cls : '';
      });
    }
    $('#pw-label').textContent = ['CRITICAL','WEAK','OK','STRONG','VAULT'][r.level];
    $('#pw-label').setAttribute('data-level', r.level);
    $('#pw-score').textContent = String(r.score).padStart(3, '0');

    $('#kv-length').textContent = r.length;
    $('#kv-charset').textContent = r.charset + ' chars';
    $('#kv-raw').textContent = r.rawEntropy.toFixed(1) + ' bits';
    $('#kv-eff').textContent = r.effectiveEntropy.toFixed(1) + ' bits';
    $('#kv-crackoff').textContent = r.crackOffline;
    $('#kv-crackon').textContent = r.crackOnline;

    const issuesNode = $('#kv-issues');
    if (!r.issues.length) {
      issuesNode.className = 'kv-v mute';
      issuesNode.textContent = r.length ? 'none' : 'awaiting input';
    } else {
      issuesNode.className = 'kv-v bad';
      issuesNode.innerHTML = r.issues.map(i => '· ' + esc(i.label)).join('<br>');
    }

    // Update check rows
    const pw = $('#pw-input')?.value || '';
    const checks = {
      len:   pw.length >= 12,
      upper: /[A-Z]/.test(pw),
      lower: /[a-z]/.test(pw),
      digit: /\d/.test(pw),
      sym:   /[^a-zA-Z0-9]/.test(pw),
      uniq:  !/(.)\1{2,}/.test(pw),
      seq:   !r.issues.some(i => /sequential|keyboard/.test(i.label)),
      dict:  !r.issues.some(i => /rockyou|common word|leetspeak/.test(i.label))
    };
    for (const [k, v] of Object.entries(checks)) {
      const node = $('#chk-' + k);
      if (!node) continue;
      node.classList.toggle('pass', v && pw.length > 0);
      node.classList.toggle('fail', !v && pw.length > 0);
      const mark = node.querySelector('.mark');
      if (mark) mark.textContent = v && pw.length ? '[✓]' : (pw.length ? '[✗]' : '[ ]');
    }

    $('#pw-state').textContent = pw ? 'evaluating' : 'awaiting input';
  };

  const init = () => { /* lazy */ };

  return { init, load, refresh: () => isLoaded && render(analyse($('#pw-input')?.value || '')) };
})();
