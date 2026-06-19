# Sub-project F: Pantry Date Batches + FIFO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track pantry stock as dated batches; FIFO deduction during cooking; Settings toggle; batch display in pantry view.

**Architecture:** Data layer first (`data.js`), then UI consumers (`pantry.js`, `shopping.js`, `recipes.js`, `index.html`), then CSS.

**Tech Stack:** Vanilla JS, no build step.

---

### Task 1: `data.js` — batch model, addPantryBatch, deductPantryFIFO, FIFO settings

**Files:**
- Modify: `js/data.js`

**Context:** `setPantryItem` is at line 58. `load()` migrates data on startup. `normalizeToBase(qty, unit, gramEquiv)` exists and handles unit conversion.

- [ ] **Step 1: Add batch migration in `load()`**

  In `js/data.js`, find the `load()` function. Find where the pantry initialisation guard is (the `if (!_db.pantry)` line). After it, add:

  ```js
  // Migrate: add batches to pantry items that have none
  (_db.pantry || []).forEach(item => {
    if (!item.batches) {
      item.batches = [{ qty: item.qty || 0, date: item.updatedDate || '' }];
    }
  });
  // Init settings
  if (!_db.settings) _db.settings = {};
  if (_db.settings.fifo === undefined) _db.settings.fifo = true;
  ```

  To find the right place, look for the guard: `if (!_db.pantry) _db.pantry = [];` inside `load()` (around line 40–55 in data.js). Add the migration block immediately after it.

- [ ] **Step 2: Update `setPantryItem` to sync batches**

  Find in `js/data.js`:
  ```js
  function setPantryItem(ingredientName, opts) {
    if (!_db.pantry) _db.pantry = [];
    const name = (ingredientName || '').toLowerCase().trim();
    let item = _db.pantry.find(p => p.ingredient.toLowerCase() === name);
    if (!item) {
      item = { ingredient: name, qty: 0, unit: 'item', updatedDate: '', perishable: false };
      _db.pantry.push(item);
    }
    item.qty = parseFloat(opts.qty) || 0;
    item.unit = opts.unit || item.unit;
    if (opts.gramEquiv) { item.gramEquiv = parseFloat(opts.gramEquiv); } else { delete item.gramEquiv; }
    if (opts.perishable !== undefined) item.perishable = !!opts.perishable;
    item.updatedDate = new Date().toISOString().slice(0, 10);
    save();
  }
  ```

  Change to:
  ```js
  function setPantryItem(ingredientName, opts) {
    if (!_db.pantry) _db.pantry = [];
    const name = (ingredientName || '').toLowerCase().trim();
    let item = _db.pantry.find(p => p.ingredient.toLowerCase() === name);
    if (!item) {
      item = { ingredient: name, qty: 0, unit: 'item', updatedDate: '', perishable: false, batches: [] };
      _db.pantry.push(item);
    }
    const today = new Date().toISOString().slice(0, 10);
    item.qty = parseFloat(opts.qty) || 0;
    item.unit = opts.unit || item.unit;
    if (opts.gramEquiv) { item.gramEquiv = parseFloat(opts.gramEquiv); } else { delete item.gramEquiv; }
    if (opts.perishable !== undefined) item.perishable = !!opts.perishable;
    item.updatedDate = today;
    // Sync batches: manual set replaces with a single batch
    item.batches = [{ qty: item.qty, date: today }];
    save();
  }
  ```

- [ ] **Step 3: Add `addPantryBatch()` function after `setPantryItem`**

  After the `setPantryItem` function, add:

  ```js
  function addPantryBatch(ingredientName, qty, unit, opts) {
    if (!_db.pantry) _db.pantry = [];
    const name = (ingredientName || '').toLowerCase().trim();
    const today = new Date().toISOString().slice(0, 10);
    const batchQty = parseFloat(qty) || 0;
    let item = _db.pantry.find(p => p.ingredient.toLowerCase() === name);
    if (!item) {
      item = { ingredient: name, qty: 0, unit: unit || 'item', updatedDate: today, perishable: false, batches: [] };
      _db.pantry.push(item);
    }
    if (unit) item.unit = unit;
    const gramEquiv = (opts && opts.gramEquiv) ? parseFloat(opts.gramEquiv) : undefined;
    if (gramEquiv) item.gramEquiv = gramEquiv;
    if (opts && opts.perishable !== undefined) item.perishable = !!opts.perishable;
    if (!item.batches) item.batches = [];
    item.batches.push({ qty: batchQty, date: (opts && opts.date) || today });
    item.qty = item.batches.reduce((s, b) => s + (parseFloat(b.qty) || 0), 0);
    item.updatedDate = today;
    save();
  }
  ```

