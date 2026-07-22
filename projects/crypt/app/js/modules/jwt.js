// crypt // sec-ops — JWT / Token Inspector
window.App = window.App || {};

App.jwt = (() => {
  const { $, esc } = App.utils;
  let isLoaded = false;

  const decodeSegment = (seg) => {
    try {
      const b64 = seg.replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(atob(b64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
      return JSON.parse(json);
    } catch (e) {
      return { error: 'invalid segment encoding' };
    }
  };

  const inspect = (token) => {
    const parts = token.trim().split('.');
    if (parts.length < 2) throw new Error('invalid JWT format (expected header.payload.signature)');
    const header = decodeSegment(parts[0]);
    const payload = decodeSegment(parts[1]);
    return { header, payload, signature: parts[2] || '' };
  };

  const load = () => {
    const view = $('#jwt-view');
    if (!view || isLoaded) return;

    view.innerHTML = `
      <div class="view-headerline">
        <h1 class="view-title">// jwt inspector</h1>
        <div class="view-meta">offline token decoder · claim analysis · signature check</div>
      </div>

      <div class="tool">
        <div class="panel">
          <header class="panel-head">
            <span class="panel-tag">[ 01 ]</span>
            <h2>token input</h2>
            <span class="panel-state" id="jwt-state">ready</span>
          </header>
          <div class="field">
            <label class="field-label">paste encoded JWT</label>
            <textarea class="textarea code" id="jwt-input" placeholder="eyJhbGciOi..."></textarea>
          </div>
          <div class="flex gap" style="margin-top:12px">
            <button class="brkbtn primary" id="jwt-run">[ inspect token ]</button>
            <button class="brkbtn" id="jwt-clear">[ clear ]</button>
          </div>
        </div>

        <div class="tool-stack">
          <div class="panel">
            <header class="panel-head">
              <span class="panel-tag">[ 02 ]</span>
              <h2>claims & header</h2>
              <span class="panel-state" id="jwt-status">no token</span>
            </header>
            <div class="field">
              <label class="field-label">header</label>
              <pre class="result code" id="jwt-header-out">// header appears here</pre>
            </div>
            <div class="field" style="margin-top:10px">
              <label class="field-label">payload claims</label>
              <pre class="result code" id="jwt-payload-out">// payload appears here</pre>
            </div>
          </div>
        </div>
      </div>
    `;

    bind();
    isLoaded = true;
  };

  const bind = () => {
    const run = () => {
      const val = $('#jwt-input').value.trim();
      if (!val) {
        $('#jwt-header-out').textContent = '// header appears here';
        $('#jwt-payload-out').textContent = '// payload appears here';
        $('#jwt-status').textContent = 'no token';
        return;
      }
      try {
        const { header, payload, signature } = inspect(val);
        $('#jwt-header-out').textContent = JSON.stringify(header, null, 2);
        $('#jwt-payload-out').textContent = JSON.stringify(payload, null, 2);
        
        let status = 'valid structure';
        if (header.alg === 'none' || header.alg === 'NONE') status = 'CRIT: alg none';
        else if (payload.exp && Date.now() >= payload.exp * 1000) status = 'EXPIRED token';
        
        $('#jwt-status').textContent = status;
        App.log.add('jwt', 'inspected JWT token (' + (header.alg || 'unknown') + ')', payload.exp && Date.now() >= payload.exp * 1000 ? 'warn' : 'ok', { alg: header.alg });
      } catch (e) {
        $('#jwt-status').textContent = 'error';
        $('#jwt-header-out').textContent = '// ' + e.message;
        $('#jwt-payload-out').textContent = '// parse failed';
        App.log.add('jwt', 'JWT parse error: ' + e.message, 'bad');
      }
    };

    $('#jwt-run').addEventListener('click', run);
    $('#jwt-input').addEventListener('input', run);
    $('#jwt-clear').addEventListener('click', () => {
      $('#jwt-input').value = '';
      $('#jwt-header-out').textContent = '// header appears here';
      $('#jwt-payload-out').textContent = '// payload appears here';
      $('#jwt-status').textContent = 'no token';
    });
  };

  const init = () => {};
  return { init, load };
})();
