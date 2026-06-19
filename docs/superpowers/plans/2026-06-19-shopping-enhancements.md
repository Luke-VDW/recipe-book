# Sub-project E: Shopping List Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three shopping list improvements: purchase-qty override in confirm-shop; pantry stock hint on all items with stock; recipe filter chips.

**Architecture:** All changes in `js/shopping.js` and `css/style.css`. No data model changes — `_confirmQtyOverrides` is module memory, `_recipeFilter` is module state.

**Tech Stack:** Vanilla JS IIFE, `innerHTML` rendering, CSS variables.

---

### Task 1: Recipe filter chips + pantry stock hint

**Files:**
- Modify: `js/shopping.js`
- Modify: `css/style.css`

**Context:** The `Shopping` IIFE in `js/shopping.js`. `render()` at line 266 builds the shopping list HTML. `_renderItem(item)` at line 110 renders individual items. The module currently has no filter state.

- [ ] **Step 1: Add `_recipeFilter` module var and `setRecipeFilter()` function**

  After the existing `function _esc(s)` function (around line 65), add:

  ```js
  let _recipeFilter = null;

  function setRecipeFilter(name) {
    _recipeFilter = name || null;
    render();
  }
  ```

- [ ] **Step 2: Add `_buildRecipeFilterBar()` helper**

  After the `setRecipeFilter` function, add:

  ```js
  function _buildRecipeFilterBar(items) {
    const names = new Set();
    items.forEach(item => {
      (item.sources || []).forEach(s => { if (s.recipe) names.add(s.recipe); });
    });
    if (names.size < 2) return '';
    const chips = ['All', ...names].map(name => {
      const active = (name === 'All' ? !_recipeFilter : _recipeFilter === name) ? ' active' : '';
      return `<button class="shop-recipe-chip${active}" onclick="Shopping.setRecipeFilter(${name === 'All' ? 'null' : JSON.stringify(name)})">${_esc(name)}</button>`;
    }).join('');
    return `<div class="shop-recipe-filter">${chips}</div>`;
  }
  ```

- [ ] **Step 3: Apply recipe filter in `render()`**

  Find in `js/shopping.js`:
  ```js
    const groups = {};
    items.forEach((item, idx) => {
      const cat = guessCategory(item.name);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push({ ...item, _idx: idx });
    });
  ```

  Change to:
  ```js
    const filterBar = _buildRecipeFilterBar(items);

    const visibleItems = !_recipeFilter
      ? items
      : items.filter(item => {
          if (!item.sources || item.sources.length === 0) return true;
          return item.sources.some(s => s.recipe === _recipeFilter);
        });

    const groups = {};
    visibleItems.forEach((item, idx) => {
      const cat = guessCategory(item.name);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push({ ...item, _idx: items.indexOf(item) });
    });
  ```

  Note: `_idx` must still be the original index into `items` (not into `visibleItems`) so that all item callbacks (`toggle`, `markPantryUsed`, etc.) work correctly.

- [ ] **Step 4: Prepend filter bar in `render()` output**

  Find in `js/shopping.js`:
  ```js
    el.innerHTML = orderedCats.map(cat => {
  ```

  Change to:
  ```js
    el.innerHTML = filterBar + orderedCats.map(cat => {
  ```

- [ ] **Step 5: Add pantry stock hint in `_renderItem()`**

  Find in `js/shopping.js`:
  ```js
    const usePantryBtn = (!item.checked && _hasPantryStock(item))
      ? `<div class="shop-pantry-row"><button class="shop-use-pantry-btn" onclick="Shopping.markPantryUsed(${item._idx})">Use pantry ●</button></div>`
      : '';
  ```

  Change to:
  ```js
    let usePantryBtn = '';
    if (!item.checked && !item.pantryUsed) {
      const p = Data.getPantryItem(item.name);
      if (p && p.qty > 0) {
        const hintHtml = `<span class="shop-pantry-stock-hint">· ${_fmtPantryQty(p.qty)} ${_esc(p.unit)} in pantry</span>`;
        usePantryBtn = `<div class="shop-pantry-row"><button class="shop-use-pantry-btn" onclick="Shopping.markPantryUsed(${item._idx})">Use pantry ●</button>${hintHtml}</div>`;
      }
    }
  ```