- [ ] **Step 4: Add `deductPantryFIFO()` function after `addPantryBatch`**

  ```js
  function deductPantryFIFO(ingredientName, deductAmt, unit) {
    const name = (ingredientName || '').toLowerCase().trim();
    const item = (_db.pantry || []).find(p => p.ingredient.toLowerCase() === name);
    if (!item) return;
    if (!item.batches) item.batches = [{ qty: item.qty || 0, date: item.updatedDate || '' }];

    // Convert deductAmt to item's native unit if needed
    let toDeduct = parseFloat(deductAmt) || 0;
    if (unit && unit !== item.unit && item.gramEquiv) {
      const baseAmt = normalizeToBase(toDeduct, unit, item.gramEquiv);
      const baseItem = normalizeToBase(1, item.unit, item.gramEquiv);
      if (baseItem > 0) toDeduct = baseAmt / baseItem;
    }

    // Sort oldest first (empty date treated as oldest)
    item.batches.sort((a, b) => (a.date || '') < (b.date || '') ? -1 : 1);

    let remaining = toDeduct;
    item.batches = item.batches.map(batch => {
      if (remaining <= 0) return batch;
      const take = Math.min(batch.qty, remaining);
      remaining -= take;
      return { ...batch, qty: batch.qty - take };
    }).filter(b => b.qty > 0.0001);

    item.qty = Math.max(0, item.batches.reduce((s, b) => s + b.qty, 0));
    item.updatedDate = new Date().toISOString().slice(0, 10);
    save();
    return item;
  }
  ```

- [ ] **Step 5: Add `getFIFO()`, `setFIFO()`, and `clearPantryPerishables()` batch update**

  After `deductPantryFIFO`, add:
  ```js
  function getFIFO() {
    if (!_db.settings) return true;
    return _db.settings.fifo !== false;
  }

  function setFIFO(enabled) {
    if (!_db.settings) _db.settings = {};
    _db.settings.fifo = !!enabled;
    save();
  }
  ```

  Also update `clearPantryPerishables()` to clear batches for perishables:

  Find in `js/data.js`:
  ```js
  function clearPantryPerishables() {
    if (!_db.pantry) return;
    const hasPerishables = _db.pantry.some(p => p.perishable);
    if (!hasPerishables) return;
    _db.pantry.forEach(p => { if (p.perishable) p.qty = 0; });
    save();
  }
  ```

  Change to:
  ```js
  function clearPantryPerishables() {
    if (!_db.pantry) return;
    const hasPerishables = _db.pantry.some(p => p.perishable);
    if (!hasPerishables) return;
    const today = new Date().toISOString().slice(0, 10);
    _db.pantry.forEach(p => {
      if (p.perishable) {
        p.qty = 0;
        p.batches = [{ qty: 0, date: today }];
      }
    });
    save();
  }
  ```

- [ ] **Step 6: Export new functions in `data.js` return statement**

  Find in `js/data.js`:
  ```js
    setPantryItem, removePantryItem, clearPantryPerishables, getPantryItem,
  ```

  Change to:
  ```js
    setPantryItem, addPantryBatch, deductPantryFIFO, getFIFO, setFIFO,
    removePantryItem, clearPantryPerishables, getPantryItem,
  ```

- [ ] **Step 7: Commit**

  ```bash
  git add js/data.js
  git commit -m "feat(data): pantry batch model, addPantryBatch, deductPantryFIFO, FIFO settings"
  ```

---

### Task 2: `js/pantry.js` — show batches in cards; `js/shopping.js` — use addPantryBatch

