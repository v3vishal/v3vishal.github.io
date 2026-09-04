// crypt // sec-ops — settings
window.App = window.App || {};

App.settings = (() => {
  const { $ } = App.utils;
  let isLoaded = false;

  const load = () => {
    const view = $('#settings-view');
    if (!view || isLoaded) return;

    view.innerHTML = `
      <div class="view-headerline">
        <h1 class="view-title">// settings</h1>
        <div class="view-meta">local preferences · stored in browser only</div>
      </div>

      <div class="tool">
        <div class="panel">
          <header class="panel-head">
            <span class="panel-tag">[ 01 ]</span>
            <h2>appearance</h2>
            <span class="panel-state">theme + chrome</span>
          </header>

          <div class="field">
            <label class="field-label">colour scheme</label>
            <div class="group-row">
              <label class="radio"><input type="radio" name="s-theme" value="dark"><span class="glyph"></span><span class="label">dark</span></label>
              <label class="radio"><input type="radio" name="s-theme" value="light"><span class="glyph"></span><span class="label">light</span></label>
            </div>
          </div>

          <div class="field">
            <label class="field-label">font size scale: <span id="s-fs-val" class="mono">100%</span></label>
            <input type="range" id="s-fs" class="range" min="80" max="140" value="100" step="5">
          </div>
        </div>

        <div class="tool-stack">
          <div class="panel">
            <header class="panel-head">
              <span class="panel-tag">[ 02 ]</span>
              <h2>local data</h2>
              <span class="panel-state">activity log + caches</span>
            </header>
            <div class="kv-list">
              <div class="kv"><span class="kv-k">events stored</span><span class="kv-v" id="s-events">0</span></div>
              <div class="kv"><span class="kv-k">storage backend</span><span class="kv-v">localStorage</span></div>
            </div>
            <div style="height:12px"></div>
            <button class="brkbtn danger block" id="s-wipe">wipe all local data</button>
          </div>

          <div class="panel">
            <header class="panel-head">
              <span class="panel-tag">[ 03 ]</span>
              <h2>about</h2>
              <span class="panel-state">build</span>
            </header>
            <pre class="result" style="font-size:11px;line-height:1.6;">
crypt // sec-ops
─────────────────
  author     Vishal V V
  philosophy reading about ciphers teaches definitions;
             implementing them teaches why they fail.
  engine     WebCrypto (AES-256-GCM) · zxcvbn entropy heuristic
             MD5 implemented in-page (RFC 1321) — WebCrypto
             refuses to ship it, which is rather the point
  design     shares the portfolio's type and palette
  storage    localStorage only · no network calls, no telemetry

a security toolkit built to demystify cryptography
through hands-on implementation and simulation.</pre>
          </div>
        </div>
      </div>
    `;

    bind();
    isLoaded = true;
  };

  const bind = () => {
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    document.querySelector(`input[name="s-theme"][value="${cur}"]`)?.setAttribute('checked', 'true');
    document.querySelector(`input[name="s-theme"][value="${cur}"]`).checked = true;

    document.querySelectorAll('input[name="s-theme"]').forEach(r => {
      r.addEventListener('change', e => App.ui.setTheme(e.target.value));
    });
    const fs = $('#s-fs');
    const fsv = $('#s-fs-val');
    const savedFs = localStorage.getItem('crypt.fontsize') || '100';
    fs.value = savedFs;
    document.documentElement.style.fontSize = savedFs + '%';
    fsv.textContent = savedFs + '%';
    fs.addEventListener('input', () => {
      fsv.textContent = fs.value + '%';
      document.documentElement.style.fontSize = fs.value + '%';
      localStorage.setItem('crypt.fontsize', fs.value);
    });

    $('#s-events').textContent = App.log.all().length;
    $('#s-wipe').addEventListener('click', () => {
      if (confirm('wipe all local data (activity log, prefs)? page will reload.')) {
        localStorage.clear();
        location.reload();
      }
    });
  };

  const init = () => {};
  return { init, load };
})();
