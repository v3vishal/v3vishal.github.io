// crypt // sec-ops — hash inspector (real)
window.App = window.App || {};

App.hash = (() => {
  const { $, esc, copy, sha } = App.utils;
  let isLoaded = false;

  // ----- Detection -----
  const detect = (s) => {
    s = s.trim();
    if (!s) return { type: 'empty', confidence: 0, length: 0, breakable: false };
    if (/^\$2[aby]?\$/.test(s))   return { type: 'bcrypt', confidence: 100, length: s.length, breakable: false, family: 'modern', note: 'PBKDF, GPU-resistant cost factor' };
    if (/^\$argon2/.test(s))      return { type: 'argon2', confidence: 100, length: s.length, breakable: false, family: 'modern', note: 'memory-hard PBKDF, gold standard' };
    if (/^\$1\$/.test(s))         return { type: 'md5-crypt', confidence: 100, length: s.length, breakable: true, family: 'legacy', note: 'broken since ~2008' };
    if (/^\$6\$/.test(s))         return { type: 'sha512-crypt', confidence: 100, length: s.length, breakable: false, family: 'modern' };
    if (/^\$5\$/.test(s))         return { type: 'sha256-crypt', confidence: 100, length: s.length, breakable: false, family: 'modern' };

    const hex = s.match(/^[a-f0-9]+$/i);
    if (!hex) return { type: 'unknown', confidence: 0, length: s.length, breakable: false, family: 'unknown' };

    const map = {
      32:  { type: 'MD5',     family: 'broken', breakable: true,  note: 'collisions practical since 2004' },
      40:  { type: 'SHA-1',   family: 'broken', breakable: true,  note: 'SHAttered collision 2017' },
      56:  { type: 'SHA-224', family: 'ok',     breakable: false, note: 'no key derivation; fast hash' },
      64:  { type: 'SHA-256', family: 'ok',     breakable: true,  note: 'fast hash — vulnerable to dictionary attack against passwords' },
      96:  { type: 'SHA-384', family: 'ok',     breakable: false },
      128: { type: 'SHA-512', family: 'ok',     breakable: true,  note: 'still a fast hash; not safe for passwords' }
    };
    const meta = map[s.length] || { type: 'hex string (' + s.length + ' chars)', family: 'unknown', breakable: false };
    return { ...meta, confidence: meta.type.includes('hex string') ? 30 : 95, length: s.length };
  };

  // ----- Generation -----
  const generateAll = async (text) => ({
    md5:    await sha('md5', text),
    sha1:   await sha('sha1', text),
    sha256: await sha('sha256', text),
    sha512: await sha('sha512', text)
  });

  // ----- Crack: dictionary attack against rockyou-top10k -----
  const crackTop10k = async (hash, algo) => {
    const list = window.App.rockyouTop || [];
    const target = hash.toLowerCase();
    let scanned = 0;
    const stride = 500;
    while (scanned < list.length) {
      for (let i = scanned; i < Math.min(scanned + stride, list.length); i++) {
        const candidate = list[i];
        /* sha() now covers md5 too, so the algorithm no longer needs a
           special case here. */
        const h = await sha(algo, candidate);
        if (h.toLowerCase() === target) return { found: true, plaintext: candidate, scanned: i + 1 };
      }
      scanned += stride;
      App.ui.setCmdState('crack ' + Math.round(100 * scanned / list.length) + '%', 'busy');
      await new Promise(r => setTimeout(r, 0)); // yield
    }
    return { found: false, scanned: list.length };
  };

  // ----- View -----
  const load = () => {
    const view = $('#hash-view');
    if (!view || isLoaded) return;

    view.innerHTML = `
      <div class="view-headerline">
        <h1 class="view-title">// hash inspector</h1>
        <div class="view-meta">WebCrypto + in-page MD5 · dictionary crack against rockyou-top10k</div>
      </div>

      <div class="tabs">
        <button class="tab active" data-htab="identify">identify</button>
        <button class="tab" data-htab="generate">generate</button>
      </div>

      <div id="htab-identify">
        <div class="tool">
          <div class="panel">
            <header class="panel-head">
              <span class="panel-tag">[ 01 ]</span>
              <h2>input hash</h2>
              <span class="panel-state" id="h-state">awaiting input</span>
            </header>
            <div class="field">
              <label class="field-label">hash to fingerprint</label>
              <textarea class="textarea code" id="h-input" placeholder="paste hash (md5, sha-*, bcrypt, argon2…)" spellcheck="false"></textarea>
            </div>
            <button class="brkbtn primary block" id="h-go">identify</button>
            <div style="height:10px"></div>
            <div class="muted" style="font-size:11px">
              quick samples:
              <button class="brkbtn" data-sample="md5">md5</button>
              <button class="brkbtn" data-sample="sha1">sha1</button>
              <button class="brkbtn" data-sample="sha256">sha256</button>
              <button class="brkbtn" data-sample="bcrypt">bcrypt</button>
            </div>
          </div>

          <div class="panel">
            <header class="panel-head">
              <span class="panel-tag">[ 02 ]</span>
              <h2>fingerprint</h2>
              <span class="panel-state" id="h-conf">--</span>
            </header>
            <div class="kv-list" id="h-kv">
              <div class="kv"><span class="kv-k">type</span><span class="kv-v mute" id="hk-type">—</span></div>
              <div class="kv"><span class="kv-k">family</span><span class="kv-v mute" id="hk-fam">—</span></div>
              <div class="kv"><span class="kv-k">length</span><span class="kv-v mute" id="hk-len">—</span></div>
              <div class="kv"><span class="kv-k">confidence</span><span class="kv-v mute" id="hk-cf">—</span></div>
              <div class="kv"><span class="kv-k">crack candidate</span><span class="kv-v mute" id="hk-crack">—</span></div>
              <div class="kv"><span class="kv-k">note</span><span class="kv-v mute" id="hk-note">—</span></div>
            </div>
            <div style="height:14px"></div>
            <button class="brkbtn warn block" id="h-crack" disabled>dictionary attack</button>
            <div id="h-crack-result"></div>
          </div>
        </div>
      </div>

      <div id="htab-generate" class="hidden">
        <div class="tool">
          <div class="panel">
            <header class="panel-head">
              <span class="panel-tag">[ 01 ]</span>
              <h2>hash factory</h2>
              <span class="panel-state">subtle-crypto</span>
            </header>
            <div class="field">
              <label class="field-label">input text</label>
              <textarea class="textarea" id="hg-input" placeholder="text to hash" spellcheck="false"></textarea>
            </div>
            <button class="brkbtn primary block" id="hg-go">compute all</button>
          </div>

          <div class="panel">
            <header class="panel-head">
              <span class="panel-tag">[ 02 ]</span>
              <h2>digests</h2>
              <span class="panel-state">hex</span>
            </header>
            <div class="kv-list" id="hg-out">
              <div class="kv"><span class="kv-k">md5</span><span class="kv-v code" id="hg-md5">—</span></div>
              <div class="kv"><span class="kv-k">sha-1</span><span class="kv-v code" id="hg-sha1">—</span></div>
              <div class="kv"><span class="kv-k">sha-256</span><span class="kv-v code" id="hg-sha256">—</span></div>
              <div class="kv"><span class="kv-k">sha-512</span><span class="kv-v code" id="hg-sha512">—</span></div>
            </div>
            <div style="height:10px"></div>
            <button class="brkbtn block" id="hg-copy">copy all (json)</button>
          </div>
        </div>
      </div>
    `;

    bind();
    isLoaded = true;
  };

  const bind = () => {
    document.querySelectorAll('[data-htab]').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('[data-htab]').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        const t = b.getAttribute('data-htab');
        $('#htab-identify').classList.toggle('hidden', t !== 'identify');
        $('#htab-generate').classList.toggle('hidden', t !== 'generate');
      });
    });

    document.querySelectorAll('[data-sample]').forEach(b => {
      b.addEventListener('click', () => {
        const k = b.getAttribute('data-sample');
        $('#h-input').value = App.data.hash_examples[k] || '';
      });
    });

    $('#h-go').addEventListener('click', runIdentify);
    $('#h-crack').addEventListener('click', runCrack);
    $('#hg-go').addEventListener('click', runGen);
    $('#hg-copy').addEventListener('click', copyGen);
  };

  let lastDetected = null;

  const runIdentify = () => {
    const raw = $('#h-input').value.trim();
    if (!raw) { App.ui.toast('hash', 'enter a hash first', 'warning'); return; }
    const d = detect(raw);
    lastDetected = { raw, ...d };

    $('#hk-type').textContent = d.type;
    $('#hk-fam').textContent  = d.family || '—';
    $('#hk-len').textContent  = d.length + ' chars';
    $('#hk-cf').textContent   = d.confidence + '%';
    $('#hk-note').textContent = d.note || '—';

    const familyClass = d.family === 'broken' ? 'bad'
                     : d.family === 'legacy' ? 'warn'
                     : d.family === 'modern' ? 'ok'
                     : 'mute';
    $('#hk-fam').className = 'kv-v ' + familyClass;
    $('#hk-note').className = 'kv-v ' + (d.family === 'broken' ? 'bad' : 'mute');

    const crackable = ['MD5','SHA-1','SHA-256','SHA-512','md5-crypt'].includes(d.type);
    $('#hk-crack').textContent = crackable ? 'yes (dictionary attack possible)' : 'no (slow PBKDF or unknown)';
    $('#hk-crack').className = 'kv-v ' + (crackable ? 'warn' : 'ok');
    $('#h-crack').disabled = !crackable;
    $('#h-conf').textContent = d.confidence + '% confidence';

    App.log.event('hash', `identified as ${d.type}`,
      { severity: d.family === 'broken' ? 'bad' : 'info',
        meta: { type: d.type, family: d.family } });
    App.dashboard?.refresh?.();
  };

  const runCrack = async () => {
    if (!lastDetected) return;
    const algoMap = { 'MD5': 'md5', 'SHA-1': 'sha1', 'SHA-256': 'sha256', 'SHA-512': 'sha512' };
    const algo = algoMap[lastDetected.type];
    if (!algo) { App.ui.toast('hash', 'unsupported algo for dictionary attack', 'warning'); return; }

    const out = $('#h-crack-result');
    out.innerHTML = '<div class="ascii-progress" id="h-crack-progress">scanning rockyou-top10k…</div>';
    App.ui.setCmdState('cracking', 'busy');
    $('#h-crack').disabled = true;

    const result = await crackTop10k(lastDetected.raw, algo);
    App.ui.setCmdState('idle');
    $('#h-crack').disabled = false;

    if (result.found) {
      out.innerHTML = `
        <div class="result" style="margin-top:10px;">
          <span class="tag" style="color:var(--crimson)">CRACKED</span><br><br>
          plaintext: <span class="mono" style="color:var(--crimson)">${esc(result.plaintext)}</span><br>
          tried ${result.scanned.toLocaleString()} candidates · this hash is in rockyou.
        </div>`;
      App.log.event('hash', `cracked ${lastDetected.type} → ${result.plaintext}`,
        { severity: 'bad', meta: { plaintext: result.plaintext, scanned: result.scanned } });
      App.ui.toast('crack', 'plaintext recovered: ' + result.plaintext, 'warning', 5000);
    } else {
      out.innerHTML = `
        <div class="result" style="margin-top:10px;">
          <span class="tag" style="color:var(--phosphor)">RESILIENT</span><br><br>
          no match in ${result.scanned.toLocaleString()} top candidates.<br>
          this only proves <em>top-10k miss</em>; full rockyou (14M) might still hit.
        </div>`;
      App.log.event('hash', `no match for ${lastDetected.type} in top-10k`,
        { severity: 'ok', meta: { scanned: result.scanned } });
    }
    App.dashboard?.refresh?.();
  };

  let lastGen = null;
  const runGen = async () => {
    const txt = $('#hg-input').value;
    if (!txt) { App.ui.toast('hash', 'enter text first', 'warning'); return; }
    const all = await generateAll(txt);
    lastGen = all;
    $('#hg-md5').textContent = all.md5;
    $('#hg-sha1').textContent = all.sha1;
    $('#hg-sha256').textContent = all.sha256;
    $('#hg-sha512').textContent = all.sha512;
    App.log.event('hash', `generated digests for "${txt.length} ch" input`, { severity: 'info' });
    App.dashboard?.refresh?.();
  };

  const copyGen = () => {
    if (!lastGen) { App.ui.toast('hash', 'nothing to copy', 'warning'); return; }
    copy(JSON.stringify(lastGen, null, 2));
  };

  const init = () => {};
  return { init, load };
})();
