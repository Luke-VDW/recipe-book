# Shopping List Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full redesign of the shopping list — checkbox means purchased, per-item "use pantry" button, inline actual price logging, estimated + actual totals, ad-hoc item addition with autocomplete, a Confirm Shop modal that updates the price book/pantry/spend log in one action, and post-shop spend entry correction in Analytics.

**Architecture:** Seven tasks — data layer first (new functions, logSpend retailer), then the shopping.js overhaul split across four tasks (item row, total bar, ad-hoc add, confirm modal), then analytics editing, then HTML/CSS wiring. All state persists to `_db.shoppingList` items directly; no separate session object needed.

**Tech Stack:** Vanilla JS IIFE modules, localStorage (`Data._db`), `innerHTML` rendering, CSS variables. No bundler, no test suite — manual browser verification via `python -m http.server 8000`.

---

### Task 1: Data layer — new functions + logSpend retailer

**Files:**
- Modify: `js/data.js`

**Context:** `data.js` is the single IIFE module for all persistence. Functions are added near their related cousins. The return statement is at the very end of the file (~line 590–603). `logSpend` currently stores `{ date, total, items }` — it needs to also store `retailer`.

- [ ] **Step 1: Add `addShoppingItem` after `setShoppingList` (line ~157)**

  Find:
  ```js
  function setShoppingList(items) {
    _db.shoppingList = items;
    save();
  }
  ```

  Change to:
  ```js
  function setShoppingList(items) {
    _db.shoppingList = items;
    save();
  }

  function addShoppingItem(item) {
    if (!_db.shoppingList) _db.shoppingList = [];
    _db.shoppingList.push(item);
    save();
  }
  ```

- [ ] **Step 2: Add `updateShoppingItem` after `toggleShoppingItem` (line ~296)**

  Find:
  ```js
  function toggleShoppingItem(idx) {
    if (_db.shoppingList[idx]) {
      _db.shoppingList[idx].checked = !_db.shoppingList[idx].checked;
      save();
    }
  }
  ```

  Change to:
  ```js
  function toggleShoppingItem(idx) {
    if (_db.shoppingList[idx]) {
      _db.shoppingList[idx].checked = !_db.shoppingList[idx].checked;
      save();
    }
  }

  function updateShoppingItem(idx, fields) {
    if (!_db.shoppingList[idx]) return;
    Object.assign(_db.shoppingList[idx], fields);
    save();
  }
  ```

- [ ] **Step 3: Update `logSpend` to store `retailer` and add `updateSpendEntry`**

  Find:
  ```js
  function logSpend(entry) {
    if (!_db.spendLog) _db.spendLog = [];
    _db.spendLog.push({ date: entry.date, total: entry.total, items: entry.items });
    save();
  }
  ```

  Change to:
  ```js
  function logSpend(entry) {
    if (!_db.spendLog) _db.spendLog = [];
    _db.spendLog.push({ date: entry.date, total: entry.total, retailer: entry.retailer || '', items: entry.items });
    save();
  }

  function updateSpendEntry(idx, entry) {
    if (!_db.spendLog || !_db.spendLog[idx]) return;
    _db.spendLog[idx] = entry;
    save();
  }
  ```

- [ ] **Step 4: Export new functions in the return statement**

  Find:
  ```js
    getSpendLog, logSpend, clearSpendLog,
  ```

  Change to:
  ```js
    getSpendLog, logSpend, clearSpendLog, updateSpendEntry,
  ```

  Find:
  ```js
    setMealSlot, setShoppingList, setTreats, setRecipeCalories, toggleShoppingItem,
  ```

  Change to:
  ```js
    setMealSlot, setShoppingList, addShoppingItem, setTreats, setRecipeCalories, toggleShoppingItem, updateShoppingItem,
  ```

- [ ] **Step 5: Verify in browser**

  Start server: `python -m http.server 8000`
  Open: `http://localhost:8000`
  Open browser console and run:
  ```js
  Data.addShoppingItem({ name: 'test', qty: 1, unit: 'item', checked: false });
  console.log(Data.getShoppingList().slice(-1));  // should log [{name:'test',...}]
  Data.updateShoppingItem(Data.getShoppingList().length - 1, { checked: true });
  console.log(Data.getShoppingList().slice(-1)[0].checked);  // should log true
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add js/data.js
  git commit -m "feat(data): add addShoppingItem, updateShoppingItem, updateSpendEntry; store retailer in logSpend"
  ```

---

### Task 2: Shopping list item row redesign

**Files:**
- Modify: `js/shopping.js`

**Context:** This task removes the old auto-check/pantry-badge system and old modal functions, and replaces the item rendering with the new three-state model (idle / purchased / pantry-used). It does NOT yet touch `_renderTotal` (Task 3), `openAddAdHocItem` (Task 4), or `openConfirmShop` (Task 5) — those are separate tasks. After this task, the shopping list renders correctly with the new states; the total bar still shows the old single estimated total until Task 3.

The module-level variables to **remove**: `_logItems`, `_pendingSpend`, `_userUnchecked`.

The functions to **remove**: `openLogPurchase`, `confirmPurchase`, `openCompleteShop`, `confirmCompleteShop`.

