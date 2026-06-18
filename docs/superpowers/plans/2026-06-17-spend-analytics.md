# Spend Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add spend logging ("Complete Shop") and an Analytics view (weekly/monthly spend summaries, category charts, recent shops history) to the recipe book PWA.

**Architecture:** Five tasks — data API, CSS, analytics module, HTML wiring, shopping integration. Tasks 1–4 can be reviewed independently; Task 5 is the final integration point.

**Tech Stack:** Vanilla JS IIFE modules, localStorage, `innerHTML` rendering, CSS flex bars (no SVG/canvas).

---

### Task 1: Spend log data API (`js/data.js`)

**Files:**
- Modify: `js/data.js`

- [ ] **Step 1: Add `spendLog: []` to the `_db` default object**

  The current `_db` default (around line 8) is:
  ```js
  let _db = {
    version: '1.1',
    lastUpdated: new Date().toISOString(),
    recipes: [],
    mealPlan: { week1:{}, week2:{}, week3:{}, week4:{} },
    pantry: [],
    shoppingList: [],
    priceBook: [],
  };
  ```
  Add `spendLog: [],` after `priceBook: [],`.

- [ ] **Step 2: Add `spendLog` initialisation guard in `load()`**

  After the existing `if (!_db.priceBook) _db.priceBook = [];` line in `load()`, add:
  ```js
  if (!_db.spendLog) _db.spendLog = [];
  ```

- [ ] **Step 3: Add three new functions after `clearPantryPerishables`**

  ```js
  function getSpendLog()        { return _db.spendLog || []; }

  function logSpend(entry) {
    if (!_db.spendLog) _db.spendLog = [];
    _db.spendLog.push({ date: entry.date, total: entry.total, items: entry.items });
    save();
  }

  function clearSpendLog() {
    _db.spendLog = [];
    save();
  }
  ```

- [ ] **Step 4: Add three functions to the return statement**

  Add `getSpendLog, logSpend, clearSpendLog,` to the return object (after the pantry exports).

- [ ] **Step 5: Commit**

  ```bash
  git add js/data.js
  git commit -m "feat(data): add spendLog — getSpendLog, logSpend, clearSpendLog"
  ```

---

### Task 2: Analytics CSS (`css/style.css`)

**Files:**
- Modify: `css/style.css`

- [ ] **Step 1: Read the end of `css/style.css`**

  Confirm the current last line before appending.

- [ ] **Step 2: Append analytics styles**

  Append to end of file:

  ```css

  /* ── Analytics view ────────────────────────────────────── */
  .analytics-summary { display:flex; gap:12px; margin-bottom:24px; flex-wrap:wrap; }
  .analytics-card { flex:1; min-width:120px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:16px; text-align:center; }
  .analytics-card-label { font-size:0.75rem; color:var(--text-muted); margin-bottom:4px; }
  .analytics-card-value { font-size:1.4rem; font-weight:700; color:var(--dk-green); }
  .analytics-section-title { font-weight:700; margin:20px 0 10px; }
  .analytics-bar-row { display:flex; align-items:center; gap:10px; margin-bottom:8px; font-size:0.85rem; }
  .analytics-bar-label { width:90px; flex-shrink:0; }
  .analytics-bar-track { flex:1; background:var(--border); border-radius:4px; height:14px; overflow:hidden; }
  .analytics-bar-fill { height:100%; background:var(--md-green); border-radius:4px; transition:width 0.3s; }
  .analytics-bar-amount { width:70px; text-align:right; flex-shrink:0; }
  .analytics-shop-row { border-bottom:1px solid var(--border); padding:12px 0; }
  .analytics-shop-header { display:flex; justify-content:space-between; align-items:center; cursor:pointer; }
  .analytics-shop-date { font-weight:600; }
  .analytics-shop-total { color:var(--dk-green); font-weight:700; }
  .analytics-shop-detail { font-size:0.82rem; color:var(--text-muted); padding:8px 0 0; display:none; }
  .analytics-shop-detail.open { display:block; }
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add css/style.css
  git commit -m "feat(css): add analytics view styles"
  ```

---