- [ ] **Step 6: Export `setRecipeFilter` in the return statement**

  Find in `js/shopping.js`:
  ```js
    return { render, toggle, toggleSources, clearChecked, editPrice, savePrice, markPantryUsed, setActualPrice, openAddAdHocItem, _adhocAutocomplete, _adhocSelect, saveAdHocItem, openConfirmShop, confirmShop };
  ```

  Change to:
  ```js
    return { render, toggle, toggleSources, clearChecked, editPrice, savePrice, markPantryUsed, setActualPrice, openAddAdHocItem, _adhocAutocomplete, _adhocSelect, saveAdHocItem, openConfirmShop, confirmShop, setRecipeFilter };
  ```

- [ ] **Step 7: Add CSS for recipe filter and pantry stock hint**

  Append to `css/style.css`:
  ```css

  /* ── Shopping: recipe filter chips (Sub-project E) ── */
  .shop-recipe-filter {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding: 0 0 10px;
    margin-bottom: 4px;
    scrollbar-width: none;
  }
  .shop-recipe-filter::-webkit-scrollbar { display: none; }
  .shop-recipe-chip {
    flex-shrink: 0;
    border: 1px solid var(--border);
    background: var(--surface);
    border-radius: 20px;
    padding: 4px 12px;
    font-size: 0.82rem;
    cursor: pointer;
    white-space: nowrap;
    color: inherit;
  }
  .shop-recipe-chip.active {
    background: var(--dk-green);
    color: #fff;
    border-color: var(--dk-green);
  }

  /* ── Shopping: pantry stock hint (Sub-project E) ── */
  .shop-pantry-stock-hint {
    font-size: 0.78rem;
    color: var(--text-muted);
    margin-left: 6px;
  }
  ```

- [ ] **Step 8: Commit**

  ```bash
  git add js/shopping.js css/style.css
  git commit -m "feat(shopping): recipe filter chips, pantry stock hint on items with stock"
  ```

---

### Task 2: Purchase quantity override in confirm-shop modal

**Files:**
- Modify: `js/shopping.js`

**Context:** `openConfirmShop()` (line 417) builds the confirm modal. `confirmShop()` (line 489) finalises the shop. Both need updating to support per-item qty override.

- [ ] **Step 1: Add `_confirmQtyOverrides` module var and `_setConfirmQty()` helper**

  After the `_recipeFilter` and `setRecipeFilter` additions from Task 1, add:

  ```js
  let _confirmQtyOverrides = {};

  function _setConfirmQty(idx, value) {
    const qty = parseFloat(value);
    _confirmQtyOverrides[idx] = isNaN(qty) || qty < 0 ? null : qty;
  }
  ```

- [ ] **Step 2: Reset `_confirmQtyOverrides` at the start of `openConfirmShop()`**

  Find in `js/shopping.js`:
  ```js
  function openConfirmShop() {
    const items = Data.getShoppingList();
    const bought = items.filter(i => i.checked);
  ```

  Change to:
  ```js
  function openConfirmShop() {
    _confirmQtyOverrides = {};
    const items = Data.getShoppingList();
    const bought = items.filter(i => i.checked);
  ```

