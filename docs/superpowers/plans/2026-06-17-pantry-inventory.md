# Pantry Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pantry inventory to the recipe book PWA — stock tracking, shopping list integration (auto-tick covered items, pantry badges), Log Purchase flow, and a dedicated Pantry view.

**Architecture:** Five tasks forming a dependency chain: data API → CSS → pantry module → HTML wiring → shopping integration. Each task is safe to implement and review independently since HTML/CSS changes have no runtime coupling until the final task wires shopping.js.

**Tech Stack:** Vanilla JS IIFE modules, localStorage persistence via `Data._db`, `innerHTML` rendering, CSS variables.

---

### Task 1: Pantry data API

**Files:**
- Modify: `js/data.js`

- [ ] **Step 1: Read the current exports at the bottom of `js/data.js`**

  The current return object (line ~532) ends with:
  ```js
  return {
    load, save, getRecipes, getPlan, getPantry, getShoppingList,
    ...
    getPriceBook, setPriceEntry, removePriceEntry, removeIngredient,
    lookupPriceEntry, lookupPrice,
    DAYS, MEALS,
  };
  ```
  Note that `getPantry` already exists at line 51 and is already exported. Do NOT re-add it.

- [ ] **Step 2: Add `setPantryItem` function after the existing `getPantry` function**

  Insert after `function getPantry()` (around line 51), before the shopping list functions:

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
    if (opts.perishable !== undefined) item.perishable = !!opts.perishable;
    item.updatedDate = new Date().toISOString().slice(0, 10);
    save();
  }

  function removePantryItem(ingredientName) {
    if (!_db.pantry) return;
    const name = (ingredientName || '').toLowerCase().trim();
    _db.pantry = _db.pantry.filter(p => p.ingredient.toLowerCase() !== name);
    save();
  }

  function clearPantryPerishables() {
    if (!_db.pantry) return;
    _db.pantry.forEach(p => { if (p.perishable) p.qty = 0; });
    save();
  }

  function getPantryItem(name) {
    const lower = (name || '').toLowerCase().trim();
    const pantry = _db.pantry || [];
    const exact = pantry.find(p => p.ingredient.toLowerCase() === lower);
    if (exact) return exact;
    return pantry.find(p => lower.includes(p.ingredient.toLowerCase())) || null;
  }
  ```

- [ ] **Step 3: Add new functions to the return object**

  Update the `return` statement to include the four new functions:
  ```js
  setPantryItem, removePantryItem, clearPantryPerishables, getPantryItem,
  ```
  Add them on the same line as the other pantry-related exports.

- [ ] **Step 4: Verify the file parses correctly**

  There is no test runner. Do a manual check: ensure no syntax errors by reading the modified section and checking brackets are balanced.

- [ ] **Step 5: Commit**

  ```bash
  git add js/data.js
  git commit -m "feat(data): add pantry API — setPantryItem, removePantryItem, clearPantryPerishables, getPantryItem"
  ```

---

### Task 2: Pantry CSS

**Files:**
- Modify: `css/style.css`

- [ ] **Step 1: Read the end of `css/style.css`**

  The file currently ends around line 786 with `.section-header-actions`. Confirm the last line before appending.

- [ ] **Step 2: Append pantry styles**

  Append to end of file:

  ```css

  /* ── Pantry view ────────────────────────────────────── */
  .pantry-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    margin-bottom: 10px;
    overflow: hidden;
  }
  .pantry-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    background: var(--lt-green);
  }
  .pantry-card-left {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    flex: 1;
  }
  .pantry-card-name {
    font-weight: 700;
    font-size: 0.9rem;
    text-transform: capitalize;
    color: var(--dk-green);
  }
  .pantry-card-qty {
    font-size: 0.85rem;
    color: var(--text-muted);
  }
  .pantry-card-actions {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }
  .pantry-perishable-badge {
    font-size: 0.72rem;
    background: #fef9c3;
    color: #854d0e;
    border-radius: 4px;
    padding: 1px 6px;
    font-weight: 600;
  }
  .pantry-in-stock {
    font-size: 0.75rem;
    color: var(--md-green);
    font-weight: 600;
    margin-top: 2px;
  }
  .pantry-partial-stock {
    font-size: 0.75rem;
    color: #d97706;
    font-weight: 600;
    margin-top: 2px;
  }
  .pantry-add-btn {
    width: 100%;
    margin-top: 8px;
    padding: 12px;
    background: none;
    border: 2px dashed var(--border);
    border-radius: var(--radius);
    font-size: 0.9rem;
    color: var(--text-muted);
    cursor: pointer;
    text-align: center;
    box-sizing: border-box;
  }
  .pantry-add-btn:hover {
    border-color: var(--md-green);
    color: var(--md-green);
  }
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add css/style.css
  git commit -m "feat(css): add pantry card and badge styles"
  ```

---

### Task 3: Create js/pantry.js

**Files:**
- Create: `js/pantry.js`

- [ ] **Step 1: Create the file with the full IIFE module**

  Create `js/pantry.js` with this content:

  ```js
  /* ══════════════════════════════════════
     pantry.js — Pantry inventory view
     ══════════════════════════════════════ */

  const Pantry = (() => {
    let _filter = '';
    let _editingName = null;

    const UNITS = ['g','100g','kg','ml','100ml','l','item','tsp','tbsp'];

    function render() {
      const allItems = Data.getPantry();
      const el = document.getElementById('pantry-list');
      if (!el) return;
      const filterLower = _filter.toLowerCase();
      const filtered = filterLower
        ? allItems.filter(p => p.ingredient.toLowerCase().includes(filterLower))
        : allItems;

      if (filtered.length === 0) {
        el.innerHTML = `<div class="empty-state"><span class="emoji">🥫</span>${
          filterLower ? 'No matches.' : 'Pantry is empty. Add items or log a purchase.'
        }</div>`;
        return;
      }

      el.innerHTML = filtered.map(item => {
        const realIdx = allItems.indexOf(item);
        const perishableHtml = item.perishable
          ? `<span class="pantry-perishable-badge">perishable</span>` : '';
        return `
          <div class="pantry-card">
            <div class="pantry-card-header">
              <div class="pantry-card-left">
                <span class="pantry-card-name">${_esc(item.ingredient)}</span>
                <span class="pantry-card-qty">${_fmtQty(item.qty)} ${_esc(item.unit)}</span>
                ${perishableHtml}
              </div>
              <div class="pantry-card-actions">
                <button class="btn-mini" onclick="Pantry.openEditForm(${realIdx})">Edit</button>
                <button class="btn-mini btn-danger-mini" onclick="Pantry.remove(${realIdx})">✕</button>
              </div>
            </div>
          </div>`;
      }).join('');
    }

    function filter() {
      _filter = (document.getElementById('pantry-search')?.value || '').trim();
      render();
    }

    function openAddForm() {
      _editingName = null;
      const unitOpts = UNITS.map(u =>
        `<option value="${u}" ${u === 'item' ? 'selected' : ''}>${u}</option>`
      ).join('');
      document.getElementById('modal-content').innerHTML = `
        <h3>Add to Pantry</h3>
        <div class="form-group">
          <label>Ingredient</label>
          <input id="pantry-form-ing" type="text" placeholder="e.g. onion" autofocus />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Qty</label>
            <input id="pantry-form-qty" type="number" step="0.1" min="0" placeholder="0" />
          </div>
          <div class="form-group">
            <label>Unit</label>
            <select id="pantry-form-unit">${unitOpts}</select>
          </div>
        </div>
        <div class="form-group">
          <label><input type="checkbox" id="pantry-form-perishable" /> Perishable (auto-reset weekly)</label>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" onclick="App.closeModal()">Cancel</button>
          <button class="btn-primary" onclick="Pantry.saveNew()">Add to Pantry</button>
        </div>`;
      document.getElementById('modal-overlay').classList.remove('hidden');
    }

    function saveNew() {
      const ingredient = (document.getElementById('pantry-form-ing')?.value || '').trim().toLowerCase();
      const qty = parseFloat(document.getElementById('pantry-form-qty')?.value) || 0;
      const unit = document.getElementById('pantry-form-unit')?.value || 'item';
      const perishable = document.getElementById('pantry-form-perishable')?.checked || false;
      if (!ingredient) { App.toast('Enter an ingredient name', 'warn'); return; }
      if (qty < 0) { App.toast('Qty cannot be negative', 'warn'); return; }
      Data.setPantryItem(ingredient, { qty, unit, perishable });
      App.closeModal();
      render();
      App.toast('Added to pantry ✓');
    }

    function openEditForm(idx) {
      const allItems = Data.getPantry();
      const item = allItems[idx];
      if (!item) return;
      _editingName = item.ingredient;
      const unitOpts = UNITS.map(u =>
        `<option value="${u}" ${item.unit === u ? 'selected' : ''}>${u}</option>`
      ).join('');
      document.getElementById('modal-content').innerHTML = `
        <h3>Edit — <span style="text-transform:capitalize">${_esc(item.ingredient)}</span></h3>
        <div class="form-row">
          <div class="form-group">
            <label>Qty</label>
            <input id="pantry-form-qty" type="number" step="0.1" min="0" value="${item.qty}" autofocus />
          </div>
          <div class="form-group">
            <label>Unit</label>
            <select id="pantry-form-unit">${unitOpts}</select>
          </div>
        </div>
        <div class="form-group">
          <label><input type="checkbox" id="pantry-form-perishable" ${item.perishable ? 'checked' : ''} /> Perishable</label>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" onclick="App.closeModal()">Cancel</button>
          <button class="btn-primary" onclick="Pantry.save()">Save</button>
        </div>`;
      document.getElementById('modal-overlay').classList.remove('hidden');
    }

    function save() {
      if (!_editingName) { App.toast('No item selected', 'warn'); return; }
      const qty = parseFloat(document.getElementById('pantry-form-qty')?.value) || 0;
      const unit = document.getElementById('pantry-form-unit')?.value || 'item';
      const perishable = document.getElementById('pantry-form-perishable')?.checked || false;
      if (qty < 0) { App.toast('Qty cannot be negative', 'warn'); return; }
      Data.setPantryItem(_editingName, { qty, unit, perishable });
      App.closeModal();
      render();
      App.toast('Pantry updated ✓');
    }

    function remove(idx) {
      const allItems = Data.getPantry();
      const item = allItems[idx];
      if (!item) return;
      if (!confirm('Remove this item from pantry?')) return;
      Data.removePantryItem(item.ingredient);
      render();
      App.toast('Removed');
    }

    function resetPerishables() {
      const pantry = Data.getPantry();
      const count = pantry.filter(p => p.perishable).length;
      if (count === 0) { App.toast('No perishable items in pantry', 'warn'); return; }
      if (!confirm(`Reset ${count} perishable item${count !== 1 ? 's' : ''} to 0?`)) return;
      Data.clearPantryPerishables();
      render();
      App.toast('Perishables reset ✓');
    }

    function _fmtQty(q) {
      if (q === undefined || q === null) return '0';
      const n = parseFloat(q);
      if (isNaN(n)) return '0';
      return n % 1 === 0 ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
    }

    function _esc(s) {
      return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    return { render, filter, openAddForm, saveNew, openEditForm, save, remove, resetPerishables };
  })();
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add js/pantry.js
  git commit -m "feat(pantry): new Pantry IIFE module — CRUD view, add/edit/remove, reset perishables"
  ```

---

### Task 4: HTML wiring — view, script tag, navigation

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add `#view-pantry` section**

  After the `<!-- PRICE BOOK -->` section (around line 137) and before the closing `</main>` tag (line 150), insert:

  ```html

    <!-- PANTRY -->
    <section id="view-pantry" class="view">
      <div class="section-header">
        <h2>Pantry</h2>
        <div class="section-header-actions">
          <button class="btn-small" onclick="Pantry.resetPerishables()">Reset perishables</button>
        </div>
      </div>
      <div class="search-bar">
        <input id="pantry-search" type="search" placeholder="Search pantry…" oninput="Pantry.filter()" />
      </div>
      <div id="pantry-list"></div>
      <button class="pantry-add-btn" onclick="Pantry.openAddForm()">＋ Add item</button>
    </section>
  ```

- [ ] **Step 2: Add script tag**

  Find the scripts block near the end of `<body>`. Add `<script src="js/pantry.js"></script>` BEFORE `<script src="js/app.js"></script>`:

  ```html
  <script src="js/prices.js"></script>
  <script src="js/pantry.js"></script>
  <script src="js/app.js"></script>
  ```

- [ ] **Step 3: Add Pantry settings group**

  In `#view-settings`, after the Price Book settings group (which ends around line 124), add:

  ```html
      <div class="settings-group">
        <h3>Pantry</h3>
        <p class="hint">Track what you have at home. Shopping list shows stock levels automatically.</p>
        <button class="btn-secondary" onclick="App.pushView('pantry','Pantry'); Pantry.render()">Manage Pantry →</button>
      </div>
  ```

- [ ] **Step 4: Add navigation buttons to shopping list header**

  The current shopping section header (around line 84-88) is:
  ```html
  <div class="section-header-actions">
    <button class="btn-small" onclick="App.pushView('pricebook','Price Book'); PriceBook.render()">Price Book</button>
    <button class="btn-small" onclick="Shopping.clearChecked()">Clear checked</button>
  </div>
  ```

  Update it to:
  ```html
  <div class="section-header-actions">
    <button class="btn-small" onclick="App.pushView('pricebook','Price Book'); PriceBook.render()">Price Book</button>
    <button class="btn-small" onclick="App.pushView('pantry','Pantry'); Pantry.render()">Pantry</button>
    <button class="btn-small" onclick="Shopping.openLogPurchase()">Log Purchase</button>
    <button class="btn-small" onclick="Shopping.clearChecked()">Clear checked</button>
  </div>
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add index.html
  git commit -m "feat(html): add pantry view, script tag, nav buttons in settings and shopping header"
  ```

---

### Task 5: Shopping list integration

**Files:**
- Modify: `js/shopping.js`

Context: `shopping.js` already has `render()`, `toggle()`, `clearChecked()`, `editPrice()`, `savePrice()`. We're adding pantry badge rendering and Log Purchase flow.

- [ ] **Step 1: Add `_renderPantryBadge` helper after `_renderPriceDisplay`**

  After the `_renderPriceDisplay` function, insert:

  ```js
  function _renderPantryBadge(item) {
    const pantryItem = Data.getPantryItem(item.name);
    if (!pantryItem || pantryItem.qty <= 0) return '';
    if (pantryItem.unit === item.unit) {
      if (pantryItem.qty >= (item.qty || 0)) {
        return `<div class="pantry-in-stock">✓ In pantry (${_fmtPantryQty(pantryItem.qty)} ${_esc(pantryItem.unit)})</div>`;
      }
      return `<div class="pantry-partial-stock">In pantry: ${_fmtPantryQty(pantryItem.qty)} ${_esc(pantryItem.unit)}</div>`;
    }
    return `<div class="pantry-partial-stock">In pantry: ${_fmtPantryQty(pantryItem.qty)} ${_esc(pantryItem.unit)}</div>`;
  }

  function _fmtPantryQty(q) {
    const n = parseFloat(q);
    if (isNaN(n)) return '0';
    return n % 1 === 0 ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
  }
  ```

- [ ] **Step 2: Add pantry auto-tick pre-pass to `render()`**

  At the TOP of the `render()` function, before `const items = Data.getShoppingList()` (wait — `items` IS defined at the top), add a pre-pass AFTER reading items but BEFORE building HTML. Find the existing `render()` and add the auto-tick logic:

  ```js
  function render() {
    // Auto-tick items fully covered by pantry (pre-pass, no re-render loop)
    const preItems = Data.getShoppingList();
    preItems.forEach((item, idx) => {
      if (item.checked) return;
      const pantryItem = Data.getPantryItem(item.name);
      if (!pantryItem || pantryItem.qty <= 0) return;
      if (pantryItem.unit === item.unit && pantryItem.qty >= (item.qty || 0)) {
        Data.toggleShoppingItem(idx);
      }
    });

    const items = Data.getShoppingList();  // re-read after potential toggling
    // ... rest of existing render() code unchanged ...
  ```

  Important: the existing `const items = Data.getShoppingList()` at the start of render must become a re-read AFTER the pre-pass. Replace the existing first line of render from `const items = Data.getShoppingList()` with the pre-pass block followed by `const items = Data.getShoppingList()`.

- [ ] **Step 3: Add `${pantryBadge}` to item HTML in `render()`**

  In the item row HTML construction inside `render()`, find the `.shop-item-main` div. The current structure is:
  ```js
  <div class="shop-item-main">
    <div class="shop-item-top">
      <span class="shop-item-name">${label}</span>
      ${hasSources ? `<button ...>View recipes ▾</button>` : ''}
    </div>
    ${_renderPriceDisplay(item._idx, item)}
    ${sourcesHtml}
  </div>
  ```

  Update to:
  ```js
  <div class="shop-item-main">
    <div class="shop-item-top">
      <span class="shop-item-name">${label}</span>
      ${hasSources ? `<button ...>View recipes ▾</button>` : ''}
    </div>
    ${_renderPantryBadge(item)}
    ${_renderPriceDisplay(item._idx, item)}
    ${sourcesHtml}
  </div>
  ```

- [ ] **Step 4: Add `openLogPurchase()` and `confirmPurchase()` functions**

  After `clearChecked()`, add:

  ```js
  function openLogPurchase() {
    const items = Data.getShoppingList().filter(i => !i.checked);
    if (items.length === 0) {
      App.toast('Nothing to log — all items are already ticked', 'warn');
      return;
    }
    const rows = items.map((item, i) => {
      const qty = item.qty || 1;
      return `
        <div class="log-purchase-row" style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);">
          <span style="flex:1;font-size:0.9rem;text-transform:capitalize">${_esc(item.name)}</span>
          <input type="number" id="log-qty-${i}" step="0.1" min="0"
            value="${qty}" style="width:60px;padding:4px;border:1px solid var(--border);border-radius:6px;" />
          <span style="font-size:0.85rem;color:var(--text-muted)">${_esc(item.unit || '')}</span>
        </div>`;
    }).join('');
    document.getElementById('modal-content').innerHTML = `
      <h3>Log Purchase</h3>
      <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:12px">Confirm quantities to add to pantry:</p>
      <div id="log-purchase-rows">${rows}</div>
      <div class="modal-actions" style="margin-top:16px">
        <button class="btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn-primary" onclick="Shopping.confirmPurchase()">Confirm &amp; Update Pantry</button>
      </div>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
  }

  function confirmPurchase() {
    const items = Data.getShoppingList().filter(i => !i.checked);
    items.forEach((item, i) => {
      const qty = parseFloat(document.getElementById('log-qty-' + i)?.value) || 0;
      if (qty > 0) {
        Data.setPantryItem(item.name, { qty, unit: item.unit || 'item' });
      }
    });
    App.closeModal();
    App.toast('Pantry updated ✓');
    render();
  }
  ```

- [ ] **Step 5: Update the return statement**

  The current return is:
  ```js
  return { render, toggle, toggleSources, clearChecked, editPrice, savePrice };
  ```

  Update to:
  ```js
  return { render, toggle, toggleSources, clearChecked, editPrice, savePrice, openLogPurchase, confirmPurchase };
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add js/shopping.js
  git commit -m "feat(shopping): pantry stock badges, auto-tick covered items, Log Purchase flow"
  ```