### Task 3: Create `js/analytics.js`

**Files:**
- Create: `js/analytics.js`

- [ ] **Step 1: Create the file with this complete content**

  ```js
  /* ══════════════════════════════════════
     analytics.js — Spend analytics view
     ══════════════════════════════════════ */

  const Analytics = (() => {

    const CATEGORIES = [
      { name: 'Protein',    keywords: ['beef','chicken','pork','lamb','fish','egg','mince','sausage','bacon','tuna'] },
      { name: 'Dairy',      keywords: ['milk','cheese','yogurt','butter','cream','yoghurt'] },
      { name: 'Vegetables', keywords: ['onion','carrot','potato','tomato','lettuce','spinach','garlic','broccoli','pepper','celery','cabbage'] },
      { name: 'Fruit',      keywords: ['apple','banana','orange','lemon','grape','strawberry','avocado'] },
      { name: 'Grains',     keywords: ['bread','rice','pasta','flour','oat','cereal','noodle'] },
      { name: 'Pantry',     keywords: ['oil','sugar','salt','sauce','vinegar','spice','herb','stock','tin','can'] },
    ];

    function _guessCategory(name) {
      const lower = (name || '').toLowerCase();
      for (const cat of CATEGORIES) {
        if (cat.keywords.some(k => lower.includes(k))) return cat.name;
      }
      return 'Other';
    }

    function _today() { return new Date().toISOString().slice(0, 10); }

    function _startOfWeek(dateStr) {
      const d = new Date(dateStr + 'T00:00:00');
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const mon = new Date(d);
      mon.setDate(d.getDate() + diff);
      return mon.toISOString().slice(0, 10);
    }

    function _fmtDate(dateStr) {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const p = dateStr.split('-');
      return parseInt(p[2], 10) + ' ' + months[parseInt(p[1], 10) - 1];
    }

    function _fmtMonth(dateStr) {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const p = dateStr.split('-');
      return months[parseInt(p[1], 10) - 1] + ' ' + p[0];
    }

    function _fmtR(n) {
      return 'R ' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    function _bar(label, value, maxValue, amount) {
      const pct = maxValue > 0 ? (value / maxValue * 100).toFixed(1) : 0;
      return `
        <div class="analytics-bar-row">
          <span class="analytics-bar-label">${label}</span>
          <div class="analytics-bar-track">
            <div class="analytics-bar-fill" style="width:${pct}%"></div>
          </div>
          <span class="analytics-bar-amount">${_fmtR(amount)}</span>
        </div>`;
    }

    function render() {
      const el = document.getElementById('analytics-content');
      if (!el) return;
      const log = Data.getSpendLog();

      if (log.length === 0) {
        el.innerHTML = `<div class="empty-state"><span class="emoji">📊</span>No spend data yet.<br>Use "Complete Shop" on the shopping list to log your first shop.</div>`;
        return;
      }

      const today = _today();
      const weekStart = _startOfWeek(today);
      const monthKey = today.slice(0, 7);

      const thisWeek  = log.filter(e => e.date >= weekStart).reduce((s, e) => s + e.total, 0);
      const thisMonth = log.filter(e => e.date.slice(0,7) === monthKey).reduce((s, e) => s + e.total, 0);
      const allTime   = log.reduce((s, e) => s + e.total, 0);

      // ── Summary cards ──────────────────────────────
      const summaryHtml = `
        <div class="analytics-summary">
          <div class="analytics-card">
            <div class="analytics-card-label">This week</div>
            <div class="analytics-card-value">${_fmtR(thisWeek)}</div>
          </div>
          <div class="analytics-card">
            <div class="analytics-card-label">This month</div>
            <div class="analytics-card-value">${_fmtR(thisMonth)}</div>
          </div>
          <div class="analytics-card">
            <div class="analytics-card-label">All time</div>
            <div class="analytics-card-value">${_fmtR(allTime)}</div>
          </div>
        </div>`;

      // ── Monthly bar chart (last 6 months) ──────────
      const monthlyTotals = {};
      const todayDate = new Date(today + 'T00:00:00');
      const monthKeys = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(todayDate.getFullYear(), todayDate.getMonth() - i, 1);
        const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        monthKeys.push(key);
        monthlyTotals[key] = 0;
      }
      log.forEach(e => {
        const k = e.date.slice(0, 7);
        if (k in monthlyTotals) monthlyTotals[k] += e.total;
      });
      const maxMonthly = Math.max(...Object.values(monthlyTotals), 1);
      const monthlyHtml = monthKeys.map(k =>
        _bar(_fmtMonth(k + '-01'), monthlyTotals[k], maxMonthly, monthlyTotals[k])
      ).join('');

      // ── Category breakdown (current month) ─────────
      const catTotals = {};
      log.filter(e => e.date.slice(0, 7) === monthKey).forEach(e => {
        (e.items || []).forEach(item => {
          const cat = _guessCategory(item.name);
          catTotals[cat] = (catTotals[cat] || 0) + item.cost;
        });
      });
      const catEntries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
      const maxCat = catEntries.length > 0 ? catEntries[0][1] : 1;
      const catHtml = catEntries.length > 0
        ? catEntries.map(([cat, total]) => _bar(cat, total, maxCat, total)).join('')
        : `<p style="color:var(--text-muted);font-size:0.85rem">No category data for this month.</p>`;

      // ── Recent shops (last 5, newest first) ────────
      const recentShops = log.slice().reverse().slice(0, 5);
      const shopsHtml = recentShops.map((entry, i) => {
        const detailRows = (entry.items || []).map(item =>
          `<div>${item.name} × ${item.qty} ${item.unit} — ${_fmtR(item.cost)}</div>`
        ).join('');
        return `
          <div class="analytics-shop-row">
            <div class="analytics-shop-header" onclick="this.nextElementSibling.classList.toggle('open')">
              <span class="analytics-shop-date">${_fmtDate(entry.date)}</span>
              <span class="analytics-shop-total">${_fmtR(entry.total)}</span>
            </div>
            <div class="analytics-shop-detail">${detailRows}</div>
          </div>`;
      }).join('');

      el.innerHTML = summaryHtml
        + `<div class="analytics-section-title">Monthly Spend</div>${monthlyHtml}`
        + `<div class="analytics-section-title">This Month by Category</div>${catHtml}`
        + `<div class="analytics-section-title">Recent Shops</div>${shopsHtml}`
        + `<button class="btn-danger" style="margin-top:24px;width:100%" onclick="Analytics.clearLog()">🗑 Clear Spend Log</button>`;
    }

    function clearLog() {
      if (!confirm('Clear all spend history? This cannot be undone.')) return;
      Data.clearSpendLog();
      render();
      App.toast('Spend log cleared');
    }

    return { render, clearLog };
  })();
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add js/analytics.js
  git commit -m "feat(analytics): new Analytics IIFE module — summary cards, monthly/category bar charts, recent shops"
  ```