- [ ] **Step 3: Add qty input to each bought row in `openConfirmShop()`**

  Find in `js/shopping.js`:
  ```js
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
  ```

  Change to:
  ```js
      const boughtRows = bought.map((item, i) => {
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
        const qtyInput = `<input type="number" class="confirm-item-qty-input" id="confirm-qty-${item._origIdx}"
          step="0.01" min="0" value="${fmtQty(item.qty) || ''}"
          placeholder="${fmtQty(item.qty) || ''}"
          oninput="Shopping._setConfirmQty(${item._origIdx}, this.value)"
          title="Actual qty purchased" /> <span class="confirm-item-unit">${_esc(item.unit || '')}</span>`;
        return `<div class="confirm-item-row">
        <span class="confirm-item-name">${_esc(item.name)}</span>
        <span class="confirm-item-qty-wrap">${qtyInput}</span>
        ${costHtml}
      </div>`;
      }).join('');
  ```

  Note: `item._origIdx` must be available. The `bought` array contains the original items — we need the original index in `items` for `_setConfirmQty`. Update the bought mapping to include it:

  Find the line where `bought` is assembled:
  ```js
    const bought = items.filter(i => i.checked);
  ```

  Change to:
  ```js
    const bought = items.map((item, idx) => ({ ...item, _origIdx: idx })).filter(i => i.checked);
  ```

  Do the same for `pantryItems`:
  ```js
    const pantryItems = items.filter(i => i.pantryUsed);
  ```

  Change to:
  ```js
    const pantryItems = items.map((item, idx) => ({ ...item, _origIdx: idx })).filter(i => i.pantryUsed);
  ```

- [ ] **Step 4: Use `_confirmQtyOverrides` in `confirmShop()` for pantry update and price calc**

  Find in `js/shopping.js`:
  ```js
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
  ```

  Change to:
  ```js
    // 1. Update price book for bought items with actualPrice
    bought.forEach(item => {
      const purchaseQty = _confirmQtyOverrides[item._origIdx] ?? item.qty;
      if (item.actualPrice != null && purchaseQty) {
        Data.setPriceEntry(item.name.toLowerCase().trim(), {
          unit: item.unit || 'item',
          pricePerUnit: item.actualPrice / purchaseQty,
          retailer,
        });
      }
    });

    // 2. Update pantry for bought items
    bought.forEach(item => {
      const purchaseQty = _confirmQtyOverrides[item._origIdx] ?? item.qty;
      if (purchaseQty) Data.setPantryItem(item.name, { qty: purchaseQty, unit: item.unit || 'item' });
    });
  ```

  Also, the `bought` and `pantryItems` in `confirmShop()` need `_origIdx` too. `confirmShop()` currently does:
  ```js
    const bought = items.filter(i => i.checked);
    const pantryItems = items.filter(i => i.pantryUsed);
  ```

  Change to:
  ```js
    const bought = items.map((item, idx) => ({ ...item, _origIdx: idx })).filter(i => i.checked);
    const pantryItems = items.map((item, idx) => ({ ...item, _origIdx: idx })).filter(i => i.pantryUsed);
  ```

- [ ] **Step 5: Add CSS for confirm qty input**

  Append to `css/style.css`:
  ```css

  /* ── Confirm shop: purchase qty input (Sub-project E) ── */
  .confirm-item-qty-input {
    width: 55px;
    padding: 2px 4px;
    border: 1px solid var(--border);
    border-radius: 4px;
    font-size: 0.85rem;
    text-align: center;
  }
  .confirm-item-qty-wrap { display: inline-flex; align-items: center; gap: 4px; }
  .confirm-item-unit { font-size: 0.85rem; color: var(--text-muted); }
  ```

- [ ] **Step 6: Export `_setConfirmQty` in the return statement**

  Find in `js/shopping.js`:
  ```js
    return { render, toggle, toggleSources, clearChecked, editPrice, savePrice, markPantryUsed, setActualPrice, openAddAdHocItem, _adhocAutocomplete, _adhocSelect, saveAdHocItem, openConfirmShop, confirmShop, setRecipeFilter };
  ```

  Change to:
  ```js
    return { render, toggle, toggleSources, clearChecked, editPrice, savePrice, markPantryUsed, setActualPrice, openAddAdHocItem, _adhocAutocomplete, _adhocSelect, saveAdHocItem, openConfirmShop, confirmShop, setRecipeFilter, _setConfirmQty };
  ```

- [ ] **Step 7: Commit**

  ```bash
  git add js/shopping.js css/style.css
  git commit -m "feat(shopping): purchase qty override in confirm-shop modal for accurate pantry update"
  ```
