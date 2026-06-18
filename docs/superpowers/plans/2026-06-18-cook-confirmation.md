# Cook Confirmation & Pantry Deduction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Just cooked this" button to the recipe detail page that opens a single-modal confirmation flow — adjustable servings, per-ingredient pantry deduction with inline shortfall correction, ad-hoc extra ingredients — and logs a cook entry for analytics.

**Architecture:** Four tasks in dependency order: data layer first (cookLog + functions), then the recipes.js modal (the bulk of the work), then the analytics cook section, then CSS. All modal state is transient DOM; only the final deductions and cook log entry are persisted. The `_buildCookSection()` helper is extracted so it renders in both the empty-state and full-data branches of Analytics.

**Tech Stack:** Vanilla JS IIFE modules, localStorage (`Data._db`), `innerHTML` rendering, CSS variables. No bundler, no test suite — verify manually via `python -m http.server 8000`.

---

### Task 1: Data layer — cookLog

**Files:**
- Modify: `js/data.js`

**Context:** `_db` is the single persisted object. Append `cookLog` alongside `spendLog`. Pattern matches `logSpend` / `getSpendLog` exactly. The return statement is at the bottom of the file (~line 609–622).

- [ ] **Step 1: Add `cookLog: []` to `_db` initial state**

  Find:
  ```js
    spendLog: [],
  };
  ```

  Change to:
  ```js
    spendLog: [],
    cookLog: [],
  };
  ```

- [ ] **Step 2: Add `cookLog` guard in `load()`**

  Find:
  ```js
        if (!_db.deletedRecipeIds) _db.deletedRecipeIds = [];
  ```

  Change to:
  ```js
        if (!_db.deletedRecipeIds) _db.deletedRecipeIds = [];
        if (!_db.cookLog) _db.cookLog = [];
  ```

- [ ] **Step 3: Add `logCook` and `getCookLog` after `updateSpendEntry`**

  Find:
  ```js
    // ── Import / Export ─────────────────
  ```

  Insert before that line:
  ```js
  function getCookLog() {
    return _db.cookLog || [];
  }

  function logCook(entry) {
    if (!_db.cookLog) _db.cookLog = [];
    _db.cookLog.push({
      date: entry.date,
      recipeId: entry.recipeId,
      recipeName: entry.recipeName,
      servings: entry.servings,
      baseServings: entry.baseServings,
    });
    save();
  }

  ```

- [ ] **Step 4: Export both functions in the return statement**

  Find:
  ```js
      getSpendLog, logSpend, clearSpendLog, updateSpendEntry,
  ```

  Change to:
  ```js
      getSpendLog, logSpend, clearSpendLog, updateSpendEntry,
      getCookLog, logCook,
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add js/data.js
  git commit -m "feat(data): add cookLog — logCook, getCookLog"
  ```

---

### Task 2: Cook confirmation modal in recipes.js

**Files:**
- Modify: `js/recipes.js`

**Context:** `openDetail(id)` renders the recipe detail view into `#detail-content`. The `_activeId`, `_baseServings`, `_targetServings` module-level variables are already maintained by `openDetail` and `setServings`. The shared modal is `#modal-overlay` / `#modal-content` — same pattern as `openAddToPlanModal`. `Data.normalizeToBase(qty, unit, gramEquiv?)` returns `[baseQty, baseUnit]`. `Data.setPantryItem(name, { qty, unit })` sets stock. `fmtQty(q)` already exists in this module. There is currently NO `_esc` helper in recipes.js — it must be added.

The current return statement (line 459–461):
```js
  return { render, filter, openDetail, openAddModal, openEditModal, saveModal, confirmDelete,
           parseIngredients, setServings, openAddToPlanModal, confirmAddToPlan,
           editCalories, cancelEditCalories, saveCalories, calculateCalories };
```

- [ ] **Step 1: Add `_esc` helper and `_cookExtraCount` variable near the top of the IIFE**

  Find:
  ```js
  function fmtQty(q) {
  ```

  Insert before `fmtQty`:
  ```js
  function _esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  let _cookExtraCount = 0;

  ```

