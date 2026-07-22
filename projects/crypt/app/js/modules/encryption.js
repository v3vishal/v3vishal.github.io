// crypt // sec-ops — encryption hub (real AES + classical ciphers)
window.App = window.App || {};

App.encryption = (() => {
  const { $, toHex, fromHex, toB64, fromB64, randBytes, copy, esc } = App.utils;
  let isLoaded = false;
  let lastResult = null;
  let fileBytes = null;
  let fileName = null;

  // ---- WebCrypto-backed AES ----
  const deriveKey = async (passphrase, salt) => {
    const baseKey = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(passphrase),
      'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false, ['encrypt', 'decrypt']
    );
  };

  const aesEncrypt = async (plaintext, passphrase) => {
    const salt = randBytes(16);
    const iv = randBytes(12);
    const key = await deriveKey(passphrase, salt);
    const data = plaintext instanceof Uint8Array ? plaintext : new TextEncoder().encode(plaintext);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
    // Envelope: 0x01 | salt(16) | iv(12) | ct
    const env = new Uint8Array(1 + 16 + 12 + ct.length);
    env[0] = 0x01;
    env.set(salt, 1);
    env.set(iv, 17);
    env.set(ct, 29);
    return { envelope: env, salt, iv, ct };
  };

  const aesDecrypt = async (envelopeBytes, passphrase) => {
    if (envelopeBytes.length < 29 || envelopeBytes[0] !== 0x01) {
      throw new Error('not a crypt-aes-gcm envelope');
    }
    const salt = envelopeBytes.slice(1, 17);
    const iv = envelopeBytes.slice(17, 29);
    const ct = envelopeBytes.slice(29);
    const key = await deriveKey(passphrase, salt);
    try {
      const pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct));
      return { plaintext: pt, salt, iv };
    } catch (e) {
      throw new Error('decryption failed — wrong key or tampered ciphertext');
    }
  };

  // ---- Classical ----
  const caesar = (text, shift, mode) => {
    const s = (mode === 'decrypt' ? -shift : shift);
    return text.replace(/[a-zA-Z]/g, c => {
      const base = c <= 'Z' ? 65 : 97;
      return String.fromCharCode(((c.charCodeAt(0) - base + s + 26) % 26) + base);
    });
  };

  const vigenere = (text, key, mode) => {
    const k = key.toUpperCase().replace(/[^A-Z]/g, '');
    if (!k) throw new Error('vigenère key must contain letters');
    let ki = 0;
    return text.replace(/[a-zA-Z]/g, c => {
      const base = c <= 'Z' ? 65 : 97;
      const shift = k.charCodeAt(ki % k.length) - 65;
      ki++;
      const s = mode === 'decrypt' ? -shift : shift;
      return String.fromCharCode(((c.charCodeAt(0) - base + s + 26) % 26) + base);
    });
  };

  const xorStream = (text, key) => {
    if (!key) throw new Error('key required');
    const bytes = typeof text === 'string' ? new TextEncoder().encode(text) : text;
    const kbytes = new TextEncoder().encode(key);
    const out = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ kbytes[i % kbytes.length];
    return out;
  };

  // ---- Format helpers ----
  const formatBytes = (bytes, fmt) => fmt === 'hex' ? toHex(bytes) : toB64(bytes);
  const parseBytes = (text, fmt) => {
    if (fmt === 'hex') return fromHex(text);
    return fromB64(text.replace(/\s+/g, ''));
  };

  // ---- View ----
  const load = () => {
    const view = $('#encryption-view');
    if (!view || isLoaded) return;

    view.innerHTML = `
      <div class="view-headerline">
        <h1 class="view-title">// encryption hub</h1>
        <div class="view-meta">AES-256-GCM (PBKDF2-SHA-256, 200k iter) · classical ciphers · binary-safe</div>
      </div>

      <div class="tool">
        <div class="panel">
          <header class="panel-head">
            <span class="panel-tag">[ 01 ]</span>
            <h2>configure</h2>
            <span class="panel-state" id="enc-state">idle</span>
          </header>
          <div class="field">
            <label class="field-label">algorithm</label>
            <select class="select" id="enc-algo">
              <optgroup label="modern">
                <option value="aes-gcm" selected>AES-256-GCM (recommended)</option>
                <option value="xor">XOR stream (educational)</option>
              </optgroup>
              <optgroup label="classical">
                <option value="caesar">Caesar shift</option>
                <option value="vigenere">Vigenère</option>
              </optgroup>
            </select>
          </div>

          <div class="field">
            <label class="field-label">key / passphrase</label>
            <div class="input-row">
              <input class="input" type="password" id="enc-key" placeholder="passphrase (caesar: a number)">
              <button class="brkbtn" id="enc-keygen">[ gen ]</button>
            </div>
          </div>

          <div class="field">
            <label class="field-label">mode</label>
            <div class="group-row">
              <label class="radio"><input type="radio" name="enc-mode" value="encrypt" checked><span class="glyph"></span><span class="label">encrypt</span></label>
              <label class="radio"><input type="radio" name="enc-mode" value="decrypt"><span class="glyph"></span><span class="label">decrypt</span></label>
            </div>
          </div>

          <div class="field">
            <label class="field-label">output encoding</label>
            <div class="group-row">
              <label class="radio"><input type="radio" name="enc-fmt" value="base64" checked><span class="glyph"></span><span class="label">base64</span></label>
              <label class="radio"><input type="radio" name="enc-fmt" value="hex"><span class="glyph"></span><span class="label">hex</span></label>
            </div>
          </div>

          <hr class="divider">

          <div class="drop" id="enc-drop">
            <span class="drop-glyph">▥</span>
            drop file (binary-safe) or click<br>
            <span class="filename muted" id="enc-fname">no file loaded · using text below</span>
            <input type="file" id="enc-file" hidden>
          </div>
        </div>

        <div class="tool-stack">
          <div class="panel">
            <header class="panel-head">
              <span class="panel-tag">[ 02 ]</span>
              <h2>input / output</h2>
              <span class="panel-state" id="enc-mtime">—</span>
            </header>
            <div class="field">
              <label class="field-label">input (text or paste ciphertext)</label>
              <textarea class="textarea code" id="enc-input" placeholder="message or ciphertext"></textarea>
            </div>
            <div class="field">
              <label class="field-label">output</label>
              <textarea class="textarea code" id="enc-output" readonly placeholder="result appears here"></textarea>
            </div>
            <div class="flex gap">
              <button class="brkbtn primary" id="enc-run">[ run ]</button>
              <button class="brkbtn" id="enc-copy">[ copy output ]</button>
              <button class="brkbtn" id="enc-download" disabled>[ download .bin ]</button>
              <button class="brkbtn danger" id="enc-clear">[ clear ]</button>
            </div>
          </div>

          <div class="panel">
            <header class="panel-head">
              <span class="panel-tag">[ 03 ]</span>
              <h2>envelope</h2>
              <span class="panel-state">last operation</span>
            </header>
            <div class="kv-list" id="enc-meta">
              <div class="kv"><span class="kv-k">algorithm</span><span class="kv-v mute" id="em-algo">—</span></div>
              <div class="kv"><span class="kv-k">kdf</span><span class="kv-v mute" id="em-kdf">—</span></div>
              <div class="kv"><span class="kv-k">salt (hex)</span><span class="kv-v mute code" id="em-salt">—</span></div>
              <div class="kv"><span class="kv-k">iv / nonce (hex)</span><span class="kv-v mute code" id="em-iv">—</span></div>
              <div class="kv"><span class="kv-k">ciphertext length</span><span class="kv-v mute" id="em-len">—</span></div>
              <div class="kv"><span class="kv-k">elapsed</span><span class="kv-v mute" id="em-t">—</span></div>
            </div>
          </div>
        </div>
      </div>
    `;

    bind();
    isLoaded = true;
  };

  const bind = () => {
    $('#enc-keygen').addEventListener('click', () => {
      const algo = $('#enc-algo').value;
      if (algo === 'caesar') {
        $('#enc-key').value = String(1 + Math.floor(Math.random() * 25));
      } else {
        $('#enc-key').value = toB64(randBytes(24));
      }
    });

    const drop = $('#enc-drop');
    const fileInput = $('#enc-file');
    drop.addEventListener('click', () => fileInput.click());
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', async (e) => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) await loadFile(e.dataTransfer.files[0]); });
    fileInput.addEventListener('change', async (e) => { if (e.target.files[0]) await loadFile(e.target.files[0]); });

    $('#enc-run').addEventListener('click', run);
    $('#enc-copy').addEventListener('click', () => copy($('#enc-output').value));
    $('#enc-clear').addEventListener('click', () => {
      $('#enc-input').value = '';
      $('#enc-output').value = '';
      $('#enc-key').value = '';
      fileBytes = null; fileName = null;
      $('#enc-fname').textContent = 'no file loaded · using text below';
      $('#enc-download').disabled = true;
    });
    $('#enc-download').addEventListener('click', downloadResult);
  };

  const loadFile = async (file) => {
    const buf = await file.arrayBuffer();
    fileBytes = new Uint8Array(buf);
    fileName = file.name;
    $('#enc-fname').textContent = file.name + ' · ' + fileBytes.length + ' bytes (using file, ignoring text)';
  };

  const run = async () => {
    const algo = $('#enc-algo').value;
    const key = $('#enc-key').value;
    const mode = document.querySelector('input[name="enc-mode"]:checked').value;
    const fmt = document.querySelector('input[name="enc-fmt"]:checked').value;

    if (!key && algo !== 'caesar') { App.ui.toast('enc', 'key required', 'warning'); return; }

    $('#enc-state').textContent = mode + 'ing';
    const t0 = performance.now();

    try {
      if (algo === 'aes-gcm') {
        if (mode === 'encrypt') {
          const source = fileBytes || $('#enc-input').value;
          if (!source || (typeof source === 'string' && !source.length)) throw new Error('no input');
          const r = await aesEncrypt(source, key);
          const output = formatBytes(r.envelope, fmt);
          $('#enc-output').value = output;
          lastResult = { bytes: r.envelope, fmt, mode, algo, fileName };
          $('#enc-download').disabled = !fileBytes;
          updateMeta({
            algo: 'AES-256-GCM',
            kdf: 'PBKDF2-SHA256 · 200,000 iter',
            salt: toHex(r.salt),
            iv: toHex(r.iv),
            len: r.ct.length + ' bytes',
            t: (performance.now() - t0).toFixed(1) + ' ms'
          });
        } else {
          const inputBytes = fileBytes || parseBytes($('#enc-input').value, fmt);
          if (!inputBytes.length) throw new Error('no input');
          const r = await aesDecrypt(inputBytes, key);
          const isText = isLikelyText(r.plaintext);
          $('#enc-output').value = isText ? new TextDecoder('utf-8', { fatal: false }).decode(r.plaintext)
                                          : formatBytes(r.plaintext, fmt) + '\n\n(binary output; ' + r.plaintext.length + ' bytes)';
          lastResult = { bytes: r.plaintext, fmt: 'raw', mode, algo, fileName: fileName ? fileName.replace(/\.bin$/, '') + '.dec' : null };
          $('#enc-download').disabled = !fileBytes;
          updateMeta({
            algo: 'AES-256-GCM',
            kdf: 'PBKDF2-SHA256 · 200,000 iter',
            salt: toHex(r.salt),
            iv: toHex(r.iv),
            len: r.plaintext.length + ' bytes',
            t: (performance.now() - t0).toFixed(1) + ' ms'
          });
        }
      } else if (algo === 'xor') {
        const source = fileBytes || new TextEncoder().encode($('#enc-input').value);
        const out = xorStream(source, key);
        const isText = mode === 'decrypt' && isLikelyText(out);
        $('#enc-output').value = mode === 'encrypt' ? formatBytes(out, fmt)
                              : isText ? new TextDecoder().decode(out) : formatBytes(out, fmt);
        lastResult = { bytes: out, fmt, mode, algo, fileName };
        $('#enc-download').disabled = !fileBytes;
        updateMeta({ algo: 'XOR stream', kdf: 'n/a (key reused — insecure for >|key|)', salt: 'n/a', iv: 'n/a',
                     len: out.length + ' bytes', t: (performance.now() - t0).toFixed(1) + ' ms' });
      } else if (algo === 'caesar') {
        const out = caesar($('#enc-input').value, parseInt(key, 10) || 3, mode);
        $('#enc-output').value = out;
        updateMeta({ algo: 'Caesar shift', kdf: 'n/a', salt: 'n/a', iv: 'shift=' + (parseInt(key, 10) || 3), len: out.length + ' chars', t: (performance.now() - t0).toFixed(1) + ' ms' });
      } else if (algo === 'vigenere') {
        const out = vigenere($('#enc-input').value, key, mode);
        $('#enc-output').value = out;
        updateMeta({ algo: 'Vigenère', kdf: 'n/a', salt: 'n/a', iv: 'keylen=' + key.length, len: out.length + ' chars', t: (performance.now() - t0).toFixed(1) + ' ms' });
      }

      App.log.event('encrypt', `${mode} via ${algo}`,
        { severity: algo === 'caesar' || algo === 'vigenere' || algo === 'xor' ? 'warn' : 'ok',
          meta: { algo, mode } });
      App.dashboard?.refresh?.();
      App.ui.toast('enc', `${mode}ion ok`, 'success');
      $('#enc-state').textContent = 'ok';
    } catch (e) {
      console.error(e);
      App.ui.toast('enc', e.message, 'error', 4000);
      App.log.event('encrypt', `${mode} failed: ${e.message}`, { severity: 'bad', meta: { algo } });
      $('#enc-state').textContent = 'error';
    }
  };

  const isLikelyText = (bytes) => {
    let printable = 0;
    const sample = Math.min(bytes.length, 400);
    for (let i = 0; i < sample; i++) {
      const b = bytes[i];
      if (b === 9 || b === 10 || b === 13 || (b >= 32 && b < 127)) printable++;
    }
    return printable / sample > 0.85;
  };

  const updateMeta = (m) => {
    $('#em-algo').textContent = m.algo;     $('#em-algo').className = 'kv-v';
    $('#em-kdf').textContent  = m.kdf;      $('#em-kdf').className  = 'kv-v';
    $('#em-salt').textContent = m.salt;     $('#em-salt').className = 'kv-v code';
    $('#em-iv').textContent   = m.iv;       $('#em-iv').className   = 'kv-v code';
    $('#em-len').textContent  = m.len;      $('#em-len').className  = 'kv-v';
    $('#em-t').textContent    = m.t;        $('#em-t').className    = 'kv-v';
    $('#enc-mtime').textContent = m.t;
  };

  const downloadResult = () => {
    if (!lastResult || !lastResult.bytes) return;
    const blob = new Blob([lastResult.bytes], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stem = lastResult.fileName || 'crypt-output';
    a.href = url;
    a.download = stem + (lastResult.mode === 'encrypt' ? '.bin' : '');
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  const init = () => {};
  return { init, load };
})();
