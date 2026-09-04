// crypt // sec-ops — reports (activity log export)
window.App = window.App || {};

App.reports = (() => {
  const { $, esc, fmtTime, fmtAgo } = App.utils;
  let isLoaded = false;
  let filter = 'all';

  const KIND_LABEL = {
    encrypt: 'encrypt', pwd: 'pwd', hash: 'hash',
    threat: 'threat', steg: 'steg', net: 'net'
  };

  const load = () => {
    const view = $('#reports-view');
    if (!view || isLoaded) return;

    view.innerHTML = `
      <div class="view-headerline">
        <h1 class="view-title">// reports</h1>
        <div class="view-meta">session activity log · exportable</div>
        <div class="view-actions">
          <button class="brkbtn" id="rep-export-md">export .md</button>
          <button class="brkbtn" id="rep-export-json">export .json</button>
          <button class="brkbtn danger" id="rep-clear">wipe log</button>
        </div>
      </div>

      <div class="panel">
        <header class="panel-head">
          <span class="panel-tag">[ 01 ]</span>
          <h2>filter</h2>
          <span class="panel-state" id="rep-count">0 events</span>
        </header>
        <div class="flex gap" id="rep-filters">
          ${['all','encrypt','pwd','hash','threat','steg','net'].map(k =>
            `<button class="brkbtn ${k==='all'?'primary':''}" data-filter="${k}">${k}</button>`
          ).join('')}
        </div>
      </div>

      <div style="height:16px"></div>

      <div class="panel">
        <header class="panel-head">
          <span class="panel-tag">[ 02 ]</span>
          <h2>events</h2>
          <span class="panel-state">most recent first</span>
        </header>
        <div id="rep-list"></div>
      </div>
    `;

    bind();
    isLoaded = true;
    render();
    App.log.subscribe(render);
  };

  const bind = () => {
    document.querySelectorAll('[data-filter]').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('[data-filter]').forEach(x => x.classList.remove('primary'));
        b.classList.add('primary');
        filter = b.getAttribute('data-filter');
        render();
      });
    });
    $('#rep-export-md').addEventListener('click', exportMd);
    $('#rep-export-json').addEventListener('click', exportJson);
    $('#rep-clear').addEventListener('click', () => {
      if (confirm('wipe entire activity log? this cannot be undone.')) {
        App.log.clear();
        App.dashboard?.refresh?.();
        App.ui.toast('reports', 'log wiped', 'warning');
        render();
      }
    });
  };

  const render = () => {
    const list = $('#rep-list');
    if (!list) return;
    const all = App.log.all();
    const events = filter === 'all' ? all : all.filter(e => e.kind === filter);
    const countNode = $('#rep-count');
    if (countNode) countNode.textContent = events.length + ' / ' + all.length + ' events';

    if (!events.length) {
      list.innerHTML = '<div class="result empty">// no events matching filter.</div>';
      return;
    }

    list.innerHTML = `
      <table class="data-table">
        <thead><tr><th>time</th><th>kind</th><th>severity</th><th>event</th></tr></thead>
        <tbody>
          ${events.map(e => {
            const sevColor = { ok: 'phosphor', warn: 'amber', bad: 'crimson', info: 'fg-mute' }[e.severity] || 'fg-mute';
            return `<tr>
              <td class="muted">${fmtTime(e.ts)} <span class="muted">(${fmtAgo(e.ts)})</span></td>
              <td class="mono">${KIND_LABEL[e.kind] || e.kind}</td>
              <td><span class="tag" style="color:var(--${sevColor})">${(e.severity||'info').toUpperCase()}</span></td>
              <td>${esc(e.message)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
  };

  const exportMd = () => {
    const all = App.log.all();
    if (!all.length) { App.ui.toast('reports', 'log empty', 'warning'); return; }
    const lines = [
      '# crypt // sec-ops — session report',
      '',
      `generated: ${new Date().toISOString()}`,
      `events: ${all.length}`,
      '',
      '| time | kind | severity | event |',
      '| ---- | ---- | -------- | ----- |',
      ...all.map(e => `| ${new Date(e.ts).toISOString()} | ${e.kind} | ${(e.severity||'info').toUpperCase()} | ${e.message.replace(/\|/g, '\\|')} |`)
    ];
    download('crypt-report.md', lines.join('\n'), 'text/markdown');
  };

  const exportJson = () => {
    const all = App.log.all();
    if (!all.length) { App.ui.toast('reports', 'log empty', 'warning'); return; }
    download('crypt-report.json', JSON.stringify(all, null, 2), 'application/json');
  };

  const download = (name, content, mime) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    App.ui.toast('reports', name + ' downloaded', 'success');
  };

  const init = () => {};
  return { init, load };
})();