- [ ] **Step 2: Add "Just cooked this" button to `openDetail()`**

  Find:
  ```js
        <button class="btn-danger" onclick="Recipes.confirmDelete('${r.id}')">🗑 Delete</button>
  ```

  Change to:
  ```js
        <button class="btn-danger" onclick="Recipes.confirmDelete('${r.id}')">🗑 Delete</button>
        <button class="btn-secondary" onclick="Recipes.openCookConfirm('${r.id}')">✅ Just cooked this</button>
  ```

- [ ] **Step 3: Add `_convertFromBase` helper after `normaliseUnit`**

  Find:
  ```js
  function fmtQty(q) {
  ```

  Insert after `_esc` / `_cookExtraCount` block (i.e., just before `fmtQty`):
  ```js
  function _convertFromBase(qty, baseUnit, targetUnit) {
    const t = (targetUnit || '').toLowerCase();
    if (t === 'kg' && baseUnit === 'g')  return { qty: qty / 1000, unit: 'kg' };
    if (t === 'l'  && baseUnit === 'ml') return { qty: qty / 1000, unit: 'l'  };
    return { qty, unit: baseUnit };
  }

  ```

- [ ] **Step 4: Add `_buildIngRows` helper — builds the ingredient rows HTML for the modal**

  Insert after `_convertFromBase`:
  ```js
  function _buildIngRows(r, servings) {
    const ings = parseIngredients(r.ingredients);
    const base = r.servings || 1;
    const mult = (parseFloat(servings) || 1) / base;
    if (!ings.length) return '<p style="color:var(--text-muted);font-size:0.88rem;padding:8px 0">No ingredients listed.</p>';

    return ings.map((ing, i) => {
      if (!ing.qty && ing.qty !== 0) {
        return `<div class="cook-ing-row cook-ing-untracked">
          <span class="cook-ing-name">${_esc(ing.name)}</span>
          <span class="cook-ing-status">no qty — skip</span>
        </div>`;
      }
      const scaledQty = (parseFloat(ing.qty) || 0) * mult;
      const p = Data.getPantryItem(ing.name);

      if (!p || p.qty <= 0) {
        return `<div class="cook-ing-row cook-ing-untracked">
          <span class="cook-ing-name">${_esc(ing.name)}</span>
          <span class="cook-ing-qty">${fmtQty(scaledQty)} ${_esc(ing.unit || '')}</span>
          <span class="cook-ing-status">not tracked</span>
        </div>`;
      }

      const [pBase, pBaseUnit] = Data.normalizeToBase(p.qty, p.unit, p.gramEquiv);
      const [dBase, dBaseUnit] = Data.normalizeToBase(scaledQty, ing.unit || '');

      if (pBaseUnit !== dBaseUnit) {
        return `<div class="cook-ing-row cook-ing-untracked">
          <span class="cook-ing-name">${_esc(ing.name)}</span>
          <span class="cook-ing-qty">${fmtQty(scaledQty)} ${_esc(ing.unit || '')}</span>
          <span class="cook-ing-status">unit mismatch</span>
        </div>`;
      }

      if (pBase >= dBase) {
        const remain = _convertFromBase(pBase - dBase, pBaseUnit, p.unit);
        return `<div class="cook-ing-row cook-ing-normal">
          <span class="cook-ing-name">${_esc(ing.name)}</span>
          <span class="cook-ing-qty">${fmtQty(scaledQty)} ${_esc(ing.unit || '')}</span>
          <span class="cook-ing-status">→ ${fmtQty(remain.qty)} ${_esc(remain.unit)} left</span>
        </div>`;
      }

      // Shortfall
      return `<div class="cook-ing-row cook-ing-shortfall">
        <span class="cook-ing-name">${_esc(ing.name)}</span>
        <span class="cook-ing-qty">${fmtQty(scaledQty)} ${_esc(ing.unit || '')} needed</span>
        <div class="cook-shortfall-row">
          <span class="cook-shortfall-warn">⚠ only ${fmtQty(p.qty)} ${_esc(p.unit)} tracked</span>
          <label class="cook-shortfall-label">Actual used:
            <input type="number" id="cook-actual-${i}" class="cook-actual-input"
              min="0" step="0.01" max="${p.qty}"
              value="${p.qty}"
              data-ing-name="${_esc(ing.name.toLowerCase().trim())}"
              data-pantry-unit="${_esc(p.unit)}"
              data-pantry-qty="${p.qty}" />
            ${_esc(p.unit)}
          </label>
        </div>
      </div>`;
    }).join('');
  }

  ```