---

### Task 4: HTML wiring (`index.html`)

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add `#view-analytics` section before `</main>`**

  After the `<!-- PANTRY -->` section (which ends with `</section>` around line 170), insert before `</main>`:

  ```html

      <!-- ANALYTICS -->
      <section id="view-analytics" class="view">
        <div class="section-header">
          <h2>Spend Analytics</h2>
        </div>
        <div id="analytics-content"></div>
      </section>
  ```

- [ ] **Step 2: Add script tag**

  In the scripts block, add `<script src="js/analytics.js"></script>` AFTER `js/pantry.js` and BEFORE `js/app.js`:

  ```html
  <script src="js/pantry.js"></script>
  <script src="js/analytics.js"></script>
  <script src="js/app.js"></script>
  ```

- [ ] **Step 3: Add Spend Analytics settings group**

  After the Pantry settings group (which ends around line 131 with `</div>`), add:

  ```html
      <div class="settings-group">
        <h3>Spend Analytics</h3>
        <p class="hint">Track your grocery spend over time with weekly and monthly breakdowns.</p>
        <button class="btn-secondary" onclick="App.pushView('analytics','Spend Analytics'); Analytics.render()">View Analytics →</button>
      </div>
  ```

- [ ] **Step 4: Add "Complete Shop" button to shopping list header**

  The current shopping section header buttons are:
  ```html
  <button class="btn-small" onclick="App.pushView('pricebook','Price Book'); PriceBook.render()">Price Book</button>
  <button class="btn-small" onclick="App.pushView('pantry','Pantry'); Pantry.render()">Pantry</button>
  <button class="btn-small" onclick="Shopping.openLogPurchase()">Log Purchase</button>
  <button class="btn-small" onclick="Shopping.clearChecked()">Clear checked</button>
  ```

  Add "Complete Shop" between "Log Purchase" and "Clear checked":
  ```html
  <button class="btn-small" onclick="App.pushView('pricebook','Price Book'); PriceBook.render()">Price Book</button>
  <button class="btn-small" onclick="App.pushView('pantry','Pantry'); Pantry.render()">Pantry</button>
  <button class="btn-small" onclick="Shopping.openLogPurchase()">Log Purchase</button>
  <button class="btn-small" onclick="Shopping.openCompleteShop()">Complete Shop</button>
  <button class="btn-small" onclick="Shopping.clearChecked()">Clear checked</button>
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add index.html
  git commit -m "feat(html): add analytics view, script tag, settings nav, Complete Shop button"
  ```