**Files:**
- Modify: `js/pantry.js`
- Modify: `js/shopping.js`

**Context:**
- `pantry.js` renders cards in `render()`. Each `item` now has `item.batches`.
- `shopping.js` `confirmShop()` currently calls `Data.setPantryItem` for bought items. Change to `Data.addPantryBatch`.

#### pantry.js changes

- [ ] **Step 1: Add `_fmtBatchDate()` helper**

  In `js/pantry.js`, after `function _fmtQty(q) { ... }`, add:

  ```js
  function _fmtBatchDate(dateStr) {
    if (!dateStr) return 'undated';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const now = new Date();
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const dayStr = d.getDate() + ' ' + months[d.getMonth()];
    return d.getFullYear() !== now.getFullYear() ? dayStr + ' ' + d.getFullYear() : dayStr;
  }
  ```

- [ ] **Step 2: Add `_fmtBatches()` helper**

  After `_fmtBatchDate`, add:

  ```js
  function _fmtBatches(item) {
    const batches = (item.batches || []).filter(b => (parseFloat(b.qty) || 0) > 0);
    if (batches.length === 0) return '';
    const fifo = Data.getFIFO();
    const sorted = [...batches].sort((a, b) => (a.date || '') < (b.date || '') ? -1 : 1);
    const rows = sorted.map(b =>
      `<div class="pantry-batch-row">${_fmtQty(b.qty)} ${_esc(item.unit)} · ${_fmtBatchDate(b.date)}</div>`
    ).join('');
    const badge = (batches.length > 1 && fifo)
      ? `<span class="pantry-fifo-badge">FIFO</span>` : '';
    return `<div class="pantry-batch-list">${rows}${badge}</div>`;
  }
  ```

- [ ] **Step 3: Add batch display to each pantry card in `render()`**

  Find in `js/pantry.js`:
  ```js
            <div class="pantry-card-left">
              <span class="pantry-card-name">${_esc(item.ingredient)}</span>
              <span class="pantry-card-qty">${_fmtQty(item.qty)} ${_esc(item.unit)}</span>
              ${perishableHtml}
            </div>
  ```

  Change to:
  ```js
            <div class="pantry-card-left">
              <span class="pantry-card-name">${_esc(item.ingredient)}</span>
              <span class="pantry-card-qty">${_fmtQty(item.qty)} ${_esc(item.unit)}</span>
              ${perishableHtml}
              ${_fmtBatches(item)}
            </div>
  ```

#### shopping.js changes

- [ ] **Step 4: Replace `setPantryItem` with `addPantryBatch` in `confirmShop()`**

  Find in `js/shopping.js`:
  ```js
    // 2. Update pantry for bought items (preserve gramEquiv to avoid unit-conversion data loss)
    bought.forEach(item => {
      const purchaseQty = _confirmQtyOverrides[item._origIdx] ?? item.qty;
      if (purchaseQty) {
        const existing = Data.getPantryItem(item.name);
        Data.setPantryItem(item.name, { qty: purchaseQty, unit: item.unit || 'item', gramEquiv: existing?.gramEquiv });
      }
    });
  ```

  Change to:
  ```js
    // 2. Update pantry for bought items (add as new batch for FIFO tracking)
    bought.forEach(item => {
      const purchaseQty = _confirmQtyOverrides[item._origIdx] ?? item.qty;
      if (purchaseQty) {
        const existing = Data.getPantryItem(item.name);
        Data.addPantryBatch(item.name, purchaseQty, item.unit || 'item', { gramEquiv: existing?.gramEquiv });
      }
    });
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add js/pantry.js js/shopping.js
  git commit -m "feat(pantry): show batch dates in pantry cards; shopping uses addPantryBatch"
  ```

---

### Task 3: `js/recipes.js` — FIFO deduction; `index.html` + `js/app.js` — settings toggle; `css/style.css` — batch styles

**Files:**
- Modify: `js/recipes.js`
- Modify: `index.html`
- Modify: `js/app.js`
- Modify: `css/style.css`

#### recipes.js changes