- [ ] **Step 5: Add `_deductIngredient` helper — handles pantry deduction for one ingredient**

  Insert after `_buildIngRows`:
  ```js
  function _deductIngredient(name, scaledQty, unit, ingIdx) {
    const p = Data.getPantryItem(name);
    if (!p || p.qty <= 0) return;

    const [pBase, pBaseUnit] = Data.normalizeToBase(p.qty, p.unit, p.gramEquiv);
    const [dBase, dBaseUnit] = Data.normalizeToBase(scaledQty, unit || '');
    if (pBaseUnit !== dBaseUnit) return;

    if (pBase < dBase && ingIdx !== null) {
      const actualInput = document.getElementById('cook-actual-' + ingIdx);
      const actualUsed = actualInput ? (parseFloat(actualInput.value) || 0) : p.qty;
      Data.setPantryItem(name, { qty: Math.max(0, p.qty - actualUsed), unit: p.unit });
    } else {
      const remain = _convertFromBase(Math.max(0, pBase - dBase), pBaseUnit, p.unit);
      Data.setPantryItem(name, { qty: remain.qty, unit: remain.unit });
    }
  }

  ```

- [ ] **Step 6: Add `openCookConfirm`, `_cookRefresh`, `_cookAddExtra`, `confirmCook` before `confirmDelete`**

  Find:
  ```js
  function confirmDelete(id) {
  ```

  Insert before `confirmDelete`:
  ```js
  function openCookConfirm(id) {
    const r = Data.getRecipeById(id);
    if (!r) return;
    _cookExtraCount = 0;
    const servings = _targetServings || r.servings || 1;
    const unitOpts = ['g','100g','kg','ml','100ml','l','item','tsp','tbsp','clove','bunch','head','can','packet','loaf','dozen']
      .map(u => `<option value="${u}"${u === 'item' ? ' selected' : ''}>${u}</option>`).join('');
    document.getElementById('modal-content').innerHTML = `
      <h3>Confirm Cook — ${_esc(r.name)}</h3>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;flex-wrap:wrap">
        <label style="margin:0;font-size:0.9rem;white-space:nowrap">Servings cooked</label>
        <input type="number" id="cook-servings-input" min="1" step="1" value="${servings}"
          style="width:60px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:1rem"
          onchange="Recipes._cookRefresh('${_esc(id)}', this.value)" />
        <span style="font-size:0.82rem;color:var(--text-muted)">(recipe base: ${r.servings || 1})</span>
      </div>
      <div id="cook-ing-rows">${_buildIngRows(r, servings)}</div>
      <div class="cook-extras-title">Extra ingredients used</div>
      <div id="cook-extras-list"></div>
      <button class="btn-small" style="margin-top:4px" onclick="Recipes._cookAddExtra()">＋ Add extra</button>
      <div class="modal-actions" style="margin-top:16px">
        <button class="btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn-primary" onclick="Recipes.confirmCook('${_esc(id)}')">Confirm &amp; save</button>
      </div>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
  }

  function _cookRefresh(id, servings) {
    const r = Data.getRecipeById(id);
    if (!r) return;
    const el = document.getElementById('cook-ing-rows');
    if (el) el.innerHTML = _buildIngRows(r, parseFloat(servings) || 1);
  }

  function _cookAddExtra() {
    const list = document.getElementById('cook-extras-list');
    if (!list) return;
    const n = _cookExtraCount++;
    const unitOpts = ['g','100g','kg','ml','100ml','l','item','tsp','tbsp','clove','bunch','head','can','packet','loaf','dozen']
      .map(u => `<option value="${u}"${u === 'item' ? ' selected' : ''}>${u}</option>`).join('');
    const row = document.createElement('div');
    row.className = 'cook-extra-row';
    row.id = 'cook-extra-row-' + n;
    row.innerHTML = `
      <input type="text" id="cook-extra-name-${n}" placeholder="Ingredient name"
        style="flex:1;min-width:0;padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:0.85rem" />
      <input type="number" id="cook-extra-qty-${n}" placeholder="qty" min="0" step="0.01"
        style="width:60px;padding:4px 6px;border:1px solid var(--border);border-radius:6px;font-size:0.85rem" />
      <select id="cook-extra-unit-${n}"
        style="padding:4px 6px;border:1px solid var(--border);border-radius:6px;font-size:0.85rem">${unitOpts}</select>
      <button onclick="document.getElementById('cook-extra-row-${n}').remove()"
        style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:1.1rem;padding:2px 6px;line-height:1">✕</button>`;
    list.appendChild(row);
  }

  function confirmCook(id) {
    const r = Data.getRecipeById(id);
    if (!r) return;
    const servings = parseFloat(document.getElementById('cook-servings-input')?.value) || r.servings || 1;
    const base = r.servings || 1;
    const mult = servings / base;

    parseIngredients(r.ingredients).forEach((ing, i) => {
      if (!ing.qty && ing.qty !== 0) return;
      _deductIngredient(ing.name, (parseFloat(ing.qty) || 0) * mult, ing.unit || '', i);
    });

    const extrasList = document.getElementById('cook-extras-list');
    if (extrasList) {
      extrasList.querySelectorAll('.cook-extra-row').forEach(row => {
        const n = row.id.replace('cook-extra-row-', '');
        const name = (document.getElementById('cook-extra-name-' + n)?.value || '').trim().toLowerCase();
        const qty  = parseFloat(document.getElementById('cook-extra-qty-' + n)?.value) || 0;
        const unit = document.getElementById('cook-extra-unit-' + n)?.value || 'item';
        if (name && qty > 0) _deductIngredient(name, qty, unit, null);
      });
    }

    Data.logCook({
      date: new Date().toISOString().slice(0, 10),
      recipeId: id,
      recipeName: r.name,
      servings,
      baseServings: base,
    });

    App.closeModal();
    App.toast('Cooked ✓');
    App.refresh();
  }

  ```

- [ ] **Step 7: Update the return statement**

  Find:
  ```js
  return { render, filter, openDetail, openAddModal, openEditModal, saveModal, confirmDelete,
           parseIngredients, setServings, openAddToPlanModal, confirmAddToPlan,
           editCalories, cancelEditCalories, saveCalories, calculateCalories };
  ```

  Change to:
  ```js
  return { render, filter, openDetail, openAddModal, openEditModal, saveModal, confirmDelete,
           parseIngredients, setServings, openAddToPlanModal, confirmAddToPlan,
           editCalories, cancelEditCalories, saveCalories, calculateCalories,
           openCookConfirm, _cookRefresh, _cookAddExtra, confirmCook };
  ```

- [ ] **Step 8: Commit**

  ```bash
  git add js/recipes.js
  git commit -m "feat(recipes): Just cooked this — pantry deduction modal with serving adjust and extras"
  ```

---

### Task 3: Analytics cook log section

**Files:**
- Modify: `js/analytics.js`

**Context:** `render()` currently has an early return when `log.length === 0`. The cook section must render even when there is no spend data, so the early return is updated and a `_buildCookSection()` helper is extracted and called from both branches. `_esc` and `_fmtDate` already exist in this file.

- [ ] **Step 1: Add `_buildCookSection` helper before `render()`**

  Find:
  ```js
  function render() {
  ```

  Insert before `render`:
  ```js
  function _buildCookSection() {
    const cookLog = Data.getCookLog();
    const recentCooks = cookLog.slice().reverse().slice(0, 10);
    const rows = recentCooks.length === 0
      ? '<p class="analytics-empty-sub">No cooks logged yet. Use "Just cooked this" on any recipe.</p>'
      : recentCooks.map(entry => `
          <div class="analytics-cook-row">
            <span class="analytics-cook-date">${_fmtDate(entry.date)}</span>
            <span class="analytics-cook-name">${_esc(entry.recipeName)}</span>
            <span class="analytics-cook-servings">${entry.servings} serving${entry.servings !== 1 ? 's' : ''}</span>
          </div>`).join('');
    return `<div class="analytics-section-title">Recent Cooks</div>${rows}`;
  }

  ```

- [ ] **Step 2: Update the empty-state branch in `render()` to include the cook section**

  Find:
  ```js
    if (log.length === 0) {
      el.innerHTML = `<div class="empty-state"><span class="emoji">📊</span>No spend data yet.<br>Use "Confirm Shop" on the shopping list to log your first shop.</div>`;
      return;
    }
  ```

  Change to:
  ```js
    if (log.length === 0) {
      el.innerHTML = `<div class="empty-state"><span class="emoji">📊</span>No spend data yet.<br>Use "Confirm Shop" on the shopping list to log your first shop.</div>`
        + _buildCookSection();
      return;
    }
  ```

- [ ] **Step 3: Append cook section to the full render output**

  Find:
  ```js
      el.innerHTML = summaryHtml
        + `<div class="analytics-section-title">Monthly Spend</div>${monthlyHtml}`
        + `<div class="analytics-section-title">This Month by Category</div>${catHtml}`
        + `<div class="analytics-section-title">Recent Shops</div>${shopsHtml}`
        + `<button class="btn-danger" style="margin-top:24px;width:100%" onclick="Analytics.clearLog()">🗑 Clear Spend Log</button>`;
  ```

  Change to:
  ```js
      el.innerHTML = summaryHtml
        + `<div class="analytics-section-title">Monthly Spend</div>${monthlyHtml}`
        + `<div class="analytics-section-title">This Month by Category</div>${catHtml}`
        + `<div class="analytics-section-title">Recent Shops</div>${shopsHtml}`
        + `<button class="btn-danger" style="margin-top:24px;width:100%" onclick="Analytics.clearLog()">🗑 Clear Spend Log</button>`
        + _buildCookSection();
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add js/analytics.js
  git commit -m "feat(analytics): add Recent Cooks section from cook log"
  ```

---

### Task 4: CSS — cook modal styles

**Files:**
- Modify: `css/style.css`

**Context:** Append at the very end of the file after the Sub-project B block.

- [ ] **Step 1: Append cook styles to `css/style.css`**

  Append at the very end of the file:
  ```css

  /* ── Cook confirmation modal (Sub-project C) ───────── */

  /* Ingredient rows */
  .cook-ing-row { display: flex; align-items: center; gap: 8px; padding: 5px 0; border-bottom: 1px solid var(--border); font-size: 0.88rem; flex-wrap: wrap; }
  .cook-ing-name { flex: 1; min-width: 120px; text-transform: capitalize; }
  .cook-ing-qty { font-size: 0.82rem; color: var(--text-muted); white-space: nowrap; }
  .cook-ing-status { font-size: 0.8rem; color: var(--md-green); white-space: nowrap; }
  .cook-ing-untracked .cook-ing-name { color: var(--text-muted); }
  .cook-ing-untracked .cook-ing-status { color: var(--text-muted); font-style: italic; }

  /* Shortfall row */
  .cook-ing-shortfall { background: #fffbeb; border-left: 3px solid #f59e0b; padding-left: 6px; border-radius: 2px; }
  .cook-shortfall-row { width: 100%; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 3px; padding-bottom: 2px; }
  .cook-shortfall-warn { font-size: 0.78rem; color: #92400e; }
  .cook-shortfall-label { font-size: 0.82rem; display: flex; align-items: center; gap: 4px; color: var(--text-muted); }
  .cook-actual-input { width: 65px; padding: 2px 6px; border: 1px solid #f59e0b; border-radius: 6px; font-size: 0.82rem; }

  /* Extras section */
  .cook-extras-title { font-size: 0.78rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: .05em; margin: 14px 0 6px; }
  .cook-extra-row { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }

  /* Analytics cook log */
  .analytics-cook-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--border); font-size: 0.88rem; }
  .analytics-cook-date { color: var(--text-muted); font-size: 0.82rem; white-space: nowrap; min-width: 52px; }
  .analytics-cook-name { flex: 1; text-transform: capitalize; }
  .analytics-cook-servings { font-size: 0.8rem; color: var(--text-muted); white-space: nowrap; }
  .analytics-empty-sub { font-size: 0.85rem; color: var(--text-muted); padding: 8px 0; margin: 0; }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add css/style.css
  git commit -m "feat(css): cook confirmation modal and analytics cook log styles"
  ```
