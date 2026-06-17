# Price Estimation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-ingredient price tracking and weekly cost estimates to the Recipe Book PWA, with prices stored in a `priceBook` data structure, editable inline on the shopping list and in a dedicated Price Book screen, and summarised in the Planner Summary tab.

**Architecture:** A new `priceBook` array is added to `_db` in `data.js`. Unit-normalised price lookup lives in `data.js` (shared by shopping.js and planner.js). A new IIFE module `PriceBook` in `js/prices.js` owns the Price Book management view. Shopping list and planner summary both call `Data.lookupPrice()` — no duplicate calculation logic.

**Tech Stack:** Vanilla JS IIFE modules, localStorage, no bundler or test suite. Manual verification via `python -m http.server 8000`.

---

## File Map

| File | Change |
|---|---|
| `js/data.js` | Add `priceBook` to `_db`, `getPriceBook`, `setPriceEntry`, `removePriceEntry`, `lookupPriceEntry`, `lookupPrice`, `_normalizeToBase`, `_pricePerBase`; extend `load()`, `clearAll()`, `loadStarterPrices()` |
| `js/prices.js` | NEW — `PriceBook` IIFE: render, filter, openAddForm, openEditForm, saveForm, remove |
| `js/shopping.js` | Add price display row per item, inline edit form, `editPrice()`, `savePrice()`, running total footer |
| `js/planner.js` | Add `_calcRecipeCost()`, `_renderCostSection()`, append cost table to `_renderSummary()` output |
| `index.html` | Add `#view-pricebook` section; update shopping header; add Settings "Price Book" group; add `<script src="js/prices.js">` |
| `css/style.css` | Add styles for price display, inline edit form, running total, price book list rows |

---

### Task 1: Data layer — priceBook schema, CRUD, unit conversion, starter prices

**Files:**
- Modify: `js/data.js`

**Shape of a price entry:**
```js
{
  ingredient: 'beef mince',   // lowercase normalised name
  unit: 'kg',                 // one of: 'g','100g','kg','ml','100ml','l','item','tsp','tbsp'
  pricePerUnit: 140,          // ZAR (R140 per kg)
  retailer: 'Checkers',       // optional, '' if unset
  updatedDate: '2026-06-17'
}
```

- [ ] **Step 1: Add `priceBook` to the default `_db` object**

In `js/data.js`, change the `_db` initialiser (line 8) to include `priceBook: []`:

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

- [ ] **Step 2: Ensure `priceBook` survives the `load()` merge and `clearAll()` reset**

In `load()` (after the `DAYS.forEach` block), add:
```js
if (!_db.priceBook) _db.priceBook = [];
```

In `clearAll()`, add `priceBook: [],` to the reset object:
```js
_db = {
  version: '1.1',
  lastUpdated: new Date().toISOString(),
  recipes: [],
  mealPlan: { week1:{}, week2:{}, week3:{}, week4:{} },
  pantry: [],
  shoppingList: [],
  priceBook: [],
};
```

- [ ] **Step 3: Add unit conversion helpers (private, inside the IIFE)**

Add these two functions inside `Data` after `setRecipeCalories`:

```js
function _normalizeToBase(qty, unit) {
  const u = (unit || '').toLowerCase();
  if (u === 'kg')   return [qty * 1000, 'g'];
  if (u === 'g')    return [qty, 'g'];
  if (u === 'l')    return [qty * 1000, 'ml'];
  if (u === 'ml')   return [qty, 'ml'];
  if (u === 'tsp')  return [qty * 5, 'ml'];
  if (u === 'tbsp') return [qty * 15, 'ml'];
  if (u === 'cup')  return [qty * 240, 'ml'];
  if (u === 'oz')   return [qty * 28.35, 'g'];
  if (u === 'lb')   return [qty * 453.6, 'g'];
  return [qty, 'item'];
}

function _pricePerBase(pricePerUnit, pbUnit) {
  if (pbUnit === 'g')     return [pricePerUnit, 'g'];
  if (pbUnit === '100g')  return [pricePerUnit / 100, 'g'];
  if (pbUnit === 'kg')    return [pricePerUnit / 1000, 'g'];
  if (pbUnit === 'ml')    return [pricePerUnit, 'ml'];
  if (pbUnit === '100ml') return [pricePerUnit / 100, 'ml'];
  if (pbUnit === 'l')     return [pricePerUnit / 1000, 'ml'];
  if (pbUnit === 'tsp')   return [pricePerUnit / 5, 'ml'];
  if (pbUnit === 'tbsp')  return [pricePerUnit / 15, 'ml'];
  return [pricePerUnit, 'item'];
}
```

- [ ] **Step 4: Add public accessor and CRUD methods**

Add after `_pricePerBase`:

