// crypt // sec-ops — LSB steganography in PNG
// Embeds a UTF-8 message into the low bit of R,G,B channels of an image.
// Header is a 32-bit big-endian length (in bytes) preceding the payload.
window.App = window.App || {};

App.steganography = (() => {
  const { $, esc } = App.utils;
  let isLoaded = false;

  // Encode message into ImageData
  const encodeToImage = (imgData, message) => {
    const bytes = new TextEncoder().encode(message);
    const payload = new Uint8Array(4 + bytes.length);
    payload[0] = (bytes.length >>> 24) & 0xff;
    payload[1] = (bytes.length >>> 16) & 0xff;
    payload[2] = (bytes.length >>> 8) & 0xff;
    payload[3] = bytes.length & 0xff;
    payload.set(bytes, 4);

    const capacityBytes = Math.floor((imgData.width * imgData.height * 3) / 8);
    if (payload.length > capacityBytes) {
      throw new Error(`payload too large: ${payload.length}B > ${capacityBytes}B capacity`);
    }

    const data = imgData.data;
    let bitIdx = 0;
    for (let i = 0; i < data.length && bitIdx < payload.length * 8; i += 4) {
      for (let ch = 0; ch < 3 && bitIdx < payload.length * 8; ch++) {
        const byteIdx = bitIdx >>> 3;
        const bit = (payload[byteIdx] >>> (7 - (bitIdx & 7))) & 1;
        data[i + ch] = (data[i + ch] & 0xfe) | bit;
        bitIdx++;
      }
    }
    return imgData;
  };

  // Decode message from ImageData
  const decodeFromImage = (imgData) => {
    const data = imgData.data;
    // First read 32 bits for length
    const readBits = (count, startBit) => {
      let out = 0n; // BigInt to avoid 32-bit overflow concern, then cast
      for (let k = 0; k < count; k++) {
        const bitIdx = startBit + k;
        const pxIdx = Math.floor(bitIdx / 3);
        const chIdx = bitIdx % 3;
        const dataIdx = pxIdx * 4 + chIdx;
        if (dataIdx >= data.length) throw new Error('truncated image');
        const bit = data[dataIdx] & 1;
        out = (out << 1n) | BigInt(bit);
      }
      return Number(out);
    };

    const length = readBits(32, 0);
    if (length < 0 || length > 1e7) throw new Error('decoded length implausible (' + length + ') — no payload?');

    const bytes = new Uint8Array(length);
    for (let b = 0; b < length; b++) {
      bytes[b] = readBits(8, 32 + b * 8);
    }
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch (e) {
      throw new Error('decoded bytes are not valid utf-8 — likely no stego payload');
    }
  };

  const fileToImageData = async (file) => new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve({ data: ctx.getImageData(0, 0, canvas.width, canvas.height), canvas, ctx });
    };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(new Error('image load failed')); };
    img.src = url;
  });

  const downloadPNG = (canvas, filename) => {
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }, 'image/png');
  };

  const load = () => {
    const view = $('#steganography-view');
    if (!view || isLoaded) return;

    view.innerHTML = `
      <div class="view-headerline">
        <h1 class="view-title">// steganograph</h1>
        <div class="view-meta">LSB embed/extract in PNG · in-browser, no network</div>
      </div>

      <div class="tabs">
        <button class="tab active" data-stab="hide">hide</button>
        <button class="tab" data-stab="extract">extract</button>
      </div>

      <div id="stab-hide">
        <div class="tool">
          <div class="panel">
            <header class="panel-head">
              <span class="panel-tag">[ 01 ]</span>
              <h2>cover image</h2>
              <span class="panel-state" id="hide-state">drop PNG/JPG</span>
            </header>
            <div class="drop" id="hide-drop">
              <span class="drop-glyph">▦</span>
              drop image or click<br>
              <span class="filename muted" id="hide-fname">no image loaded</span>
              <input type="file" id="hide-file" accept="image/*" hidden>
            </div>
            <div class="field" style="margin-top:14px">
              <label class="field-label">message</label>
              <textarea class="textarea" id="hide-msg" placeholder="message to hide in the image"></textarea>
            </div>
            <div class="muted" style="font-size:11px" id="hide-cap">capacity: load an image</div>
            <div style="height:10px"></div>
            <button class="brkbtn primary block" id="hide-go">[ embed + download PNG ]</button>
          </div>

          <div class="panel">
            <header class="panel-head">
              <span class="panel-tag">[ 02 ]</span>
              <h2>preview</h2>
              <span class="panel-state">cover ↔ stego</span>
            </header>
            <div id="hide-preview" class="result empty">// load an image to preview.</div>
          </div>
        </div>
      </div>

      <div id="stab-extract" class="hidden">
        <div class="tool">
          <div class="panel">
            <header class="panel-head">
              <span class="panel-tag">[ 01 ]</span>
              <h2>stego image</h2>
              <span class="panel-state" id="ext-state">drop PNG</span>
            </header>
            <div class="drop" id="ext-drop">
              <span class="drop-glyph">▤</span>
              drop image or click<br>
              <span class="filename muted" id="ext-fname">no image loaded</span>
              <input type="file" id="ext-file" accept="image/*" hidden>
            </div>
            <div style="height:10px"></div>
            <button class="brkbtn primary block" id="ext-go" disabled>[ extract ]</button>
          </div>

          <div class="panel">
            <header class="panel-head">
              <span class="panel-tag">[ 02 ]</span>
              <h2>recovered message</h2>
              <span class="panel-state" id="ext-status">none</span>
            </header>
            <div id="ext-result" class="result empty">// load a stego PNG and press extract.</div>
          </div>
        </div>
      </div>
    `;

    bind();
    isLoaded = true;
  };

  let hideImageData = null;
  let hideCanvas = null;
  let extractFile = null;

  const bind = () => {
    document.querySelectorAll('[data-stab]').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('[data-stab]').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        const t = b.getAttribute('data-stab');
        $('#stab-hide').classList.toggle('hidden', t !== 'hide');
        $('#stab-extract').classList.toggle('hidden', t !== 'extract');
      });
    });

    wireDrop('#hide-drop', '#hide-file', async (file) => {
      $('#hide-fname').textContent = file.name + ' · ' + Math.round(file.size / 1024) + ' KB';
      try {
        const { data, canvas } = await fileToImageData(file);
        hideImageData = data;
        hideCanvas = canvas;
        const cap = Math.floor((data.width * data.height * 3) / 8) - 4;
        $('#hide-cap').textContent = `capacity: ~${cap.toLocaleString()} bytes (${data.width}×${data.height})`;
        $('#hide-state').textContent = 'image ready';
        $('#hide-preview').className = '';
        $('#hide-preview').innerHTML = '';
        canvas.style.maxWidth = '100%';
        canvas.style.imageRendering = 'pixelated';
        canvas.style.border = '1px solid var(--rule)';
        $('#hide-preview').appendChild(canvas);
      } catch (e) {
        App.ui.toast('steg', e.message, 'error');
      }
    });

    wireDrop('#ext-drop', '#ext-file', async (file) => {
      $('#ext-fname').textContent = file.name + ' · ' + Math.round(file.size / 1024) + ' KB';
      extractFile = file;
      $('#ext-state').textContent = 'image ready';
      $('#ext-go').disabled = false;
    });

    $('#hide-go').addEventListener('click', runHide);
    $('#ext-go').addEventListener('click', runExtract);
  };

  const wireDrop = (dropSel, fileSel, handler) => {
    const drop = $(dropSel);
    const fileInput = $(fileSel);
    drop.addEventListener('click', () => fileInput.click());
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('over');
      const f = e.dataTransfer.files[0];
      if (f) handler(f);
    });
    fileInput.addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (f) handler(f);
    });
  };

  const runHide = () => {
    const msg = $('#hide-msg').value;
    if (!hideImageData || !hideCanvas) { App.ui.toast('steg', 'load an image first', 'warning'); return; }
    if (!msg) { App.ui.toast('steg', 'enter a message', 'warning'); return; }
    try {
      const cloned = new ImageData(new Uint8ClampedArray(hideImageData.data), hideImageData.width, hideImageData.height);
      encodeToImage(cloned, msg);
      const ctx = hideCanvas.getContext('2d');
      ctx.putImageData(cloned, 0, 0);
      downloadPNG(hideCanvas, 'stego.png');
      App.log.event('steg', `embedded ${msg.length} chars into ${hideImageData.width}×${hideImageData.height} image`,
        { severity: 'ok', meta: { bytes: msg.length } });
      App.dashboard?.refresh?.();
      App.ui.toast('steg', 'embedded — download started', 'success');
    } catch (e) {
      App.ui.toast('steg', e.message, 'error', 5000);
    }
  };

  const runExtract = async () => {
    if (!extractFile) return;
    try {
      const { data } = await fileToImageData(extractFile);
      const msg = decodeFromImage(data);
      $('#ext-result').className = 'result';
      $('#ext-result').textContent = msg;
      $('#ext-status').textContent = msg.length + ' chars recovered';
      App.log.event('steg', `extracted ${msg.length} chars from ${extractFile.name}`,
        { severity: 'info', meta: { source: extractFile.name } });
      App.dashboard?.refresh?.();
      App.ui.toast('steg', 'message recovered', 'success');
    } catch (e) {
      $('#ext-result').className = 'result empty';
      $('#ext-result').textContent = '// ' + e.message;
      $('#ext-status').textContent = 'failed';
      App.ui.toast('steg', e.message, 'error', 5000);
    }
  };

  const init = () => {};
  return { init, load };
})();