The functions to **add**: `_hasPantryStock`, `_renderItem`, `markPantryUsed`, `setActualPrice`.

- [ ] **Step 1: Replace module-level variables at the top of the IIFE**

  Find:
  ```js
    let _userUnchecked = new Set(); // ingredient names (lowercase) the user explicitly unticked
    let _logItems = []; // items captured when Log Purchase modal was opened
    let _pendingSpend = null;
  ```

  Change to:
  ```js
    // (no session state — per-item state lives on _db.shoppingList items directly)
  ```

- [ ] **Step 2: Add `_hasPantryStock` helper after `_fmtPantryQty`**

  Find:
  ```js
  function _fmtPantryQty(q) { return fmtQty(q) || '0'; }
  ```

  Change to:
  ```js
  function _fmtPantryQty(q) { return fmtQty(q) || '0'; }

  function _hasPantryStock(item) {
    const p = Data.getPantryItem(item.name);
    return !!(p && p.qty > 0);
  }
  ```

- [ ] **Step 3: Add `_renderItem` function after `_hasPantryStock`**

  Add after `_hasPantryStock`:
  ```js
  function _renderItem(item) {
    const qty = fmtQty(item.qty);
    const label = qty ? `${qty}${item.unit ? ' ' + item.unit : ''} ${item.name}` : item.name;

    const hasSources = item.sources && item.sources.length > 0 &&
      (item.sources.length > 1 || (item.sources[0] && item.sources[0].context));
    let sourcesHtml = '';
    if (hasSources) {
      const sourceRows = item.sources.map(s => {
        const ctxParts = [];
        if (s.qty) ctxParts.push(fmtQty(s.qty) + (s.unit ? ' ' + s.unit : ''));
        if (s.context) ctxParts.push(s.context);
        return `<div class="shop-source-row">
          <span class="shop-source-recipe">${s.recipe}</span>
          ${ctxParts.length ? `<span class="shop-source-ctx">${ctxParts.join(' · ')}</span>` : ''}
        </div>`;
      }).join('');
      sourcesHtml = `<div id="shop-sources-${item._idx}" class="shop-item-sources hidden">${sourceRows}</div>`;
    }

    const srcBtn = hasSources
      ? `<button id="shop-src-btn-${item._idx}" class="shop-src-toggle" onclick="Shopping.toggleSources(${item._idx})">View recipes ▾</button>`
      : '';

    if (item.pantryUsed) {
      const p = Data.getPantryItem(item.name);
      const pantryQtyHtml = p && p.qty > 0
        ? `<span class="shop-pantry-qty">· In pantry (${_fmtPantryQty(p.qty)} ${_esc(p.unit)})</span>`
        : '';
      return `
        <div class="shop-item pantry-used" id="shop-item-${item._idx}">
          <input type="checkbox" disabled />
          <div class="shop-item-main">
            <div class="shop-item-top">
              <span class="shop-item-name">${_esc(label)} 🏠</span>
              ${srcBtn}
            </div>
            <div class="shop-pantry-used-row">
              <button class="shop-undo-pantry" onclick="Shopping.markPantryUsed(${item._idx})">✕ undo pantry</button>
              ${pantryQtyHtml}
            </div>
            ${sourcesHtml}
          </div>
        </div>`;
    }

    const usePantryBtn = (!item.checked && _hasPantryStock(item))
      ? `<div class="shop-pantry-row"><button class="shop-use-pantry-btn" onclick="Shopping.markPantryUsed(${item._idx})">Use pantry ●</button></div>`
      : '';

    const actualInput = `<input type="number" class="shop-actual-input" id="shop-actual-${item._idx}"
      step="0.01" min="0"
      value="${item.actualPrice != null ? item.actualPrice : ''}"
      placeholder="actual R"
      onchange="Shopping.setActualPrice(${item._idx}, this.value)" />`;

    return `
      <div class="shop-item ${item.checked ? 'checked' : ''}" id="shop-item-${item._idx}">
        <input type="checkbox" ${item.checked ? 'checked' : ''}
          onchange="Shopping.toggle(${item._idx})" />
        <div class="shop-item-main">
          <div class="shop-item-top">
            <span class="shop-item-name">${_esc(label)}</span>
            ${srcBtn}
          </div>
          ${usePantryBtn}
          <div class="shop-price-row">
            ${_renderPriceDisplay(item._idx, item)}
            <div class="shop-actual-wrap">${actualInput}</div>
          </div>
          ${sourcesHtml}
        </div>
      </div>`;
  }
  ```

- [ ] **Step 4: Update `render()` — remove auto-check logic, call `_renderItem`**

  Replace the entire `render()` function:
  ```js
  function render() {
    const items = Data.getShoppingList();
    const el = document.getElementById('shopping-list');
    if (!el) return;

    if (items.length === 0) {
      el.innerHTML = `<div class="empty-state"><span class="emoji">🛒</span>Your shopping list is empty.<br>Generate one from the Meal Planner.</div>`;
      return;
    }

    const groups = {};
    items.forEach((item, idx) => {
      const cat = guessCategory(item.name);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push({ ...item, _idx: idx });
    });

    const catOrder = ['produce','meat','dairy','spices & herbs','pasta & grains','pantry','frozen','drinks','other'];
    const orderedCats = catOrder.filter(c => groups[c]);

    el.innerHTML = orderedCats.map(cat => {
      const rows = groups[cat].map(item => _renderItem(item)).join('');
      return `
        <div class="shop-category">
          <div class="shop-cat-label">${cat.toUpperCase()}</div>
          ${rows}
        </div>`;
    }).join('') + _renderTotal(items);
  }
  ```