```js
function getPriceBook() { return _db.priceBook || []; }

function setPriceEntry(entry, idx) {
  if (!_db.priceBook) _db.priceBook = [];
  if (idx !== undefined && idx >= 0 && idx < _db.priceBook.length) {
    _db.priceBook[idx] = entry;
  } else {
    const existing = _db.priceBook.findIndex(
      e => e.ingredient.toLowerCase() === entry.ingredient.toLowerCase()
    );
    if (existing >= 0) _db.priceBook[existing] = entry;
    else _db.priceBook.push(entry);
  }
  save();
}

function removePriceEntry(idx) {
  if (!_db.priceBook || idx < 0 || idx >= _db.priceBook.length) return;
  _db.priceBook.splice(idx, 1);
  save();
}

function lookupPriceEntry(name) {
  const lower = (name || '').toLowerCase().trim();
  const book = _db.priceBook || [];
  return book.find(e =>
    lower.includes(e.ingredient.toLowerCase()) ||
    e.ingredient.toLowerCase().includes(lower)
  ) || null;
}

function lookupPrice(name, qty, unit) {
  const entry = lookupPriceEntry(name);
  if (!entry) return null;
  const parsedQty = parseFloat(qty) || 0;
  if (parsedQty === 0) return 0;
  const [baseQty, baseType]          = _normalizeToBase(parsedQty, unit || '');
  const [pbPricePerBase, pbBaseType] = _pricePerBase(entry.pricePerUnit, entry.unit);
  if (baseType !== pbBaseType) return null;
  return Math.round(baseQty * pbPricePerBase * 100) / 100;
}
```

- [ ] **Step 5: Add `loadStarterPrices()` with ~64 common SA grocery items**

Add this function after `loadStarterData`:

```js
function loadStarterPrices() {
  if (_db.priceBook && _db.priceBook.length > 0) return;
  const d = '2026-06-17';
  _db.priceBook = [
    // Produce
    { ingredient: 'onion',         unit: 'kg',   pricePerUnit: 20,  retailer: '', updatedDate: d },
    { ingredient: 'garlic',        unit: 'item', pricePerUnit: 4,   retailer: '', updatedDate: d },
    { ingredient: 'tomato',        unit: 'kg',   pricePerUnit: 35,  retailer: '', updatedDate: d },
    { ingredient: 'potato',        unit: 'kg',   pricePerUnit: 22,  retailer: '', updatedDate: d },
    { ingredient: 'carrot',        unit: 'kg',   pricePerUnit: 22,  retailer: '', updatedDate: d },
    { ingredient: 'capsicum',      unit: 'kg',   pricePerUnit: 55,  retailer: '', updatedDate: d },
    { ingredient: 'cucumber',      unit: 'item', pricePerUnit: 12,  retailer: '', updatedDate: d },
    { ingredient: 'spinach',       unit: 'kg',   pricePerUnit: 35,  retailer: '', updatedDate: d },
    { ingredient: 'mushroom',      unit: 'kg',   pricePerUnit: 80,  retailer: '', updatedDate: d },
    { ingredient: 'broccoli',      unit: 'kg',   pricePerUnit: 50,  retailer: '', updatedDate: d },
    { ingredient: 'avocado',       unit: 'item', pricePerUnit: 18,  retailer: '', updatedDate: d },
    { ingredient: 'lemon',         unit: 'item', pricePerUnit: 8,   retailer: '', updatedDate: d },
    { ingredient: 'lime',          unit: 'item', pricePerUnit: 6,   retailer: '', updatedDate: d },
    { ingredient: 'banana',        unit: 'kg',   pricePerUnit: 22,  retailer: '', updatedDate: d },
    { ingredient: 'apple',         unit: 'kg',   pricePerUnit: 38,  retailer: '', updatedDate: d },
    { ingredient: 'orange',        unit: 'kg',   pricePerUnit: 28,  retailer: '', updatedDate: d },
    { ingredient: 'ginger',        unit: '100g', pricePerUnit: 12,  retailer: '', updatedDate: d },
    { ingredient: 'chilli',        unit: '100g', pricePerUnit: 15,  retailer: '', updatedDate: d },
    { ingredient: 'spring onion',  unit: 'item', pricePerUnit: 6,   retailer: '', updatedDate: d },
    { ingredient: 'sweet potato',  unit: 'kg',   pricePerUnit: 28,  retailer: '', updatedDate: d },
    // Meat
    { ingredient: 'beef mince',    unit: 'kg',   pricePerUnit: 140, retailer: '', updatedDate: d },
    { ingredient: 'chicken breast',unit: 'kg',   pricePerUnit: 95,  retailer: '', updatedDate: d },
    { ingredient: 'chicken thigh', unit: 'kg',   pricePerUnit: 70,  retailer: '', updatedDate: d },
    { ingredient: 'chicken',       unit: 'kg',   pricePerUnit: 80,  retailer: '', updatedDate: d },
    { ingredient: 'pork',          unit: 'kg',   pricePerUnit: 110, retailer: '', updatedDate: d },
    { ingredient: 'lamb',          unit: 'kg',   pricePerUnit: 190, retailer: '', updatedDate: d },
    { ingredient: 'rump steak',    unit: 'kg',   pricePerUnit: 200, retailer: '', updatedDate: d },
    { ingredient: 'beef fillet',   unit: 'kg',   pricePerUnit: 420, retailer: '', updatedDate: d },
    { ingredient: 'bacon',         unit: 'kg',   pricePerUnit: 130, retailer: '', updatedDate: d },
    { ingredient: 'sausage',       unit: 'kg',   pricePerUnit: 90,  retailer: '', updatedDate: d },
    { ingredient: 'salmon',        unit: 'kg',   pricePerUnit: 280, retailer: '', updatedDate: d },
    { ingredient: 'tuna',          unit: '100g', pricePerUnit: 15,  retailer: '', updatedDate: d },
    // Dairy
    { ingredient: 'milk',          unit: 'l',    pricePerUnit: 26,  retailer: '', updatedDate: d },
    { ingredient: 'cream',         unit: '100ml',pricePerUnit: 16,  retailer: '', updatedDate: d },
    { ingredient: 'butter',        unit: '100g', pricePerUnit: 18,  retailer: '', updatedDate: d },
    { ingredient: 'cheddar',       unit: '100g', pricePerUnit: 28,  retailer: '', updatedDate: d },
    { ingredient: 'feta',          unit: '100g', pricePerUnit: 22,  retailer: '', updatedDate: d },
    { ingredient: 'mozzarella',    unit: '100g', pricePerUnit: 25,  retailer: '', updatedDate: d },
    { ingredient: 'parmesan',      unit: '100g', pricePerUnit: 55,  retailer: '', updatedDate: d },
    { ingredient: 'yogurt',        unit: 'kg',   pricePerUnit: 65,  retailer: '', updatedDate: d },
    { ingredient: 'egg',           unit: 'item', pricePerUnit: 4,   retailer: '', updatedDate: d },
    { ingredient: 'sour cream',    unit: '100g', pricePerUnit: 12,  retailer: '', updatedDate: d },
    // Pantry
    { ingredient: 'olive oil',     unit: '100ml',pricePerUnit: 18,  retailer: '', updatedDate: d },
    { ingredient: 'sunflower oil', unit: 'l',    pricePerUnit: 25,  retailer: '', updatedDate: d },
    { ingredient: 'coconut oil',   unit: '100ml',pricePerUnit: 22,  retailer: '', updatedDate: d },
    { ingredient: 'flour',         unit: 'kg',   pricePerUnit: 16,  retailer: '', updatedDate: d },
    { ingredient: 'sugar',         unit: 'kg',   pricePerUnit: 18,  retailer: '', updatedDate: d },
    { ingredient: 'rice',          unit: 'kg',   pricePerUnit: 18,  retailer: '', updatedDate: d },
    { ingredient: 'pasta',         unit: 'kg',   pricePerUnit: 28,  retailer: '', updatedDate: d },
    { ingredient: 'spaghetti',     unit: 'kg',   pricePerUnit: 28,  retailer: '', updatedDate: d },
    { ingredient: 'oats',          unit: 'kg',   pricePerUnit: 38,  retailer: '', updatedDate: d },
    { ingredient: 'bread',         unit: 'item', pricePerUnit: 22,  retailer: '', updatedDate: d },
    { ingredient: 'honey',         unit: '100g', pricePerUnit: 16,  retailer: '', updatedDate: d },
    { ingredient: 'soy sauce',     unit: '100ml',pricePerUnit: 12,  retailer: '', updatedDate: d },
    { ingredient: 'tomato paste',  unit: '100g', pricePerUnit: 10,  retailer: '', updatedDate: d },
    { ingredient: 'tinned tomato', unit: '100g', pricePerUnit: 5,   retailer: '', updatedDate: d },
    { ingredient: 'coconut milk',  unit: '100ml',pricePerUnit: 8,   retailer: '', updatedDate: d },
    { ingredient: 'stock',         unit: 'item', pricePerUnit: 8,   retailer: '', updatedDate: d },
    { ingredient: 'vinegar',       unit: '100ml',pricePerUnit: 4,   retailer: '', updatedDate: d },
    // Spices
    { ingredient: 'cumin',         unit: '100g', pricePerUnit: 38,  retailer: '', updatedDate: d },
    { ingredient: 'paprika',       unit: '100g', pricePerUnit: 32,  retailer: '', updatedDate: d },
    { ingredient: 'turmeric',      unit: '100g', pricePerUnit: 30,  retailer: '', updatedDate: d },
    { ingredient: 'cinnamon',      unit: '100g', pricePerUnit: 35,  retailer: '', updatedDate: d },
    { ingredient: 'curry powder',  unit: '100g', pricePerUnit: 42,  retailer: '', updatedDate: d },
    { ingredient: 'garam masala',  unit: '100g', pricePerUnit: 45,  retailer: '', updatedDate: d },
    { ingredient: 'black pepper',  unit: '100g', pricePerUnit: 42,  retailer: '', updatedDate: d },
    { ingredient: 'cayenne',       unit: '100g', pricePerUnit: 38,  retailer: '', updatedDate: d },
    { ingredient: 'oregano',       unit: '100g', pricePerUnit: 32,  retailer: '', updatedDate: d },
    { ingredient: 'thyme',         unit: '100g', pricePerUnit: 32,  retailer: '', updatedDate: d },
  ];
  save();
}
```

- [ ] **Step 6: Export the new public methods in the `return` statement**

Replace the existing `return` block at the bottom of `data.js` with:

```js
return {
  load, save, getRecipes, getPlan, getPantry, getShoppingList,
  addRecipe, updateRecipe, deleteRecipe, getRecipeById,
  setMealSlot, setShoppingList, setTreats, setRecipeCalories, toggleShoppingItem,
  isDriveConnected, connectDrive, disconnectDrive, syncDrive,
  exportJSON, importJSON, handleImportFile, clearAll,
  loadStarterData, loadStarterPrices, getClientId, setClientId,
  getPriceBook, setPriceEntry, removePriceEntry, lookupPriceEntry, lookupPrice,
  DAYS, MEALS,
};
```

- [ ] **Step 7: Call `loadStarterPrices()` in `App.init()`**