**Context:** `_deductIngredient(name, scaledQty, unit, ingIdx)` calls `Data.setPantryItem` in two places. The normal deduction path sets `remain.qty` (pantry minus used). The shortfall path sets `0`. Find these two `setPantryItem` calls.

- [ ] **Step 1: Replace normal deduction path with FIFO-aware deduction**

  In `js/recipes.js`, find `_deductIngredient`. There are two `Data.setPantryItem` calls:

  **Normal path** (pantry has enough stock):
  ```js
    Data.setPantryItem(name, { qty: remain.qty, unit: remain.unit, gramEquiv: p.gramEquiv });
  ```

  Change to:
  ```js
    if (Data.getFIFO()) {
      Data.deductPantryFIFO(name, actualUsed, unit);
    } else {
      Data.setPantryItem(name, { qty: remain.qty, unit: remain.unit, gramEquiv: p.gramEquiv });
    }
  ```

  **Shortfall path** (pantry has less than needed — deduct to zero):
  ```js
    Data.setPantryItem(name, { qty: Math.max(0, p.qty - actualUsed), unit: p.unit, gramEquiv: p.gramEquiv }); // shortfall
  ```

  Change to:
  ```js
    if (Data.getFIFO()) {
      Data.deductPantryFIFO(name, actualUsed, unit);
    } else {
      Data.setPantryItem(name, { qty: Math.max(0, p.qty - actualUsed), unit: p.unit, gramEquiv: p.gramEquiv });
    }
  ```

  Note: `deductPantryFIFO` handles the shortfall case naturally by deducting as much as available and clamping to 0.

#### index.html + app.js changes

- [ ] **Step 2: Add FIFO settings toggle in `index.html`**

  Find in `index.html`:
  ```html
      <div class="settings-group">
        <h3>Spend Analytics</h3>
  ```

  Insert before it:
  ```html
      <div class="settings-group">
        <h3>Pantry FIFO</h3>
        <p class="hint">When cooking, deduct stock from the oldest batch first.</p>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="settings-fifo-toggle" onchange="Settings.setFIFO(this.checked)" />
          Use FIFO deduction (oldest batch first)
        </label>
      </div>
  ```

- [ ] **Step 3: Add `setFIFO()` to `Settings` in `js/app.js`**

  Find in `js/app.js`:
  ```js
    function init() {
      const key = localStorage.getItem('rb_spoon_key') || '';
      const inp = document.getElementById('spoon-key-input');
      if (inp && key) inp.value = key;
  ```

  Add the FIFO checkbox init after the spoon key init:
  ```js
    function init() {
      const key = localStorage.getItem('rb_spoon_key') || '';
      const inp = document.getElementById('spoon-key-input');
      if (inp && key) inp.value = key;
      const fifoCb = document.getElementById('settings-fifo-toggle');
      if (fifoCb) fifoCb.checked = Data.getFIFO();
  ```

  Also add a `setFIFO` function inside the `Settings` IIFE, before the return:

  Find in `js/app.js`:
  ```js
    return { init, saveSpoonKey, updateDriveStatus };
  ```

  Change to:
  ```js
    function setFIFO(enabled) {
      Data.setFIFO(enabled);
      App.toast(enabled ? 'FIFO deduction on ✓' : 'FIFO deduction off');
    }

    return { init, saveSpoonKey, updateDriveStatus, setFIFO };
  ```

#### css/style.css changes

- [ ] **Step 4: Add batch list and FIFO badge styles**

  Append to `css/style.css`:
  ```css

  /* ── Pantry: batch list (Sub-project F) ── */
  .pantry-batch-list {
    margin-top: 4px;
    display: flex;
    flex-wrap: wrap;
    gap: 3px 8px;
    align-items: center;
  }
  .pantry-batch-row {
    font-size: 0.76rem;
    color: var(--text-muted);
  }
  .pantry-fifo-badge {
    font-size: 0.65rem;
    font-weight: 700;
    background: var(--lt-green);
    color: var(--dk-green);
    padding: 1px 5px;
    border-radius: 4px;
    letter-spacing: .04em;
  }
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add js/recipes.js index.html js/app.js css/style.css
  git commit -m "feat(pantry): FIFO cooking deduction, Settings toggle, batch styles"
  ```