- [ ] **Step 5: Update `toggle()` to clear `pantryUsed` on check (mutual exclusivity)**

  Replace the entire `toggle()` function:
  ```js
  function toggle(idx) {
    const items = Data.getShoppingList();
    const item = items[idx];
    if (!item) return;
    if (!item.checked && item.pantryUsed) {
      Data.updateShoppingItem(idx, { pantryUsed: false });
    }
    Data.toggleShoppingItem(idx);
    const updated = Data.getShoppingList();
    const el = document.getElementById('shop-item-' + idx);
    if (el) el.classList.toggle('checked', !!updated[idx]?.checked);
  }
  ```

- [ ] **Step 6: Add `markPantryUsed` and `setActualPrice` after `toggle()`**

  Find:
  ```js
  function clearChecked() {
  ```

  Insert before `clearChecked`:
  ```js
  function markPantryUsed(idx) {
    const items = Data.getShoppingList();
    const item = items[idx];
    if (!item) return;
    const newState = !item.pantryUsed;
    Data.updateShoppingItem(idx, {
      pantryUsed: newState,
      checked: newState ? false : item.checked,
    });
    render();
  }

  function setActualPrice(idx, value) {
    const price = parseFloat(value);
    Data.updateShoppingItem(idx, { actualPrice: (isNaN(price) || price < 0) ? null : price });
    render();
  }

  ```

- [ ] **Step 7: Remove `openLogPurchase`, `confirmPurchase`, `openCompleteShop`, `confirmCompleteShop`**

  Delete the four functions entirely (they run from line ~291 to ~374 in the current file). These are: `openLogPurchase()`, `confirmPurchase()`, `openCompleteShop()`, `confirmCompleteShop()`.