In `js/app.js`, inside `App.init()`, add the call directly after `Data.loadStarterData()`:

```js
Data.loadStarterData();
Data.loadStarterPrices();
```

- [ ] **Step 8: Verify**

Open `http://localhost:8000`, open browser DevTools console, run:
```js
Data.getPriceBook().length  // should be 64
Data.lookupPrice('beef mince', 500, 'g')  // should be 70 (500g × R140/kg)
Data.lookupPrice('olive oil', 2, 'tbsp')  // should be ~0.54 (30ml × R0.18/ml)
Data.lookupPrice('garlic', 2, 'clove')    // should be 8 (2 items × R4/item)
Data.lookupPrice('salt', 1, 'tsp')        // should be null (no price for 'salt')
```

- [ ] **Step 9: Commit**

```bash
git add js/data.js js/app.js
git commit -m "feat(data): add priceBook schema, CRUD, unit-normalised lookup, and SA starter prices"
```

---

### Task 2: Shopping list inline price display, edit form, and running total

**Files:**
- Modify: `js/shopping.js`

The shopping list item gets a new `.shop-price-display` row between the `.shop-item-top` and `.shop-item-sources`. The running total appears as a footer below all category groups.

- [ ] **Step 1: Add a `_renderPriceDisplay(idx, item)` helper function inside `Shopping`**

Add this function before `render()`:

```js
function _renderPriceDisplay(idx, item) {
  const entry = Data.lookupPriceEntry(item.name);
  if (!entry) {
    return `<div class="shop-price-display" id="shop-price-${idx}">
      <button class="shop-price-set" onclick="Shopping.editPrice(${idx})">+ Set price</button>
    </div>`;
  }
  const cost = Data.lookupPrice(item.name, item.qty, item.unit);
  const costHtml = cost != null
    ? `<span class="shop-price-cost">R ${cost.toFixed(2)}</span><span class="shop-price-sep">·</span>`
    : '';
  const retailer = entry.retailer ? ` <span class="shop-price-retailer-tag">${entry.retailer}</span>` : '';
  return `<div class="shop-price-display" id="shop-price-${idx}">
    ${costHtml}<span class="shop-price-per">R ${entry.pricePerUnit.toFixed(2)}/${entry.unit}</span>${retailer}
    <button class="shop-price-edit-btn" onclick="Shopping.editPrice(${idx})" title="Edit price">✏</button>
  </div>`;
}
```

- [ ] **Step 2: Add `editPrice(idx)` and `savePrice(idx)` functions**

Add after `_renderPriceDisplay`:

```js
function editPrice(idx) {
  const items = Data.getShoppingList();
  const item = items[idx];
  if (!item) return;
  const entry = Data.lookupPriceEntry(item.name) || {};
  const units = ['g','100g','kg','ml','100ml','l','item','tsp','tbsp'];
  const unitOpts = units.map(u =>
    `<option value="${u}" ${(entry.unit || 'item') === u ? 'selected' : ''}>${u}</option>`
  ).join('');
  const priceEl = document.getElementById('shop-price-' + idx);
  if (!priceEl) return;
  priceEl.innerHTML = `
    <div class="shop-price-form">
      <span class="shop-pf-label">R</span>
      <input type="number" id="sp-price-${idx}" class="shop-pf-input"
        step="0.01" min="0" value="${entry.pricePerUnit != null ? entry.pricePerUnit : ''}" placeholder="0.00" />
      <span class="shop-pf-sep">per</span>
      <select id="sp-unit-${idx}" class="shop-pf-unit">${unitOpts}</select>
      <input type="text" id="sp-retailer-${idx}" class="shop-pf-retailer"
        value="${entry.retailer || ''}" placeholder="Store" maxlength="20" />
      <button class="btn-mini btn-mini-primary" onclick="Shopping.savePrice(${idx})">Save</button>
      <button class="btn-mini" onclick="Shopping.render()">✕</button>
    </div>`;
  document.getElementById('sp-price-' + idx)?.focus();
}

function savePrice(idx) {
  const items = Data.getShoppingList();
  const item = items[idx];
  if (!item) return;
  const price = parseFloat(document.getElementById('sp-price-' + idx)?.value);
  const unit = document.getElementById('sp-unit-' + idx)?.value || 'item';
  const retailer = (document.getElementById('sp-retailer-' + idx)?.value || '').trim();
  if (isNaN(price) || price < 0) { App.toast('Enter a valid price', 'warn'); return; }
  Data.setPriceEntry({
    ingredient: item.name.toLowerCase().trim(),
    unit,
    pricePerUnit: price,
    retailer,
    updatedDate: new Date().toISOString().slice(0, 10),
  });
  render();
  App.toast('Price saved ✓');
}
```

- [ ] **Step 3: Add `_renderTotal(items)` function**

Add after `savePrice`:

```js
function _renderTotal(items) {
  let total = 0;
  let unpriced = 0;
  items.forEach(item => {
    const cost = Data.lookupPrice(item.name, item.qty, item.unit);
    if (cost != null) total += cost;
    else unpriced++;
  });
  if (total === 0 && unpriced === items.length) return '';
  const note = unpriced > 0
    ? `<span class="shop-total-note">${unpriced} item${unpriced > 1 ? 's' : ''} unpriced</span>`
    : '';
  return `<div class="shop-total">
    <span class="shop-total-label">Estimated total</span>
    <span class="shop-total-amount">R ${total.toFixed(2)}</span>
    ${note}
  </div>`;
}
```