---

### Task 5: Shopping list "Complete Shop" integration (`js/shopping.js`)

**Files:**
- Modify: `js/shopping.js`

Context: `shopping.js` already has `openLogPurchase` and `confirmPurchase`. This task adds the spend-logging flow.

- [ ] **Step 1: Add `_pendingSpend` module-level variable**

  Near `let _logItems = []`, add:
  ```js
  let _pendingSpend = null;
  ```

- [ ] **Step 2: Add `openCompleteShop()` after `confirmPurchase()`**

  ```js
  function openCompleteShop() {
    const items = Data.getShoppingList();
    const pricedItems = items.map(item => {
      const cost = Data.lookupPrice(item.name, item.qty, item.unit);
      return cost != null && cost > 0 ? { name: item.name, qty: item.qty, unit: item.unit, cost } : null;
    }).filter(Boolean);

    if (pricedItems.length === 0) {
      App.toast('No prices set — add prices to the Price Book first', 'warn');
      return;
    }

    const total = Math.round(pricedItems.reduce((s, i) => s + i.cost, 0) * 100) / 100;
    _pendingSpend = {
      date: new Date().toISOString().slice(0, 10),
      total,
      items: pricedItems,
    };

    const rows = pricedItems.map(item =>
      `<div style="padding:4px 0;font-size:0.9rem">${_esc(item.name)} × ${item.qty || ''} ${_esc(item.unit || '')} — R${item.cost.toFixed(2)}</div>`
    ).join('');

    document.getElementById('modal-content').innerHTML = `
      <h3>Complete Shop</h3>
      <div style="max-height:40vh;overflow-y:auto;margin-bottom:12px">${rows}</div>
      <div style="font-weight:700;font-size:1.05rem;margin-bottom:16px">Total: R${total.toFixed(2)}</div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn-primary" onclick="Shopping.confirmCompleteShop()">Log Spend &amp; Clear List</button>
      </div>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
  }
  ```

- [ ] **Step 3: Add `confirmCompleteShop()` after `openCompleteShop()`**

  ```js
  function confirmCompleteShop() {
    if (!_pendingSpend) return;
    Data.logSpend(_pendingSpend);
    _pendingSpend = null;
    clearChecked();
    App.closeModal();
    App.toast('Shop logged ✓');
    render();
  }
  ```

- [ ] **Step 4: Update the return statement**

  Current:
  ```js
  return { render, toggle, toggleSources, clearChecked, editPrice, savePrice, openLogPurchase, confirmPurchase };
  ```

  Change to:
  ```js
  return { render, toggle, toggleSources, clearChecked, editPrice, savePrice, openLogPurchase, confirmPurchase, openCompleteShop, confirmCompleteShop };
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add js/shopping.js
  git commit -m "feat(shopping): add Complete Shop flow — logs spend entry, clears list"
  ```
