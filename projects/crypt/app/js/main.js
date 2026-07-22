// crypt // sec-ops — entrypoint + router
(() => {
  const TOOLS = ['dashboard','encryption','password','hash','threat','steganography','network','reports','settings','jwt'];
  let currentTool = null;
  const startTime = Date.now();

  const switchTool = (name) => {
    if (!TOOLS.includes(name)) name = 'dashboard';
    if (currentTool === name) return;
    currentTool = name;

    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const view = document.getElementById(name + '-view');
    if (view) view.classList.add('active');

    document.querySelectorAll('.navitem').forEach(a =>
      a.classList.toggle('active', a.getAttribute('data-tool') === name)
    );

    const mod = App[name];
    if (mod && typeof mod.load === 'function') mod.load();
    App.ui.setCmdState('viewing ' + name);
    App.ui.closeSidebar();
  };

  const router = () => {
    const hash = window.location.hash.slice(1) || 'dashboard';
    switchTool(hash);
  };

  const startUptime = () => {
    const clock = document.getElementById('uptime-clock');
    if (!clock) return;
    setInterval(() => {
      const t = Math.floor((Date.now() - startTime) / 1000);
      const h = Math.floor(t / 3600);
      const m = Math.floor((t % 3600) / 60);
      const s = t % 60;
      const pad = (n) => String(n).padStart(2, '0');
      clock.textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;
    }, 1000);
  };

  const dashboardBindings = () => {
    document.getElementById('dashboard-refresh')?.addEventListener('click', () => {
      App.dashboard.refresh();
      App.ui.toast('dash', 'dashboard refreshed', 'success', 1800);
    });
    document.getElementById('dashboard-clear')?.addEventListener('click', () => {
      if (confirm('clear activity log?')) {
        App.log.clear();
        App.dashboard.refresh();
        App.ui.toast('dash', 'log cleared', 'warning');
      }
    });
  };

  const keyBindings = () => {
    document.addEventListener('keydown', (e) => {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) {
        if (e.key === 'Escape') e.target.blur();
        return;
      }
      // global hotkeys
      if (e.key === 't') App.ui.toggleTheme();
      else if (e.key === '?') {
        App.ui.toast('keys', 't: theme · g: generate · a: analyse · 1-9: switch tool', 'info', 4000);
      } else if (/^[1-9]$/.test(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        if (TOOLS[idx]) window.location.hash = TOOLS[idx];
      } else if (e.key === '/') {
        const first = document.querySelector('.view.active .input, .view.active .textarea');
        if (first) { first.focus(); e.preventDefault(); }
      }
    });
  };

  const init = () => {
    App.ui.init();
    for (const t of TOOLS) {
      if (App[t] && typeof App[t].init === 'function') App[t].init();
    }

    startUptime();
    dashboardBindings();
    keyBindings();
    window.addEventListener('hashchange', router);
    router();

    // Boot toast
    setTimeout(() => App.ui.toast('init', 'crypt online · press ? for keys', 'success', 3000), 200);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