- [ ] **Step 4: Update `render()` to include price display and running total**

In `render()`, update the item HTML to include `_renderPriceDisplay` (insert between `.shop-item-top` and `sourcesHtml`), and append `_renderTotal` after the category groups.

Replace the `return` block inside the `rows` map and the final `el.innerHTML =` assignment with:

```js
        return `
          <div class="shop-item ${item.checked ? 'checked' : ''}" id="shop-item-${item._idx}">
            <input type="checkbox" ${item.checked ? 'checked' : ''}
              onchange="Shopping.toggle(${item._idx})" />
            <div class="shop-item-main">
              <div class="shop-item-top">
                <span class="shop-item-name">${label}</span>
                ${hasSources ? `<button id="shop-src-btn-${item._idx}" class="shop-src-toggle" onclick="Shopping.toggleSources(${item._idx})">View recipes ▾</button>` : ''}
              </div>
              ${_renderPriceDisplay(item._idx, item)}
              ${sourcesHtml}
            </div>
          </div>`;
```

And change the final `el.innerHTML = ...` line to append the total:

```js
    el.innerHTML = orderedCats.map(cat => {
      const catItems = groups[cat];
      const rows = catItems.map(item => {
        // ... (item HTML as above)
      }).join('');
      return `
        <div class="shop-category">
          <div class="shop-cat-label">${cat.toUpperCase()}</div>
          ${rows}
        </div>`;
    }).join('') + _renderTotal(items);
```

- [ ] **Step 5: Export new functions in the `return` statement**

```js
return { render, toggle, toggleSources, clearChecked, editPrice, savePrice };
```

- [ ] **Step 6: Verify**

Open `http://localhost:8000`, navigate to Shop. Generate a shopping list from the Planner (Week 1, Meals tab → generate). Check:
- Each item shows a price row (either "R 70.00 · R140/kg ✏" or "+ Set price")
- Clicking ✏ or "+ Set price" shows the inline edit form
- Entering a price and clicking Save persists it and re-renders with the price
- The estimated total footer appears at the bottom

- [ ] **Step 7: Commit**

```bash
git add js/shopping.js
git commit -m "feat(shopping): inline price display, edit form, and estimated total footer"
```

---

### Task 3: Price Book management view

**Files:**
- Create: `js/prices.js`
- Modify: `index.html`

The Price Book is a full-screen view (`#view-pricebook`) pushed onto the view stack. It shows all price entries with search filtering, edit/delete per row, and an "Add" button that opens the modal.

- [ ] **Step 1: Create `js/prices.js`**

```js
/* ══════════════════════════════════════
   prices.js — Price Book management view
   ══════════════════════════════════════ */

const PriceBook = (() => {
  let _filter = '';

  const UNITS = ['g','100g','kg','ml','100ml','l','item','tsp','tbsp'];

  function render() {
    const entries = Data.getPriceBook();
    const el = document.getElementById('pricebook-list');
    if (!el) return;
    const filterLower = _filter.toLowerCase();
    const filtered = filterLower
      ? entries.filter(e => e.ingredient.toLowerCase().includes(filterLower))
      : entries;

    if (filtered.length === 0) {
      el.innerHTML = `<div class="empty-state"><span class="emoji">💰</span>${
        filterLower ? 'No matches.' : 'No prices yet. Tap ＋ Add to get started.'
      }</div>`;
      return;
    }

    el.innerHTML = filtered.map(entry => {
      const realIdx = entries.indexOf(entry);
      const retailer = entry.retailer
        ? `<span class="pb-retailer">${entry.retailer}</span>` : '';
      return `
      <div class="pb-row">
        <div class="pb-row-main">
          <span class="pb-ingredient">${entry.ingredient}</span>
          <span class="pb-price">R ${entry.pricePerUnit.toFixed(2)}/${entry.unit}</span>
          ${retailer}
        </div>
        <div class="pb-row-actions">
          <button class="btn-mini" onclick="PriceBook.openEditForm(${realIdx})">Edit</button>
          <button class="btn-mini btn-danger-mini" onclick="PriceBook.remove(${realIdx})">✕</button>
        </div>
      </div>`;
    }).join('');
  }

  function filter() {
    _filter = (document.getElementById('pb-search')?.value || '').trim();
    render();
  }

  function openAddForm() {
    _openForm(null, null);
  }

  function openEditForm(idx) {
    const entry = Data.getPriceBook()[idx];
    if (entry) _openForm(entry, idx);
  }

  function _openForm(entry, idx) {
    const e = entry || {};
    const unitOpts = UNITS.map(u =>
      `<option value="${u}" ${(e.unit || 'kg') === u ? 'selected' : ''}>${u}</option>`
    ).join('');
    document.getElementById('modal-content').innerHTML = `
    <h3>${entry ? 'Edit Price' : 'Add Price'}</h3>
    <div class="form-group">
      <label>Ingredient</label>
      <input id="pb-form-ing" type="text" value="${e.ingredient || ''}"
        placeholder="e.g. beef mince" ${entry ? '' : 'autofocus'} />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Price (R)</label>
        <input id="pb-form-price" type="number" step="0.01" min="0"
          value="${e.pricePerUnit != null ? e.pricePerUnit : ''}" placeholder="0.00" />
      </div>
      <div class="form-group">
        <label>Per</label>
        <select id="pb-form-unit">${unitOpts}</select>
      </div>
    </div>
    <div class="form-group">
      <label>Retailer (optional)</label>
      <input id="pb-form-retailer" type="text" value="${e.retailer || ''}"
        placeholder="e.g. Checkers" maxlength="30" />
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn-primary" onclick="PriceBook.saveForm(${idx !== null ? idx : 'null'})">Save</button>
    </div>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
  }

  function saveForm(idx) {
    const ingredient = (document.getElementById('pb-form-ing')?.value || '').trim().toLowerCase();
    const price = parseFloat(document.getElementById('pb-form-price')?.value);
    const unit = document.getElementById('pb-form-unit')?.value || 'item';
    const retailer = (document.getElementById('pb-form-retailer')?.value || '').trim();
    if (!ingredient) { App.toast('Enter an ingredient name', 'warn'); return; }
    if (isNaN(price) || price < 0) { App.toast('Enter a valid price', 'warn'); return; }
    Data.setPriceEntry({
      ingredient,
      unit,
      pricePerUnit: price,
      retailer,
      updatedDate: new Date().toISOString().slice(0, 10),
    }, idx !== null ? idx : undefined);
    App.closeModal();
    render();
    App.toast('Price saved ✓');
  }

  function remove(idx) {
    if (!confirm('Remove this price entry?')) return;
    Data.removePriceEntry(idx);
    render();
    App.toast('Removed');
  }

  return { render, filter, openAddForm, openEditForm, saveForm, remove };
})();
```

- [ ] **Step 2: Add the `#view-pricebook` section to `index.html`**