- [ ] **Step 8: Update the return statement**

  Find:
  ```js
  return { render, toggle, toggleSources, clearChecked, editPrice, savePrice, openLogPurchase, confirmPurchase, openCompleteShop, confirmCompleteShop };
  ```

  Change to (placeholder exports for Tasks 4 and 5 — those functions don't exist yet, add them after those tasks are done):
  ```js
  return { render, toggle, toggleSources, clearChecked, editPrice, savePrice, markPantryUsed, setActualPrice };
  ```

- [ ] **Step 9: Remove `_renderPantryBadge` (no longer used)**

  Delete the entire `_renderPantryBadge` function (it was replaced by `_hasPantryStock` + `_renderItem` inline logic).

- [ ] **Step 10: Verify in browser**

  Open `http://localhost:8000`, navigate to Shopping List.
  - Items render with checkbox (no auto-ticking from pantry)
  - If pantry has stock for an item, "Use pantry ●" button appears
  - Tapping "Use pantry ●" re-renders that item with 🏠 icon and "✕ undo pantry" link
  - Tapping "✕ undo pantry" reverts to idle state
  - Ticking checkbox marks item as purchased (strikethrough)
  - Ticking a pantry-used item converts it to purchased (pantryUsed cleared)
  - `actual R` input appears on idle and purchased rows; entering a value persists on re-render

- [ ] **Step 11: Commit**

  ```bash
  git add js/shopping.js
  git commit -m "feat(shopping): item row overhaul — checkbox=purchased, use-pantry state, actual price input"
  ```

---

### Task 3: Updated total bar

**Files:**
- Modify: `js/shopping.js`

**Context:** `_renderTotal` currently shows a single estimated total. It needs to show estimated (from price book) and actual (from `item.actualPrice`) on separate rows. Pantry-used items are excluded from both. The actual row is hidden if no `actualPrice` values are set.

- [ ] **Step 1: Replace `_renderTotal`**

  Find and replace the entire `_renderTotal` function:
  ```js
  function _renderTotal(items) {
    const buyItems = items.filter(i => !i.pantryUsed);
    if (buyItems.length === 0) return '';

    let estimated = 0;
    let unpriced = 0;
    buyItems.forEach(item => {
      const cost = Data.lookupPrice(item.name, item.qty, item.unit);
      if (cost != null) estimated += cost;
      else if (item.actualPrice == null) unpriced++;
    });

    let actual = 0;
    let hasActual = false;
    buyItems.forEach(item => {
      if (item.actualPrice != null && item.actualPrice > 0) {
        actual += item.actualPrice;
        hasActual = true;
      }
    });

    if (estimated === 0 && !hasActual && unpriced === buyItems.length) return '';

    const unpricedNote = unpriced > 0
      ? `<div class="shop-total-note">${unpriced} item${unpriced > 1 ? 's' : ''} unpriced</div>`
      : '';

    const actualRow = hasActual
      ? `<div class="shop-total-row"><span class="shop-total-label">Actual</span><span class="shop-total-amount">R ${actual.toFixed(2)}</span></div>`
      : '';

    return `<div class="shop-total">
      <div class="shop-total-row">
        <span class="shop-total-label">Estimated</span>
        <span class="shop-total-amount">R ${estimated.toFixed(2)}</span>
      </div>
      ${actualRow}
      ${unpricedNote}
    </div>`;
  }
  ```

- [ ] **Step 2: Verify in browser**

  - Enter an actual price on one item → "Actual" row appears in total bar alongside "Estimated"
  - Clear the actual price → "Actual" row disappears
  - Mark all items as pantry-used → total bar disappears

- [ ] **Step 3: Commit**

  ```bash
  git add js/shopping.js
  git commit -m "feat(shopping): show estimated + actual totals in total bar"
  ```

---

### Task 4: Ad-hoc item addition

**Files:**
- Modify: `js/shopping.js`

**Context:** A "＋ Add item" button (added to HTML in Task 7) calls `Shopping.openAddAdHocItem()`. The modal shows a name input with live autocomplete from the price book ingredient list, plus qty and unit fields. `_adhocAutocomplete` and `_adhocSelect` must be exported because they're called from `oninput`/`onclick` attributes in the modal HTML.

- [ ] **Step 1: Add the three ad-hoc functions before `clearChecked`**

  Find:
  ```js
  function clearChecked() {
  ```

  Insert before `clearChecked`:
  ```js
  function openAddAdHocItem() {
    const unitOpts = ['g','100g','kg','ml','100ml','l','item','tsp','tbsp','clove','bunch','head','can','packet','loaf','dozen']
      .map(u => `<option value="${u}"${u === 'item' ? ' selected' : ''}>${u}</option>`).join('');
    document.getElementById('modal-content').innerHTML = `
      <h3>Add item</h3>
      <div class="form-group">
        <label>Name</label>
        <div style="position:relative">
          <input type="text" id="adhoc-name" autocomplete="off" placeholder="e.g. milk"
            oninput="Shopping._adhocAutocomplete(this.value)"
            style="width:100%;box-sizing:border-box" />
          <div id="adhoc-suggestions" class="adhoc-suggestions hidden"></div>
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <div class="form-group" style="flex:1">
          <label>Qty</label>
          <input type="number" id="adhoc-qty" step="0.1" min="0" placeholder="1" />
        </div>
        <div class="form-group" style="flex:1">
          <label>Unit</label>
          <select id="adhoc-unit">${unitOpts}</select>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn-primary" onclick="Shopping.saveAdHocItem()">Add to list</button>
      </div>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('adhoc-name')?.focus();
  }

  function _adhocAutocomplete(query) {
    const suggestionsEl = document.getElementById('adhoc-suggestions');
    if (!suggestionsEl) return;
    const q = (query || '').toLowerCase().trim();
    if (q.length < 2) { suggestionsEl.classList.add('hidden'); return; }
    const matches = Data.getPriceBook()
      .map(e => e.ingredient)
      .filter(name => name.includes(q))
      .slice(0, 6);
    if (matches.length === 0) { suggestionsEl.classList.add('hidden'); return; }
    suggestionsEl.classList.remove('hidden');
    suggestionsEl.innerHTML = matches
      .map(name => `<div class="adhoc-suggestion" onclick="Shopping._adhocSelect('${_esc(name)}')">${_esc(name)}</div>`)
      .join('');
  }

  function _adhocSelect(name) {
    const input = document.getElementById('adhoc-name');
    if (input) input.value = name;
    const suggestionsEl = document.getElementById('adhoc-suggestions');
    if (suggestionsEl) suggestionsEl.classList.add('hidden');
  }

  function saveAdHocItem() {
    const name = (document.getElementById('adhoc-name')?.value || '').trim().toLowerCase();
    const qty = parseFloat(document.getElementById('adhoc-qty')?.value) || null;
    const unit = document.getElementById('adhoc-unit')?.value || 'item';
    if (!name) { App.toast('Enter an item name', 'warn'); return; }
    Data.addShoppingItem({ name, qty, unit, adhoc: true, checked: false });
    Data.ensurePriceBookEntries([{ name }]);
    App.closeModal();
    render();
    App.toast('Item added ✓');
  }

  ```

- [ ] **Step 2: Update the return statement to export the new functions**

  Find:
  ```js
  return { render, toggle, toggleSources, clearChecked, editPrice, savePrice, markPantryUsed, setActualPrice };
  ```

  Change to:
  ```js
  return { render, toggle, toggleSources, clearChecked, editPrice, savePrice, markPantryUsed, setActualPrice, openAddAdHocItem, _adhocAutocomplete, _adhocSelect, saveAdHocItem };
  ```

- [ ] **Step 3: Verify in browser**

  The "＋ Add item" button won't be in the HTML until Task 7. Test via console:
  ```js
  Shopping.openAddAdHocItem();
  // Modal opens — type "chick" in the name field — autocomplete shows matching ingredients
  // Select one → name fills in
  // Enter qty 500, unit g, tap Add to list → item appears in shopping list
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add js/shopping.js
  git commit -m "feat(shopping): add ad-hoc item via modal with price book autocomplete"
  ```

---

### Task 5: Confirm Shop modal

**Files:**
- Modify: `js/shopping.js`

**Context:** Replaces `openCompleteShop`/`openLogPurchase` (already deleted). Opens a modal showing bought and pantry-used items, a retailer field, an optional "include estimated" checkbox, a calculated total, and an override field. On confirm: updates price book (for items with `actualPrice`), updates pantry (for bought items), logs spend with `estimated` flags, removes confirmed items.

- [ ] **Step 1: Add the confirm shop functions before `clearChecked`**

  Find:
  ```js
  function clearChecked() {
  ```

  Insert before `clearChecked`:
  ```js
  function _updateConfirmTotal(bought) {
    const includeEst = document.getElementById('confirm-include-est')?.checked;
    let total = 0;
    bought.forEach(item => {
      if (item.actualPrice != null) {
        total += item.actualPrice;
      } else if (includeEst) {
        const est = Data.lookupPrice(item.name, item.qty, item.unit);
        if (est != null) total += est;
      }
    });
    const display = document.getElementById('confirm-total-display');
    if (display) display.textContent = `R ${total.toFixed(2)}`;
  }

  function openConfirmShop() {
    const items = Data.getShoppingList();
    const bought = items.filter(i => i.checked);
    const pantryItems = items.filter(i => i.pantryUsed);

    if (bought.length === 0 && pantryItems.length === 0) {
      App.toast('Nothing confirmed yet — tick items as bought or mark as pantry use', 'warn');
      return;
    }

    const boughtRows = bought.map(item => {
      const hasActual = item.actualPrice != null && item.actualPrice > 0;
      const est = Data.lookupPrice(item.name, item.qty, item.unit);
      let costHtml;
      if (hasActual) {
        costHtml = `<span class="confirm-item-cost">R ${item.actualPrice.toFixed(2)}</span>`;
      } else if (est != null) {
        costHtml = `<span class="confirm-item-cost"><span class="shop-est-badge">~est</span> R ${est.toFixed(2)}</span>`;
      } else {
        costHtml = `<span class="confirm-item-cost"><span class="shop-est-badge">~est</span> —</span>`;
      }
      return `<div class="confirm-item-row">
        <span class="confirm-item-name">${_esc(item.name)}</span>
        <span class="confirm-item-qty">${fmtQty(item.qty) || ''} ${_esc(item.unit || '')}</span>
        ${costHtml}
      </div>`;
    }).join('');

    const pantryRows = pantryItems.map(item =>
      `<div class="confirm-item-row">
        <span class="confirm-item-name">${_esc(item.name)}</span>
        <span class="confirm-item-qty">${fmtQty(item.qty) || ''} ${_esc(item.unit || '')}</span>
        <span class="confirm-item-cost" style="color:var(--text-muted);font-style:italic">not purchasing</span>
      </div>`
    ).join('');

    const baseTotal = bought.reduce((s, i) => s + (i.actualPrice != null ? i.actualPrice : 0), 0);
    const hasUnpriced = bought.some(i => i.actualPrice == null);

    const estCheckboxHtml = hasUnpriced ? `
      <label class="confirm-est-toggle">
        <input type="checkbox" id="confirm-include-est" />
        Include estimated prices for unpriced items
      </label>` : '';

    document.getElementById('modal-content').innerHTML = `
      <h3>Confirm Shop</h3>
      <div class="form-group">
        <label>Store</label>
        <input type="text" id="confirm-retailer" placeholder="e.g. Woolworths" maxlength="30" />
      </div>
      ${bought.length > 0 ? `<div class="confirm-section-title">Purchased (${bought.length})</div>${boughtRows}` : ''}
      ${pantryItems.length > 0 ? `<div class="confirm-section-title">From pantry (${pantryItems.length})</div>${pantryRows}` : ''}
      ${estCheckboxHtml}
      <div class="confirm-total-row">
        Total: <strong id="confirm-total-display">R ${baseTotal.toFixed(2)}</strong>
      </div>
      <div class="form-group" style="margin-top:8px">
        <label>Override total (optional)</label>
        <input type="number" id="confirm-total-override" step="0.01" min="0"
          placeholder="Leave blank to use calculated total" />
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn-primary" onclick="Shopping.confirmShop()">Confirm &amp; save</button>
      </div>`;
    document.getElementById('modal-overlay').classList.remove('hidden');

    const estCb = document.getElementById('confirm-include-est');
    if (estCb) estCb.addEventListener('change', () => _updateConfirmTotal(bought));
  }

  function confirmShop() {
    const items = Data.getShoppingList();
    const bought = items.filter(i => i.checked);
    const pantryItems = items.filter(i => i.pantryUsed);
    const retailer = (document.getElementById('confirm-retailer')?.value || '').trim();
    const includeEst = document.getElementById('confirm-include-est')?.checked || false;
    const overrideRaw = parseFloat(document.getElementById('confirm-total-override')?.value);

    let calculatedTotal = 0;
    bought.forEach(item => {
      if (item.actualPrice != null) {
        calculatedTotal += item.actualPrice;
      } else if (includeEst) {
        const est = Data.lookupPrice(item.name, item.qty, item.unit);
        if (est != null) calculatedTotal += est;
      }
    });
    const finalTotal = (!isNaN(overrideRaw) && overrideRaw >= 0) ? overrideRaw : calculatedTotal;

    // 1. Update price book for bought items with actualPrice
    bought.forEach(item => {
      if (item.actualPrice != null && item.qty) {
        Data.setPriceEntry(item.name.toLowerCase().trim(), {
          unit: item.unit || 'item',
          pricePerUnit: item.actualPrice / item.qty,
          retailer,
        });
      }
    });

    // 2. Update pantry for bought items
    bought.forEach(item => {
      if (item.qty) Data.setPantryItem(item.name, { qty: item.qty, unit: item.unit || 'item' });
    });

    // 3. Log spend
    const spendItems = bought.map(item => {
      const hasActual = item.actualPrice != null;
      const cost = hasActual
        ? item.actualPrice
        : (Data.lookupPrice(item.name, item.qty, item.unit) || 0);
      return { name: item.name, qty: item.qty, unit: item.unit, cost, estimated: !hasActual };
    });
    Data.logSpend({ date: new Date().toISOString().slice(0, 10), total: finalTotal, retailer, items: spendItems });

    // 4. Remove confirmed items; keep unchecked, non-pantry-used items
    Data.setShoppingList(items.filter(i => !i.checked && !i.pantryUsed));

    App.closeModal();
    App.toast('Shop confirmed ✓');
    render();
  }

  ```

- [ ] **Step 2: Update the return statement**

  Find:
  ```js
  return { render, toggle, toggleSources, clearChecked, editPrice, savePrice, markPantryUsed, setActualPrice, openAddAdHocItem, _adhocAutocomplete, _adhocSelect, saveAdHocItem };
  ```

  Change to:
  ```js
  return { render, toggle, toggleSources, clearChecked, editPrice, savePrice, markPantryUsed, setActualPrice, openAddAdHocItem, _adhocAutocomplete, _adhocSelect, saveAdHocItem, openConfirmShop, confirmShop };
  ```

- [ ] **Step 3: Verify in browser**

  Test via console (or via the HTML button after Task 7):
  ```js
  // First tick some items, then:
  Shopping.openConfirmShop();
  // Modal shows bought items with prices/estimates
  // Enter a store name, check "include estimated", note total updates
  // Enter an override total
  // Tap Confirm & save → shop logged, items removed from list, pantry updated
  // Navigate to Analytics → new entry appears with correct total and retailer
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add js/shopping.js
  git commit -m "feat(shopping): Confirm Shop modal — logs spend, updates price book and pantry"
  ```

---

### Task 6: Analytics spend entry editing

**Files:**
- Modify: `js/analytics.js`

**Context:** The `Analytics` IIFE renders the spend log. This task adds: (1) an `_esc` helper (not currently in analytics.js), (2) retailer display on shop rows, (3) `estimated` badge on item detail rows, (4) an Edit button per shop entry, (5) `editSpendEntry(realIdx)` modal, (6) `saveSpendEntry(realIdx)` that corrects item costs and updates the price book, (7) updated empty-state message ("Confirm Shop" instead of "Complete Shop").

The real index into `_db.spendLog` must be computed from the reversed display order: `realIdx = log.length - 1 - displayIdx`.

- [ ] **Step 1: Add `_esc` helper inside the Analytics IIFE, after `_fmtR`**

  Find:
  ```js
  function _bar(label, value, maxValue, amount) {
  ```

  Insert before `_bar`:
  ```js
  function _esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  ```

- [ ] **Step 2: Update the empty-state message in `render()`**

  Find:
  ```js
      el.innerHTML = `<div class="empty-state"><span class="emoji">📊</span>No spend data yet.<br>Use "Complete Shop" on the shopping list to log your first shop.</div>`;
  ```

  Change to:
  ```js
      el.innerHTML = `<div class="empty-state"><span class="emoji">📊</span>No spend data yet.<br>Use "Confirm Shop" on the shopping list to log your first shop.</div>`;
  ```

- [ ] **Step 3: Update the Recent Shops section in `render()` to show retailer, estimated badges, and Edit button**

  Find:
  ```js
    const recentShops = log.slice().reverse().slice(0, 5);
    const shopsHtml = recentShops.map((entry) => {
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
  ```

  Change to:
  ```js
    const recentShops = log.map((entry, i) => ({ ...entry, _realIdx: i })).reverse().slice(0, 5);
    const shopsHtml = recentShops.map((entry) => {
      const retailerTag = entry.retailer
        ? `<span class="analytics-shop-retailer">${_esc(entry.retailer)}</span>` : '';
      const detailRows = (entry.items || []).map(item => {
        const estBadge = item.estimated ? `<span class="shop-est-badge">~est</span>` : '';
        return `<div>${_esc(item.name)} × ${item.qty || ''} ${_esc(item.unit || '')} — ${_fmtR(item.cost)} ${estBadge}</div>`;
      }).join('');
      return `
        <div class="analytics-shop-row">
          <div class="analytics-shop-header">
            <span class="analytics-shop-date" style="cursor:pointer" onclick="this.closest('.analytics-shop-row').querySelector('.analytics-shop-detail').classList.toggle('open')">${_fmtDate(entry.date)}${retailerTag}</span>
            <span class="analytics-shop-total">${_fmtR(entry.total)}</span>
            <button class="btn-mini" onclick="event.stopPropagation();Analytics.editSpendEntry(${entry._realIdx})">Edit</button>
          </div>
          <div class="analytics-shop-detail">${detailRows}</div>
        </div>`;
    }).join('');
  ```

- [ ] **Step 4: Add `editSpendEntry` and `saveSpendEntry` after `clearLog`**

  Find:
  ```js
  return { render, clearLog };
  ```

  Insert before the return:
  ```js
  function editSpendEntry(realIdx) {
    const log = Data.getSpendLog();
    const entry = log[realIdx];
    if (!entry) return;

    const itemRows = (entry.items || []).map((item, i) => {
      const estBadge = item.estimated ? `<span class="shop-est-badge">~est</span>` : '';
      return `<div class="confirm-item-row" style="align-items:center">
        <span class="confirm-item-name">${_esc(item.name)} ${estBadge}</span>
        <span style="font-size:0.8rem;color:var(--text-muted)">${item.qty || ''} ${_esc(item.unit || '')}</span>
        <label style="display:flex;align-items:center;gap:4px;font-size:0.85rem">R
          <input type="number" id="edit-item-cost-${i}" step="0.01" min="0"
            value="${item.cost != null ? item.cost.toFixed(2) : ''}"
            style="width:70px;padding:3px 6px;border:1px solid var(--border);border-radius:6px;font-size:0.85rem" />
        </label>
      </div>`;
    }).join('');

    document.getElementById('modal-content').innerHTML = `
      <h3>Edit Shop — ${_fmtDate(entry.date)}</h3>
      <div class="form-group">
        <label>Store</label>
        <input type="text" id="edit-retailer" value="${_esc(entry.retailer || '')}" maxlength="30" />
      </div>
      ${itemRows}
      <div class="form-group" style="margin-top:8px">
        <label>Override total (optional — leave blank to use sum of items)</label>
        <input type="number" id="edit-total-override" step="0.01" min="0"
          value="${entry.total != null ? entry.total.toFixed(2) : ''}" />
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn-primary" onclick="Analytics.saveSpendEntry(${realIdx})">Save</button>
      </div>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
  }

  function saveSpendEntry(realIdx) {
    const log = Data.getSpendLog();
    const entry = log[realIdx];
    if (!entry) return;

    const retailer = (document.getElementById('edit-retailer')?.value || '').trim();
    const overrideRaw = parseFloat(document.getElementById('edit-total-override')?.value);

    const updatedItems = (entry.items || []).map((item, i) => {
      const newCost = parseFloat(document.getElementById(`edit-item-cost-${i}`)?.value);
      if (!isNaN(newCost) && newCost >= 0 && newCost !== item.cost) {
        if (item.estimated && item.qty) {
          Data.setPriceEntry(item.name.toLowerCase().trim(), {
            unit: item.unit || 'item',
            pricePerUnit: newCost / item.qty,
            retailer,
          });
        }
        return { ...item, cost: newCost, estimated: false };
      }
      return item;
    });

    const sumTotal = updatedItems.reduce((s, i) => s + (i.cost || 0), 0);
    const finalTotal = (!isNaN(overrideRaw) && overrideRaw >= 0) ? overrideRaw : sumTotal;

    Data.updateSpendEntry(realIdx, { ...entry, total: finalTotal, retailer, items: updatedItems });

    App.closeModal();
    render();
    App.toast('Shop updated ✓');
  }

  ```

- [ ] **Step 5: Update the return statement**

  Find:
  ```js
  return { render, clearLog };
  ```

  Change to:
  ```js
  return { render, clearLog, editSpendEntry, saveSpendEntry };
  ```

- [ ] **Step 6: Verify in browser**

  Navigate to Analytics. If spend entries exist:
  - Each recent shop row shows retailer tag (if set) and an "Edit" button
  - Items with `estimated: true` show `~est` badge
  - Clicking "Edit" opens a modal with editable item costs and retailer field
  - Correcting an estimated item cost → saves correctly, `~est` badge disappears
  - Price book entry updated for corrected items (verify in Price Book view)

- [ ] **Step 7: Commit**

  ```bash
  git add js/analytics.js
  git commit -m "feat(analytics): edit spend entries post-shop — correct estimated prices, update price book"
  ```

---

### Task 7: HTML and CSS wiring

**Files:**
- Modify: `index.html`
- Modify: `css/style.css`

**Context:** Swap the shopping list header buttons; add all new CSS classes needed by Tasks 2–6. The `.shop-total` layout changes from a single flex row to a column of rows.

- [ ] **Step 1: Update shopping view header buttons in `index.html`**

  Find:
  ```html
          <button class="btn-small" onclick="Shopping.openLogPurchase()">Log Purchase</button>
          <button class="btn-small" onclick="Shopping.openCompleteShop()">Complete Shop</button>
          <button class="btn-small" onclick="Shopping.clearChecked()">Clear checked</button>
  ```

  Change to:
  ```html
          <button class="btn-small" onclick="Shopping.openAddAdHocItem()">＋ Add item</button>
          <button class="btn-small btn-small-primary" onclick="Shopping.openConfirmShop()">Confirm shop</button>
          <button class="btn-small" onclick="Shopping.clearChecked()">Clear checked</button>
  ```

- [ ] **Step 2: Append new CSS rules to `css/style.css`**

  Append at the very end of the file:
  ```css

  /* ── Shopping list overhaul (Sub-project B) ───────────── */

  /* Primary small button variant */
  .btn-small-primary { background: var(--md-green); color: #fff; }
  .btn-small-primary:hover { background: var(--dk-green); }

  /* Pantry-used item state */
  .shop-item.pantry-used { background: #f0faf4; border-left: 3px solid var(--md-green); }
  .shop-pantry-used-row { display: flex; align-items: center; gap: 8px; margin-top: 4px; flex-wrap: wrap; }
  .shop-undo-pantry { background: none; border: none; cursor: pointer; font-size: 0.78rem; color: var(--md-green); padding: 0; }
  .shop-undo-pantry:hover { text-decoration: underline; }
  .shop-pantry-qty { font-size: 0.78rem; color: var(--text-muted); }

  /* Use pantry button (idle state) */
  .shop-pantry-row { margin-top: 3px; }
  .shop-use-pantry-btn { background: none; border: 1px dashed var(--md-green); border-radius: 4px; padding: 1px 8px; font-size: 0.75rem; color: var(--md-green); cursor: pointer; }
  .shop-use-pantry-btn:hover { background: var(--lt-green); }

  /* Price row with actual input */
  .shop-price-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 2px; }
  .shop-actual-wrap { display: flex; align-items: center; }
  .shop-actual-input { width: 80px; padding: 3px 6px; font-size: 0.78rem; border: 1px solid var(--border); border-radius: 6px; }

  /* Estimated price badge */
  .shop-est-badge { font-size: 0.7rem; background: #fef3c7; color: #92400e; border-radius: 4px; padding: 1px 5px; margin-right: 2px; }

  /* Total bar — two-row layout */
  .shop-total { flex-direction: column; align-items: stretch; gap: 2px; }
  .shop-total-row { display: flex; justify-content: space-between; align-items: center; width: 100%; }

  /* Ad-hoc autocomplete dropdown */
  .adhoc-suggestions { position: absolute; top: 100%; left: 0; right: 0; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,.1); z-index: 100; max-height: 200px; overflow-y: auto; }
  .adhoc-suggestion { padding: 8px 12px; font-size: 0.88rem; cursor: pointer; }
  .adhoc-suggestion:hover { background: var(--lt-green); }

  /* Confirm shop modal item rows */
  .confirm-section-title { font-size: 0.78rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: .05em; margin: 12px 0 6px; }
  .confirm-item-row { display: flex; align-items: center; gap: 8px; padding: 5px 0; border-bottom: 1px solid var(--border); font-size: 0.88rem; }
  .confirm-item-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-transform: capitalize; }
  .confirm-item-qty { font-size: 0.8rem; color: var(--text-muted); white-space: nowrap; }
  .confirm-item-cost { white-space: nowrap; font-weight: 600; color: var(--dk-green); }
  .confirm-est-toggle { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; margin: 10px 0 4px; cursor: pointer; }
  .confirm-total-row { font-size: 0.95rem; margin: 10px 0 4px; }

  /* Analytics shop retailer tag */
  .analytics-shop-retailer { font-size: 0.78rem; color: var(--text-muted); margin-left: 6px; }

  /* Analytics Edit button — reuse btn-mini if it exists, otherwise: */
  .btn-mini { font-size: 0.72rem; padding: 2px 8px; border: 1px solid var(--border); border-radius: 5px; background: var(--surface); cursor: pointer; }
  .btn-mini:hover { border-color: var(--md-green); color: var(--md-green); }
  ```

- [ ] **Step 3: Verify full flow in browser**

  Full end-to-end test:
  1. Navigate to Shopping List
  2. "＋ Add item" button appears in header — tap it, modal opens with autocomplete
  3. Add "bread, 1, item" — item appears in list under correct category
  4. Tick two items as purchased — they strikethrough
  5. Tap "Use pantry ●" on an item with pantry stock — row goes green with 🏠
  6. Enter an actual price on a purchased item — actual row appears in total bar
  7. Tap "Confirm shop" — modal shows purchased + pantry sections, correct totals
  8. Enter store name, confirm — items removed, toast shown, Analytics has new entry
  9. Navigate to Analytics → new entry shows retailer, items with `~est` badges
  10. Tap "Edit" on the entry → modal opens → correct an estimated price → save → badge disappears, price book updated

- [ ] **Step 4: Commit**

  ```bash
  git add index.html css/style.css
  git commit -m "feat(html,css): shopping list overhaul — new header buttons, pantry-used styles, confirm modal styles"
  ```
