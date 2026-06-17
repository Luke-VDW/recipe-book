/* ══════════════════════════════════════
   app.js — Router, App shell, Timer, Settings
   ══════════════════════════════════════ */

// ── Settings ─────────────────────────
const Settings = (() => {
  function init() {
    const key = localStorage.getItem('rb_spoon_key') || '';
    const inp = document.getElementById('spoon-key-input');
    if (inp && key) inp.value = key;
    const quota = localStorage.getItem('rb_spoon_quota');
    const quotaEl = document.getElementById('spoon-quota-display');
    if (quotaEl) quotaEl.textContent = quota ? `API quota remaining today: ${quota} points` : '';
    updateDriveStatus();
  }

  function saveSpoonKey() {
    const v = document.getElementById('spoon-key-input').value.trim();
    if (!v) { App.toast('Please enter a key', 'warn'); return; }
    localStorage.setItem('rb_spoon_key', v);
    App.toast('Spoonacular API key saved ✓');
  }

  function updateDriveStatus() {
    const el = document.getElementById('drive-status');
    if (!el) return;
    if (Data.isDriveConnected()) {
      el.textContent = '✓ Connected';
      el.classList.add('connected');
    } else {
      el.textContent = 'Not connected';
      el.classList.remove('connected');
    }
  }

  return { init, saveSpoonKey, updateDriveStatus };
})();

// ── Timer ─────────────────────────────
const Timer = (() => {
  let _interval = null;
  let _remaining = 0;
  let _running = false;

  function open() {
    document.getElementById('timer-modal').classList.remove('hidden');
    reset();
  }

  function close() {
    document.getElementById('timer-modal').classList.add('hidden');
    clearInterval(_interval);
    _running = false;
  }

  function start() {
    if (_running) return;
    if (_remaining === 0) {
      const mins = parseInt(document.getElementById('timer-input').value) || 30;
      _remaining = mins * 60;
    }
    _running = true;
    _interval = setInterval(() => {
      _remaining--;
      _updateDisplay();
      if (_remaining <= 0) {
        clearInterval(_interval);
        _running = false;
        document.getElementById('timer-display').textContent = '00:00';
        document.getElementById('timer-display').style.color = '#dc2626';
        // Try notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Recipe Book', { body: 'Timer done! 🍳', icon: 'icons/icon-192.png' });
        } else {
          alert('⏱ Timer done!');
        }
      }
    }, 1000);
  }

  function pause() {
    clearInterval(_interval);
    _running = false;
  }

  function reset() {
    clearInterval(_interval);
    _running = false;
    _remaining = 0;
    _updateDisplay();
    document.getElementById('timer-display').style.color = '';
  }

  function _updateDisplay() {
    const m = Math.floor(_remaining / 60).toString().padStart(2,'0');
    const s = (_remaining % 60).toString().padStart(2,'0');
    const el = document.getElementById('timer-display');
    if (el) el.textContent = `${m}:${s}`;
  }

  return { open, close, start, pause, reset };
})();

// ── App Router ────────────────────────
const App = (() => {
  let _currentView = 'recipes';
  let _viewStack   = ['recipes'];

  function init() {
    // Load data
    Data.load();
    Data.loadStarterData();

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(console.warn);
    }

    // Request notification permission for timer
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Init modules
    Settings.init();
    Importer.init();

    // Render default view
    Recipes.render();

    // Handle browser back
    window.addEventListener('popstate', () => {
      if (_viewStack.length > 1) {
        _viewStack.pop();
        const prev = _viewStack[_viewStack.length - 1];
        _showView(prev);
      }
    });

    // Check Spoonacular key notice on import view
    _checkImportKey();
  }

  function _checkImportKey() {
    const notice = document.getElementById('import-key-notice');
    if (!notice) return;
    if (!Importer.getKey()) notice.classList.remove('hidden');
    else notice.classList.add('hidden');
  }

  function nav(viewName, btnEl) {
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    else {
      const btn = document.querySelector(`[data-view="${viewName}"]`);
      if (btn) btn.classList.add('active');
    }

    _viewStack = [viewName];
    _showView(viewName);
    history.pushState(null, '', '#' + viewName);

    // Lazy renders
    if (viewName === 'planner')  Planner.render();
    if (viewName === 'shopping') Shopping.render();
    if (viewName === 'settings') { Settings.init(); _checkImportKey(); }
    if (viewName === 'recipes')  Recipes.render();

    // Topbar
    const titles = {
      recipes:'📖 Recipe Book', planner:'🗓 Meal Planner',
      shopping:'🛒 Shopping List', import:'🔍 Import Recipe',
      settings:'⚙️ Settings', detail:'',
    };
    document.getElementById('topbar-title').textContent = titles[viewName] || '📖 Recipe Book';
    document.getElementById('btn-back').classList.add('hidden');
  }

  function pushView(viewName, title) {
    _viewStack.push(viewName);
    _showView(viewName);
    history.pushState(null, '', '#' + viewName);
    document.getElementById('topbar-title').textContent = title || viewName;
    document.getElementById('btn-back').classList.remove('hidden');
  }

  function _showView(name) {
    _currentView = name;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const el = document.getElementById('view-' + name);
    if (el) el.classList.add('active');
  }

  function goBack() {
    if (_viewStack.length > 1) {
      _viewStack.pop();
      const prev = _viewStack[_viewStack.length - 1];
      _showView(prev);
      history.back();
      if (_viewStack.length <= 1) {
        document.getElementById('btn-back').classList.add('hidden');
        const titles = {
          recipes:'📖 Recipe Book', planner:'🗓 Meal Planner',
          shopping:'🛒 Shopping List', import:'🔍 Import Recipe', settings:'⚙️ Settings',
        };
        document.getElementById('topbar-title').textContent = titles[prev] || '📖 Recipe Book';
      }
    }
  }

  function closeModal(event) {
    if (!event || event.target === document.getElementById('modal-overlay')) {
      document.getElementById('modal-overlay').classList.add('hidden');
    }
  }

  function refresh() {
    if (_currentView === 'recipes')  Recipes.render();
    if (_currentView === 'planner')  Planner.render();
    if (_currentView === 'shopping') Shopping.render();
  }

  // ── Toast notifications ─────────────
  let _toastTimeout;
  function toast(msg, type) {
    let el = document.getElementById('app-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'app-toast';
      el.style.cssText = `
        position:fixed; bottom:calc(var(--nav-h) + 16px); left:50%; transform:translateX(-50%);
        background:#1b1b1b; color:#fff; padding:10px 18px; border-radius:20px;
        font-size:.88rem; font-weight:600; z-index:500; white-space:nowrap;
        box-shadow:0 4px 12px rgba(0,0,0,.25); transition:opacity .2s;
      `;
      document.body.appendChild(el);
    }
    if (type === 'warn')  el.style.background = '#b45309';
    else if (type === 'error') el.style.background = '#dc2626';
    else el.style.background = '#1b1b1b';
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(_toastTimeout);
    _toastTimeout = setTimeout(() => { el.style.opacity = '0'; }, 3000);
  }

  return { init, nav, pushView, goBack, closeModal, refresh, toast };
})();

// ── Boot ──────────────────────────────
document.addEventListener('DOMContentLoaded', () => App.init());