Insert a new `<section>` inside `<main id="main">` immediately before the closing `</main>` tag (after the Settings section):

```html
    <!-- PRICE BOOK -->
    <section id="view-pricebook" class="view">
      <div class="section-header">
        <h2>Price Book</h2>
        <button class="btn-small" onclick="PriceBook.openAddForm()">＋ Add</button>
      </div>
      <div class="search-bar">
        <input id="pb-search" type="search" placeholder="Search ingredients…"
          oninput="PriceBook.filter()" />
      </div>
      <div id="pricebook-list"></div>
    </section>
```

- [ ] **Step 3: Add navigation buttons**

In `index.html`, update the Shopping List section header to add a Price Book button:

```html
    <!-- SHOPPING LIST -->
    <section id="view-shopping" class="view">
      <div class="section-header">
        <h2>Shopping List</h2>
        <div class="section-header-actions">
          <button class="btn-small" onclick="App.pushView('pricebook','Price Book'); PriceBook.render()">Price Book</button>
          <button class="btn-small" onclick="Shopping.clearChecked()">Clear checked</button>
        </div>
      </div>
      <div id="shopping-list"></div>
    </section>
```

In the Settings view, add a new group before the "Data" group:

```html
      <div class="settings-group">
        <h3>Price Book</h3>
        <p class="hint">Store prices for ingredients to estimate weekly shopping costs.</p>
        <button class="btn-secondary" onclick="App.pushView('pricebook','Price Book'); PriceBook.render()">Manage Price Book →</button>
      </div>
```

- [ ] **Step 4: Add the script tag to `index.html`**

In the Scripts section at the bottom, add `prices.js` before `app.js`:

```html
  <script src="js/data.js"></script>
  <script src="js/recipes.js"></script>
  <script src="js/planner.js"></script>
  <script src="js/shopping.js"></script>
  <script src="js/spoonacular.js"></script>
  <script src="js/prices.js"></script>
  <script src="js/app.js"></script>
```

- [ ] **Step 5: Verify**

Open `http://localhost:8000`. Navigate to Settings → "Manage Price Book →". Confirm:
- Price Book view renders with 64 pre-populated rows
- Search filters the list as you type
- Clicking Edit opens the modal with pre-filled values
- Saving updates the row in place
- Clicking ✕ removes the entry after confirmation
- ＋ Add button opens the modal with empty form; saving appends to the list
- Back button returns to Settings

Also verify from the Shopping List: the "Price Book" button appears in the header and navigates correctly.

- [ ] **Step 6: Commit**

```bash
git add js/prices.js index.html
git commit -m "feat(prices): add Price Book view with search, add/edit/delete, accessible from settings and shopping list"
```

---

### Task 4: Planner summary cost breakdown

**Files:**
- Modify: `js/planner.js`

Add a cost summary table below the calorie table in `_renderSummary()`. Uses the same day-by-day layout. Partial costs (some ingredients unpriced) are shown with a `~` prefix. A separate footnote explains partial entries.

- [ ] **Step 1: Add `_calcRecipeCost(recipe)` helper inside `Planner`**

Add this function after `_buildDayHtml`:

```js
function _calcRecipeCost(recipe) {
  const ingredients = Recipes.parseIngredients(recipe.ingredients);
  let total = 0;
  let partial = false;
  for (const ing of ingredients) {
    const cost = Data.lookupPrice(ing.name, ing.qty, ing.unit);
    if (cost === null) partial = true;
    else total += cost;
  }
  const perServing = total / (recipe.servings || 1);
  return { cost: Math.round(perServing * 100) / 100, partial };
}
```

- [ ] **Step 2: Add `_renderCostSection(wk, treats)` function**

Add this function after `_calcRecipeCost`:

```js
function _renderCostSection(wk, treats) {
  let hasMissingPrice = false;

  const dayRows = Data.DAYS.map(day => {
    const dayData = wk[day] || {};
    let dayTotal = 0;
    const parts = [];
    Data.MEALS.forEach(meal => {
      const id = dayData[meal];
      if (!id) return;
      const r = Data.getRecipeById(id);
      if (!r) return;
      const { cost, partial } = _calcRecipeCost(r);
      const abbrev = meal[0].toUpperCase();
      if (partial) hasMissingPrice = true;
      dayTotal += cost;
      parts.push(`${abbrev}:${partial ? '~' : ''}R${cost.toFixed(0)}`);
    });
    return { label: DAY_LABELS[day], parts, dayTotal };
  });

  const mealsTotal = dayRows.reduce((sum, d) => sum + d.dayTotal, 0);

  let treatsTotal = 0;
  const treatRows = treats.map(t => {
    const r = Data.getRecipeById(t.recipeId);
    if (!r) return null;
    const { cost, partial } = _calcRecipeCost(r);
    const total = cost * (t.batches || 1);
    treatsTotal += total;
    if (partial) hasMissingPrice = true;
    return { name: r.name, batches: t.batches || 1, cost: total, partial };
  }).filter(Boolean);

  const weekTotal = mealsTotal + treatsTotal;
  const hasContent = dayRows.some(d => d.parts.length > 0) || treatRows.length > 0;
  if (!hasContent) return '';

  const dayRowsHtml = dayRows.map(d => `
    <tr>
      <td class="summary-day">${d.label}</td>
      <td class="summary-meals">${d.parts.join(' · ') || '<span style="color:var(--text-muted)">—</span>'}</td>
      <td class="summary-day-total">${d.dayTotal > 0 ? 'R ' + d.dayTotal.toFixed(2) : (d.parts.length ? '—' : '')}</td>
    </tr>`).join('');

  const treatSectionHtml = treatRows.length ? `
    <tr class="summary-section-header"><td colspan="3">Treats</td></tr>
    ${treatRows.map(t => `
    <tr>
      <td colspan="2" class="summary-treat-name">${t.name} ×${t.batches}</td>
      <td class="summary-day-total">${t.partial ? '~' : ''}R ${t.cost.toFixed(2)}</td>
    </tr>`).join('')}
    <tr class="summary-subtotal">
      <td colspan="2">Treats total</td>
      <td class="summary-day-total">${treatsTotal > 0 ? 'R ' + treatsTotal.toFixed(2) : '—'}</td>
    </tr>` : '';

  const footnote = hasMissingPrice
    ? `<p class="summary-footnote">~ Some ingredients unpriced — open Price Book to add missing prices.</p>` : '';

  return `
    <div class="summary-header">Week ${_currentWeek} — Estimated Cost</div>
    <table class="summary-table">
      <tbody>
        ${dayRowsHtml}
        <tr class="summary-subtotal">
          <td colspan="2">Meals total</td>
          <td class="summary-day-total">${mealsTotal > 0 ? 'R ' + mealsTotal.toFixed(2) : '—'}</td>
        </tr>
        ${treatSectionHtml}
        <tr class="summary-grand-total">
          <td colspan="2">Week total</td>
          <td class="summary-day-total">${weekTotal > 0 ? 'R ' + weekTotal.toFixed(2) : '—'}</td>
        </tr>
      </tbody>
    </table>
    ${footnote}`;
}
```

- [ ] **Step 3: Append cost section to `_renderSummary()` output**

In `_renderSummary()`, find the final `el.innerHTML = \`...\`` assignment and append `_renderCostSection(wk, treats)` at the end:

```js
    el.innerHTML = `
      <div class="summary-header">Week ${_currentWeek} — Calorie Summary</div>
      <table class="summary-table">
        <tbody>
          ${dayRowsHtml}
          <tr class="summary-subtotal">
            <td colspan="2">Meals total</td>
            <td class="summary-day-total">${mealsTotal > 0 ? mealsTotal + ' kcal' : '—'}</td>
          </tr>
          ${treatSectionHtml}
          <tr class="summary-grand-total">
            <td colspan="2">Week total</td>
            <td class="summary-day-total">${weekTotal > 0 ? weekTotal + ' kcal' : '—'}</td>
          </tr>
        </tbody>
      </table>
      ${footnote}
      ${_renderCostSection(wk, treats)}`;
```

- [ ] **Step 4: Verify**

Open `http://localhost:8000`, go to Planner → Summary tab. Confirm:
- A "Week 1 — Estimated Cost" section appears below the calorie table
- Days with recipes show per-meal costs (B:R22 L:R45 D:R88)
- Day totals add up correctly
- If some ingredients have no price, a `~` prefix appears and the footnote shows
- Treats section shows cost per batch count

- [ ] **Step 5: Commit**

```bash
git add js/planner.js
git commit -m "feat(planner): add weekly cost estimate section to summary tab"
```

---

### Task 5: CSS for all new price UI elements

**Files:**
- Modify: `css/style.css`

- [ ] **Step 1: Add shopping list price styles**

Append to the end of `css/style.css`:

```css
/* ── Shopping list price display ─────────────────────── */
.shop-price-display {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.78rem;
  color: var(--text-muted);
  margin-top: 2px;
  flex-wrap: wrap;
}
.shop-price-cost {
  font-weight: 600;
  color: var(--md-green);
}
.shop-price-sep { opacity: 0.5; }
.shop-price-per { opacity: 0.8; }
.shop-price-retailer-tag {
  background: var(--lt-green);
  color: var(--dk-green);
  border-radius: 4px;
  padding: 0 5px;
  font-size: 0.72rem;
  font-weight: 600;
}
.shop-price-edit-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0 2px;
  font-size: 0.78rem;
  opacity: 0.5;
  line-height: 1;
}
.shop-price-edit-btn:hover { opacity: 1; }
.shop-price-set {
  background: none;
  border: 1px dashed var(--text-muted);
  border-radius: 4px;
  padding: 1px 8px;
  font-size: 0.75rem;
  color: var(--text-muted);
  cursor: pointer;
}
.shop-price-set:hover { border-color: var(--md-green); color: var(--md-green); }

/* Inline price edit form */
.shop-price-form {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  margin-top: 2px;
}
.shop-pf-label { font-size: 0.8rem; font-weight: 600; }
.shop-pf-sep   { font-size: 0.78rem; opacity: 0.7; }
.shop-pf-input {
  width: 64px;
  padding: 3px 6px;
  font-size: 0.8rem;
  border: 1px solid #ccc;
  border-radius: 6px;
}
.shop-pf-unit {
  padding: 3px 4px;
  font-size: 0.78rem;
  border: 1px solid #ccc;
  border-radius: 6px;
}
.shop-pf-retailer {
  width: 80px;
  padding: 3px 6px;
  font-size: 0.78rem;
  border: 1px solid #ccc;
  border-radius: 6px;
}

/* Running total */
.shop-total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  margin-top: 8px;
  background: var(--lt-green);
  border-radius: 10px;
  flex-wrap: wrap;
  gap: 4px;
}
.shop-total-label { font-size: 0.88rem; color: var(--dk-green); font-weight: 600; }
.shop-total-amount { font-size: 1.1rem; font-weight: 700; color: var(--dk-green); }
.shop-total-note {
  width: 100%;
  font-size: 0.75rem;
  color: var(--text-muted);
}

/* ── Price Book view ─────────────────────────────────── */
.pb-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid #e8e8e8;
  gap: 8px;
}
.pb-row:last-child { border-bottom: none; }
.pb-row-main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  flex-wrap: wrap;
  min-width: 0;
}
.pb-ingredient {
  font-weight: 600;
  font-size: 0.9rem;
  text-transform: capitalize;
}
.pb-price {
  font-size: 0.85rem;
  color: var(--md-green);
  font-weight: 600;
}
.pb-retailer {
  font-size: 0.75rem;
  background: var(--lt-green);
  color: var(--dk-green);
  border-radius: 4px;
  padding: 1px 6px;
  font-weight: 600;
}
.pb-row-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
.btn-danger-mini {
  background: #fee2e2;
  color: #dc2626;
  border: none;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 0.75rem;
  cursor: pointer;
  font-weight: 600;
}
.btn-danger-mini:hover { background: #fca5a5; }

/* Section header with multiple action buttons */
.section-header-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}
```

- [ ] **Step 2: Verify all styles**

Open `http://localhost:8000` and check:
- Shopping list: price row renders cleanly below item name; "R 70.00 · R140/kg" is readable; "+ Set price" dashed button is subtle; inline edit form fits on one line (or wraps neatly on mobile)
- Running total: green pill at bottom of the list with bold R amount
- Shopping list header: "Price Book" and "Clear checked" buttons are side-by-side without overflow
- Price Book view: rows have ingredient name + price + optional retailer badge; Edit/✕ buttons on the right
- Price Book search bar is consistent with other search bars

- [ ] **Step 3: Commit**

```bash
git add css/style.css
git commit -m "feat(styles): add price display, inline edit form, running total, and price book list styles"
```

---

## Self-Review

### Spec coverage check

| Requirement | Task |
|---|---|
| `priceBook` in `_db`, CRUD methods | Task 1 |
| Unit-normalised `lookupPrice` | Task 1 |
| ~60 SA starter prices | Task 1 |
| Shopping list inline price display | Task 2 |
| Inline edit form (price, unit, retailer) | Task 2 |
| Running total on shopping list | Task 2 |
| Price Book full-screen view | Task 3 |
| Search/filter in Price Book | Task 3 |
| Price Book accessible from Settings | Task 3 |
| Price Book accessible from shopping list | Task 3 |
| Planner summary cost section (day-by-day) | Task 4 |
| Planner summary treats cost | Task 4 |
| Partial cost (~) handling | Task 4 |
| CSS for all new elements | Task 5 |

All requirements covered. No gaps.

### Placeholder scan

No TBDs, TODOs, "implement later", or "handle edge cases" without code. All steps contain complete code.

### Type consistency

- `_calcRecipeCost` returns `{ cost, partial }` — used consistently in Task 4
- `Data.setPriceEntry(entry, idx)` — `idx` is `undefined` (append/upsert) or a number (update by index) — used consistently in Task 1, 2, 3
- `Data.lookupPriceEntry(name)` returns the entry object or `null` — used in Task 2's `_renderPriceDisplay`
- `Data.lookupPrice(name, qty, unit)` returns a number or `null` — used in Task 2's `_renderTotal` and Task 4
- `PriceBook.saveForm(idx)` receives `null` (add) or a number (edit) — `idx !== null ? idx : undefined` passed to `setPriceEntry` consistently
