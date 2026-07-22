// crypt // sec-ops — chrome (theme, sidebar, overlay, toasts, status)
window.App = window.App || {};

App.ui = (() => {
  const { $, $$, el } = App.utils;

  let toastSeq = 0;

  // ----- Theme -----
  const THEME_KEY = 'crypt.theme';
  const SCAN_KEY = 'crypt.scanlines';

  const setTheme = (theme) => {
    document.documentElement.setAttribute('data-color-scheme', theme);
    localStorage.setItem(THEME_KEY, theme);
    const icon = $('#theme-toggle');
    if (icon) icon.textContent = theme === 'dark' ? '[ ◐ ]' : '[ ◑ ]';
  };

  const toggleTheme = () => {
    const cur = document.documentElement.getAttribute('data-color-scheme') || 'dark';
    setTheme(cur === 'dark' ? 'light' : 'dark');
  };

  const setScanlines = (on) => {
    document.documentElement.style.setProperty('--scan-opacity', on ? '.07' : '0');
    localStorage.setItem(SCAN_KEY, on ? '1' : '0');
  };

  // ----- Sidebar mobile -----
  const toggleSidebar = () => {
    $('#sidebar')?.classList.toggle('open');
  };
  const closeSidebar = () => $('#sidebar')?.classList.remove('open');

  // ----- Toasts -----
  const toast = (tag, message, severity = 'info', ttl = 3200) => {
    const container = $('#toaster');
    if (!container) return;
    const t = el('div', { class: `toast ${severity}`, role: 'status' },
      el('span', { class: 'toast-tag' }, '[' + tag + ']'),
      document.createTextNode(' ' + message)
    );
    container.appendChild(t);
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 240);
    }, ttl);
    return t;
  };

  // ----- Overlay -----
  let progressTimer = null;
  const overlay = $('#overlay');
  const overlayText = $('#overlay-text');
  const overlayArt = $('#overlay-art');

  const showOverlay = (text = 'processing') => {
    if (!overlay) return;
    overlay.hidden = false;
    if (overlayText) overlayText.textContent = text;
    let phase = 0;
    if (progressTimer) clearInterval(progressTimer);
    progressTimer = setInterval(() => {
      phase = (phase + 1) % 28;
      const bar = '█'.repeat(phase) + '░'.repeat(28 - phase);
      if (overlayArt) overlayArt.textContent =
        '┌──────────────────────────────────┐\n' +
        '│  WORKING                         │\n' +
        '│  ' + bar + '    │\n' +
        '│                                  │\n' +
        '└──────────────────────────────────┘';
    }, 80);
  };

  const hideOverlay = () => {
    if (!overlay) return;
    overlay.hidden = true;
    if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
  };

  // ----- Status -----
  const setCmdState = (text, mode = 'idle') => {
    const node = $('#cmd-state');
    if (!node) return;
    node.textContent = text;
    node.className = 'cmd-state' + (mode !== 'idle' ? ' ' + mode : '');
  };

  // ----- Init -----
  const init = () => {
    const theme = localStorage.getItem(THEME_KEY)
      || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    setTheme(theme);
    const scan = localStorage.getItem(SCAN_KEY);
    if (scan === '0') setScanlines(false);

    $('#theme-toggle')?.addEventListener('click', toggleTheme);
    $('#mobile-nav-btn')?.addEventListener('click', toggleSidebar);

    // Close mobile sidebar when a nav link is clicked
    $$('#sidebar .navitem').forEach(a => a.addEventListener('click', closeSidebar));
  };

  return { init, setTheme, toggleTheme, setScanlines, toast, showOverlay, hideOverlay, setCmdState, closeSidebar };
})();
