// crypt // sec-ops — entrypoint + router
(() => {
  const TOOLS = ['dashboard','encryption','password','hash','threat','steganography','network','reports','settings','jwt','ctf','phish'];
  let currentTool = null;

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

  /* startUptime() lived here: a 1s setInterval driving an "UPTIME" clock in
     the top bar that reported how long the tab had been open, dressed up as
     though it were a server's uptime. Removed with the markup — and with it,
     a timer that woke the page every second for the entire session. */

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
