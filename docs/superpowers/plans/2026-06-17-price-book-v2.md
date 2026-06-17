# Price Book v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the flat price book to a nested structure that supports multiple price/unit entries per ingredient and multiple retailer prices per unit, with an ingredient-card UI.

**Architecture:** Four files change — `data.js` gets a new nested priceBook API and migration guard, `prices.js` is fully rewritten to render ingredient cards, `shopping.js` updates its `setPriceEntry` call and display logic, and `css/style.css` replaces flat-row styles with card styles. `index.html` needs one button handler renamed.

**Tech Stack:** Vanilla JS (IIFE modules), localStorage, no build step — open `http://localhost:8000` to test in browser.

---

## File Map

| File | Change type | What changes |
|---|---|---|
| `js/data.js` | Modify | Migration guard in `load()`, rewrite `setPriceEntry` / `removePriceEntry` / `lookupPriceEntry` / `lookupPrice`, add `removeIngredient`, rewrite `loadStarterPrices` to nested format, add `removeIngredient` to exports |
| `js/prices.js` | Full rewrite | Ingredient card render, `openAddIngredientForm`, `saveNewIngredient`, `openAddPriceForm`, `openEditPriceForm`, `savePrice`, `removePrice`, `removeIngredient`, module-level `_modalIngredientName`/`_modalPriceIdx` state |
| `css/style.css` | Modify | Replace `.pb-row` family with `.pb-card` family (lines 682–733); keep `.btn-danger-mini` and `.section-header-actions` |
| `index.html` | Modify | Rename button onclick from `PriceBook.openAddForm()` to `PriceBook.openAddIngredientForm()` (line 141) |
| `js/shopping.js` | Modify | `savePrice`: new `Data.setPriceEntry` call signature; `editPrice`: pre-fill from card; `_renderPriceDisplay`: "avg" label logic |

---

## Task 1: Update `js/data.js` — nested priceBook model

**Files:**
- Modify: `js/data.js`

- [ ] **Step 1: Add migration guard to `load()`**

In `load()`, after the existing `if (!_db.priceBook) _db.priceBook = [];` line (currently line 33), add the migration block:

```js
// Migrate v1 flat priceBook to v2 nested format
if (_db.priceBook.length > 0 && _db.priceBook[0].unit !== undefined) {
  _db.priceBook = [];
  loadStarterPrices();
}
```

The guard checks for `unit` at the top level of the first entry — that only exists in the v1 flat format.

- [ ] **Step 2: Replace `setPriceEntry`**

Replace the existing `setPriceEntry(entry)` function (lines 143–150) with:

```js
function setPriceEntry(ingredientName, priceEntry) {
  if (!_db.priceBook) _db.priceBook = [];
  const name = (ingredientName || '').toLowerCase().trim();
  let card = _db.priceBook.find(c => c.ingredient.toLowerCase() === name);
  if (!card) {
    card = { ingredient: name, prices: [] };
    _db.priceBook.push(card);
  }
  const entry = {
    unit: priceEntry.unit,
    pricePerUnit: priceEntry.pricePerUnit,
    retailer: (priceEntry.retailer || '').trim(),
    updatedDate: new Date().toISOString().slice(0, 10),
  };
  const rowIdx = card.prices.findIndex(
    p => p.unit === entry.unit && p.retailer.toLowerCase() === entry.retailer.toLowerCase()
  );
  if (rowIdx >= 0) card.prices[rowIdx] = entry;
  else card.prices.push(entry);
  save();
}
```

- [ ] **Step 3: Replace `removePriceEntry`**

Replace the existing `removePriceEntry(idx)` function (lines 153–157) with:

```js
function removePriceEntry(ingredientName, priceIdx) {
  if (!_db.priceBook) return;
  const name = (ingredientName || '').toLowerCase().trim();
  const cardIdx = _db.priceBook.findIndex(c => c.ingredient.toLowerCase() === name);
  if (cardIdx < 0) return;
  const card = _db.priceBook[cardIdx];
  if (priceIdx < 0 || priceIdx >= card.prices.length) return;
  card.prices.splice(priceIdx, 1);
  if (card.prices.length === 0) _db.priceBook.splice(cardIdx, 1);
  save();
}
```

- [ ] **Step 4: Add `removeIngredient`**

After `removePriceEntry`, add the new function:

```js
function removeIngredient(ingredientIdx) {
  if (!_db.priceBook || ingredientIdx < 0 || ingredientIdx >= _db.priceBook.length) return;
  _db.priceBook.splice(ingredientIdx, 1);
  save();
}
```

- [ ] **Step 5: Update `lookupPriceEntry`**

Replace the existing `lookupPriceEntry(name)` function (lines 159–165) with the same logic but now returns a card object `{ ingredient, prices }`:

```js
function lookupPriceEntry(name) {
  const lower = (name || '').toLowerCase().trim();
  const book = _db.priceBook || [];
  const exact = book.find(c => lower === c.ingredient.toLowerCase());
  if (exact) return exact;
  return book.find(c => lower.includes(c.ingredient.toLowerCase())) || null;
}
```

(The function body is identical to v1, but the returned object now has the nested shape.)

- [ ] **Step 6: Replace `lookupPrice`**

Replace the existing `lookupPrice(name, qty, unit)` function (lines 167–176) with the averaging version:

```js
function lookupPrice(name, qty, unit) {
  const card = lookupPriceEntry(name);
  if (!card) return null;
  const parsedQty = parseFloat(qty) || 0;
  if (parsedQty === 0) return 0;
  const [baseQty, baseType] = _normalizeToBase(parsedQty, unit || '');
  const compatible = card.prices
    .map(p => _pricePerBase(p.pricePerUnit, p.unit))
    .filter(([, t]) => t === baseType)
    .map(([ppb]) => ppb);
  if (compatible.length === 0) return null;
  const avg = compatible.reduce((a, b) => a + b, 0) / compatible.length;
  return Math.round(baseQty * avg * 100) / 100;
}
```

- [ ] **Step 7: Rewrite `loadStarterPrices` to nested format**

Replace the existing `loadStarterPrices()` function (lines 413–493) with the nested-format version. Each flat entry becomes a card with one price row:

```js
function loadStarterPrices() {
  if (_db.priceBook && _db.priceBook.length > 0) return;
  const d = '2026-06-17';
  const flat = [
    // Produce
    { ingredient: 'onion',         unit: 'kg',   pricePerUnit: 20  },
    { ingredient: 'garlic',        unit: 'item', pricePerUnit: 4   },
    { ingredient: 'tomato',        unit: 'kg',   pricePerUnit: 35  },
    { ingredient: 'potato',        unit: 'kg',   pricePerUnit: 22  },
    { ingredient: 'carrot',        unit: 'kg',   pricePerUnit: 22  },
    { ingredient: 'capsicum',      unit: 'kg',   pricePerUnit: 55  },
    { ingredient: 'cucumber',      unit: 'item', pricePerUnit: 12  },
    { ingredient: 'spinach',       unit: 'kg',   pricePerUnit: 35  },
    { ingredient: 'mushroom',      unit: 'kg',   pricePerUnit: 80  },
    { ingredient: 'broccoli',      unit: 'kg',   pricePerUnit: 50  },
    { ingredient: 'avocado',       unit: 'item', pricePerUnit: 18  },
    { ingredient: 'lemon',         unit: 'item', pricePerUnit: 8   },
    { ingredient: 'lime',          unit: 'item', pricePerUnit: 6   },
    { ingredient: 'banana',        unit: 'kg',   pricePerUnit: 22  },
    { ingredient: 'apple',         unit: 'kg',   pricePerUnit: 38  },
    { ingredient: 'orange',        unit: 'kg',   pricePerUnit: 28  },
    { ingredient: 'ginger',        unit: '100g', pricePerUnit: 12  },
    { ingredient: 'chilli',        unit: '100g', pricePerUnit: 15  },
    { ingredient: 'spring onion',  unit: 'item', pricePerUnit: 6   },
    { ingredient: 'sweet potato',  unit: 'kg',   pricePerUnit: 28  },
    // Meat
    { ingredient: 'beef mince',    unit: 'kg',   pricePerUnit: 140 },
    { ingredient: 'chicken breast',unit: 'kg',   pricePerUnit: 95  },
    { ingredient: 'chicken thigh', unit: 'kg',   pricePerUnit: 70  },
    { ingredient: 'chicken',       unit: 'kg',   pricePerUnit: 80  },
    { ingredient: 'pork',          unit: 'kg',   pricePerUnit: 110 },
    { ingredient: 'lamb',          unit: 'kg',   pricePerUnit: 190 },
    { ingredient: 'rump steak',    unit: 'kg',   pricePerUnit: 200 },
    { ingredient: 'beef fillet',   unit: 'kg',   pricePerUnit: 420 },
    { ingredient: 'bacon',         unit: 'kg',   pricePerUnit: 130 },
    { ingredient: 'sausage',       unit: 'kg',   pricePerUnit: 90  },
    { ingredient: 'salmon',        unit: 'kg',   pricePerUnit: 280 },
    { ingredient: 'tuna',          unit: '100g', pricePerUnit: 15  },
    // Dairy
    { ingredient: 'milk',          unit: 'l',    pricePerUnit: 26  },
    { ingredient: 'cream',         unit: '100ml',pricePerUnit: 16  },
    { ingredient: 'butter',        unit: '100g', pricePerUnit: 18  },
    { ingredient: 'cheddar',       unit: '100g', pricePerUnit: 28  },
    { ingredient: 'feta',          unit: '100g', pricePerUnit: 22  },
    { ingredient: 'mozzarella',    unit: '100g', pricePerUnit: 25  },
    { ingredient: 'parmesan',      unit: '100g', pricePerUnit: 55  },
    { ingredient: 'yogurt',        unit: 'kg',   pricePerUnit: 65  },
    { ingredient: 'egg',           unit: 'item', pricePerUnit: 4   },
    { ingredient: 'sour cream',    unit: '100g', pricePerUnit: 12  },
    // Pantry
    { ingredient: 'olive oil',     unit: '100ml',pricePerUnit: 18  },
    { ingredient: 'sunflower oil', unit: 'l',    pricePerUnit: 25  },
    { ingredient: 'coconut oil',   unit: '100ml',pricePerUnit: 22  },
    { ingredient: 'flour',         unit: 'kg',   pricePerUnit: 16  },
    { ingredient: 'sugar',         unit: 'kg',   pricePerUnit: 18  },
    { ingredient: 'rice',          unit: 'kg',   pricePerUnit: 18  },
    { ingredient: 'pasta',         unit: 'kg',   pricePerUnit: 28  },
    { ingredient: 'spaghetti',     unit: 'kg',   pricePerUnit: 28  },
    { ingredient: 'oats',          unit: 'kg',   pricePerUnit: 38  },
    { ingredient: 'bread',         unit: 'item', pricePerUnit: 22  },
    { ingredient: 'honey',         unit: '100g', pricePerUnit: 16  },
    { ingredient: 'soy sauce',     unit: '100ml',pricePerUnit: 12  },
    { ingredient: 'tomato paste',  unit: '100g', pricePerUnit: 10  },
    { ingredient: 'tinned tomato', unit: '100g', pricePerUnit: 5   },
    { ingredient: 'coconut milk',  unit: '100ml',pricePerUnit: 8   },
    { ingredient: 'stock',         unit: 'item', pricePerUnit: 8   },
    { ingredient: 'vinegar',       unit: '100ml',pricePerUnit: 4   },
    // Spices
    { ingredient: 'cumin',         unit: '100g', pricePerUnit: 38  },
    { ingredient: 'paprika',       unit: '100g', pricePerUnit: 32  },
    { ingredient: 'turmeric',      unit: '100g', pricePerUnit: 30  },
    { ingredient: 'cinnamon',      unit: '100g', pricePerUnit: 35  },
    { ingredient: 'curry powder',  unit: '100g', pricePerUnit: 42  },
    { ingredient: 'garam masala',  unit: '100g', pricePerUnit: 45  },
    { ingredient: 'black pepper',  unit: '100g', pricePerUnit: 42  },
    { ingredient: 'cayenne',       unit: '100g', pricePerUnit: 38  },
    { ingredient: 'oregano',       unit: '100g', pricePerUnit: 32  },
    { ingredient: 'thyme',         unit: '100g', pricePerUnit: 32  },
  ];
  _db.priceBook = flat.map(f => ({
    ingredient: f.ingredient,
    prices: [{ unit: f.unit, pricePerUnit: f.pricePerUnit, retailer: '', updatedDate: d }],
  }));
  save();
}
```

- [ ] **Step 8: Add `removeIngredient` to the exports**

In the `return { ... }` at the bottom of data.js (currently line 495–504), add `removeIngredient` to the price book exports:

```js
return {
  load, save, getRecipes, getPlan, getPantry, getShoppingList,
  addRecipe, updateRecipe, deleteRecipe, getRecipeById,
  setMealSlot, setShoppingList, setTreats, setRecipeCalories, toggleShoppingItem,
  isDriveConnected, connectDrive, disconnectDrive, syncDrive,
  exportJSON, importJSON, handleImportFile, clearAll,
  loadStarterData, loadStarterPrices, getClientId, setClientId,
  getPriceBook, setPriceEntry, removePriceEntry, removeIngredient,
  lookupPriceEntry, lookupPrice,
  DAYS, MEALS,
};
```

- [ ] **Step 9: Verify in browser**

Start the dev server (`python -m http.server 8000` from the `pwa/` directory), open `http://localhost:8000`, open DevTools console:

```js
// Test nested format
Data.setPriceEntry('test item', { unit: 'kg', pricePerUnit: 99, retailer: 'Checkers' });
console.log(Data.getPriceBook().find(c => c.ingredient === 'test item'));
// Expected: { ingredient: 'test item', prices: [{ unit: 'kg', pricePerUnit: 99, retailer: 'Checkers', updatedDate: '...' }] }

// Test second price row (same ingredient, different unit)
Data.setPriceEntry('test item', { unit: 'item', pricePerUnit: 5, retailer: '' });
console.log(Data.getPriceBook().find(c => c.ingredient === 'test item').prices.length);
// Expected: 2

// Test averaging
console.log(Data.lookupPrice('test item', 500, 'g'));  // Expected: a number (500 * (99/1000))
// Expected: 49.5

// Test upsert by unit+retailer (should NOT add duplicate)
Data.setPriceEntry('test item', { unit: 'kg', pricePerUnit: 100, retailer: 'Checkers' });
console.log(Data.getPriceBook().find(c => c.ingredient === 'test item').prices.length);
// Expected: still 2 (updated, not duplicated)

// Test remove price row
Data.removePriceEntry('test item', 0);
console.log(Data.getPriceBook().find(c => c.ingredient === 'test item').prices.length);
// Expected: 1

// Test remove last row removes card
Data.removePriceEntry('test item', 0);
console.log(Data.getPriceBook().find(c => c.ingredient === 'test item'));
// Expected: undefined (card removed)
```

- [ ] **Step 10: Verify migration guard**

In DevTools console, manually set a v1 flat price book to test the migration:

```js
// Simulate v1 data in localStorage
const raw = JSON.parse(localStorage.getItem('recipebook_db'));
raw.priceBook = [{ ingredient: 'onion', unit: 'kg', pricePerUnit: 20, retailer: '', updatedDate: '2026-06-01' }];
localStorage.setItem('recipebook_db', JSON.stringify(raw));
// Reload the page — after reload the migration should fire
// Then check:
console.log(Data.getPriceBook()[0]);
// Expected: { ingredient: 'onion', prices: [{ unit: 'kg', ... }] }  (nested, not flat)
```

- [ ] **Step 11: Commit**

```bash
git add js/data.js
git commit -m "feat(data): nested priceBook model with multi-retailer support"
```

---

## Task 2: Update `css/style.css` — card-based price book styles

**Files:**
- Modify: `css/style.css` (lines 682–733)

- [ ] **Step 1: Replace old flat-row price book styles with card styles**

Find and replace the entire block starting at `/* ── Price Book view ─────────────────────────────────── */` (line 682) through `.btn-danger-mini:hover { background: #fca5a5; }` (line 733). Keep `.btn-danger-mini` — the card UI still needs it. Replace the old `.pb-row` family only.

Replace lines 682–733 with:

```css
/* ── Price Book view ─────────────────────────────────── */
.pb-card {
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 10px;
  margin-bottom: 10px;
  overflow: hidden;
}
.pb-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: var(--lt-green);
  gap: 8px;
  flex-wrap: wrap;
}
.pb-card-name {
  font-weight: 700;
  font-size: 0.9rem;
  text-transform: capitalize;
  color: var(--dk-green);
}
.pb-card-actions {
  display: flex;
  gap: 6px;
}
.pb-price-rows {
  padding: 0 12px;
}
.pb-price-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
  gap: 8px;
}
.pb-price-row:last-child { border-bottom: none; }
.pb-price-row-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  flex-wrap: wrap;
  flex: 1;
}
.pb-price-val {
  font-weight: 600;
  color: var(--md-green);
}
.pb-retailer-tag {
  font-size: 0.72rem;
  background: var(--lt-green);
  color: var(--dk-green);
  border-radius: 4px;
  padding: 1px 6px;
  font-weight: 600;
}
.pb-price-date {
  font-size: 0.72rem;
  color: var(--text-muted);
  opacity: 0.7;
}
.pb-price-row-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
.pb-add-ingredient-btn {
  width: 100%;
  margin-top: 8px;
  padding: 12px;
  background: none;
  border: 2px dashed #ccc;
  border-radius: 10px;
  font-size: 0.9rem;
  color: var(--text-muted);
  cursor: pointer;
  text-align: center;
  box-sizing: border-box;
}
.pb-add-ingredient-btn:hover {
  border-color: var(--md-green);
  color: var(--md-green);
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
```

- [ ] **Step 2: Verify CSS compiles (no errors in DevTools)**

Reload `http://localhost:8000` and check the DevTools console for CSS errors. None expected.

- [ ] **Step 3: Commit**

```bash
git add css/style.css
git commit -m "feat(css): replace flat pb-row styles with ingredient card styles"
```

---

## Task 3: Rewrite `js/prices.js` — ingredient card UI

**Files:**
- Modify: `js/prices.js` (full rewrite)

- [ ] **Step 1: Replace entire file content**

Write the complete new `prices.js`:

```js
/* ══════════════════════════════════════
   prices.js — Price Book management view
   ══════════════════════════════════════ */

const PriceBook = (() => {
  let _filter = '';
  let _modalIngredientName = '';
  let _modalPriceIdx = null;

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

    el.innerHTML = filtered.map(card => {
      const realIdx = entries.indexOf(card);
      const priceRows = card.prices.map((p, pIdx) => {
        const retailerHtml = p.retailer
          ? `<span class="pb-retailer-tag">${_esc(p.retailer)}</span>` : '';
        return `
          <div class="pb-price-row">
            <div class="pb-price-row-info">
              <span class="pb-price-val">R ${p.pricePerUnit.toFixed(2)}/${p.unit}</span>
              ${retailerHtml}
              <span class="pb-price-date">${_fmtDate(p.updatedDate)}</span>
            </div>
            <div class="pb-price-row-actions">
              <button class="btn-mini" onclick="PriceBook.openEditPriceForm(${realIdx}, ${pIdx})">Edit</button>
              <button class="btn-mini btn-danger-mini" onclick="PriceBook.removePrice(${realIdx}, ${pIdx})">✕</button>
            </div>
          </div>`;
      }).join('');
      return `
        <div class="pb-card">
          <div class="pb-card-header">
            <span class="pb-card-name">${_esc(card.ingredient)}</span>
            <div class="pb-card-actions">
              <button class="btn-mini" onclick="PriceBook.openAddPriceForm(${realIdx})">＋ Add price</button>
              <button class="btn-mini btn-danger-mini" onclick="PriceBook.removeIngredient(${realIdx})">✕ Remove</button>
            </div>
          </div>
          <div class="pb-price-rows">${priceRows}</div>
        </div>`;
    }).join('') + `<button class="pb-add-ingredient-btn" onclick="PriceBook.openAddIngredientForm()">＋ Add ingredient</button>`;
  }

  function filter() {
    _filter = (document.getElementById('pb-search')?.value || '').trim();
    render();
  }

  function openAddIngredientForm() {
    _modalIngredientName = '';
    _modalPriceIdx = null;
    const unitOpts = UNITS.map(u =>
      `<option value="${u}" ${u === 'item' ? 'selected' : ''}>${u}</option>`
    ).join('');
    document.getElementById('modal-content').innerHTML = `
      <h3>Add Ingredient</h3>
      <div class="form-group">
        <label>Ingredient</label>
        <input id="pb-form-ing" type="text" placeholder="e.g. beef mince" autofocus />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Price (R)</label>
          <input id="pb-form-price" type="number" step="0.01" min="0" placeholder="0.00" />
        </div>
        <div class="form-group">
          <label>Per</label>
          <select id="pb-form-unit">${unitOpts}</select>
        </div>
      </div>
      <div class="form-group">
        <label>Retailer (optional)</label>
        <input id="pb-form-retailer" type="text" placeholder="e.g. Checkers" maxlength="30" />
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn-primary" onclick="PriceBook.saveNewIngredient()">Save</button>
      </div>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
  }

  function saveNewIngredient() {
    const ingredient = (document.getElementById('pb-form-ing')?.value || '').trim().toLowerCase();
    const price = parseFloat(document.getElementById('pb-form-price')?.value);
    const unit = document.getElementById('pb-form-unit')?.value || 'item';
    const retailer = (document.getElementById('pb-form-retailer')?.value || '').trim();
    if (!ingredient) { App.toast('Enter an ingredient name', 'warn'); return; }
    if (isNaN(price) || price < 0) { App.toast('Enter a valid price', 'warn'); return; }
    Data.setPriceEntry(ingredient, { unit, pricePerUnit: price, retailer });
    App.closeModal();
    render();
    App.toast('Ingredient added ✓');
  }

  function openAddPriceForm(ingredientIdx) {
    const entries = Data.getPriceBook();
    const card = entries[ingredientIdx];
    if (!card) return;
    _modalIngredientName = card.ingredient;
    _modalPriceIdx = null;
    const unitOpts = UNITS.map(u =>
      `<option value="${u}" ${u === 'item' ? 'selected' : ''}>${u}</option>`
    ).join('');
    document.getElementById('modal-content').innerHTML = `
      <h3>Add Price — <span style="text-transform:capitalize">${_esc(card.ingredient)}</span></h3>
      <div class="form-row">
        <div class="form-group">
          <label>Price (R)</label>
          <input id="pb-form-price" type="number" step="0.01" min="0" placeholder="0.00" autofocus />
        </div>
        <div class="form-group">
          <label>Per</label>
          <select id="pb-form-unit">${unitOpts}</select>
        </div>
      </div>
      <div class="form-group">
        <label>Retailer (optional)</label>
        <input id="pb-form-retailer" type="text" placeholder="e.g. Checkers" maxlength="30" />
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn-primary" onclick="PriceBook.savePrice()">Save</button>
      </div>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
  }

  function openEditPriceForm(ingredientIdx, priceIdx) {
    const entries = Data.getPriceBook();
    const card = entries[ingredientIdx];
    if (!card) return;
    const p = card.prices[priceIdx];
    if (!p) return;
    _modalIngredientName = card.ingredient;
    _modalPriceIdx = priceIdx;
    const unitOpts = UNITS.map(u =>
      `<option value="${u}" ${p.unit === u ? 'selected' : ''}>${u}</option>`
    ).join('');
    document.getElementById('modal-content').innerHTML = `
      <h3>Edit Price — <span style="text-transform:capitalize">${_esc(card.ingredient)}</span></h3>
      <div class="form-row">
        <div class="form-group">
          <label>Price (R)</label>
          <input id="pb-form-price" type="number" step="0.01" min="0"
            value="${p.pricePerUnit}" autofocus />
        </div>
        <div class="form-group">
          <label>Per</label>
          <select id="pb-form-unit">${unitOpts}</select>
        </div>
      </div>
      <div class="form-group">
        <label>Retailer (optional)</label>
        <input id="pb-form-retailer" type="text" value="${_esc(p.retailer || '')}" maxlength="30" />
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn-primary" onclick="PriceBook.savePrice()">Save</button>
      </div>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
  }

  function savePrice() {
    const price = parseFloat(document.getElementById('pb-form-price')?.value);
    const unit = document.getElementById('pb-form-unit')?.value || 'item';
    const retailer = (document.getElementById('pb-form-retailer')?.value || '').trim();
    if (isNaN(price) || price < 0) { App.toast('Enter a valid price', 'warn'); return; }
    if (_modalPriceIdx !== null) {
      Data.removePriceEntry(_modalIngredientName, _modalPriceIdx);
    }
    Data.setPriceEntry(_modalIngredientName, { unit, pricePerUnit: price, retailer });
    App.closeModal();
    render();
    App.toast('Price saved ✓');
  }

  function removePrice(ingredientIdx, priceIdx) {
    if (!confirm('Remove this price row?')) return;
    const entries = Data.getPriceBook();
    const card = entries[ingredientIdx];
    if (!card) return;
    Data.removePriceEntry(card.ingredient, priceIdx);
    render();
    App.toast('Removed');
  }

  function removeIngredient(ingredientIdx) {
    if (!confirm('Remove this ingredient and all its prices?')) return;
    Data.removeIngredient(ingredientIdx);
    render();
    App.toast('Removed');
  }

  function _fmtDate(dateStr) {
    if (!dateStr) return '';
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    return months[parseInt(parts[1], 10) - 1] + ' ' + parseInt(parts[2], 10);
  }

  function _esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { render, filter, openAddIngredientForm, saveNewIngredient, openAddPriceForm, openEditPriceForm, savePrice, removePrice, removeIngredient };
})();
```

- [ ] **Step 2: Verify Price Book view in browser**

Navigate to Price Book (Settings → Manage Price Book or shopping list header → Price Book button):
- Each ingredient should render as a card with a green header
- Each card should show its price row(s) with amount/unit/retailer/date
- "＋ Add price" button on each card header opens a modal (ingredient shown in title, no name field)
- "✕ Remove" button on each card header prompts confirm and removes whole card
- "Edit" button on each price row opens modal pre-filled with that row's values
- "✕" on a price row removes just that row (if last row, removes whole card)
- "＋ Add ingredient" button at the bottom opens the full add modal
- Search box filters cards by ingredient name
- After adding a price to an existing ingredient: the card shows 2 price rows

- [ ] **Step 3: Commit**

```bash
git add js/prices.js
git commit -m "feat(prices): ingredient card UI with per-row edit and multi-retailer support"
```

---

## Task 4: Update `index.html` — rename button handler

**Files:**
- Modify: `index.html` (line 141)

- [ ] **Step 1: Update the ＋ Add button onclick**

Find line 141:
```html
        <button class="btn-small" onclick="PriceBook.openAddForm()">＋ Add</button>
```

Replace with:
```html
        <button class="btn-small" onclick="PriceBook.openAddIngredientForm()">＋ Add</button>
```

- [ ] **Step 2: Verify**

Reload browser, navigate to Price Book, click "＋ Add" in the section header — the Add Ingredient modal should open (with ingredient name field).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "fix(html): update PriceBook add button to openAddIngredientForm"
```

---

## Task 5: Update `js/shopping.js` — new API signature and display

**Files:**
- Modify: `js/shopping.js`

- [ ] **Step 1: Update `savePrice` to use new API signature**

Find the current `savePrice(idx)` function body (lines 111–128). The only change is the `Data.setPriceEntry` call. Replace lines 119–125 (the setPriceEntry call):

Old:
```js
    Data.setPriceEntry({
      ingredient: item.name.toLowerCase().trim(),
      unit,
      pricePerUnit: price,
      retailer,
      updatedDate: new Date().toISOString().slice(0, 10),
    });
```

New:
```js
    Data.setPriceEntry(item.name.toLowerCase().trim(), { unit, pricePerUnit: price, retailer });
```

- [ ] **Step 2: Update `editPrice` to read from nested card**

The `editPrice(idx)` function pre-fills the inline form. It currently reads `entry.unit`, `entry.pricePerUnit`, `entry.retailer` from the flat entry. With the new structure, `lookupPriceEntry` returns a card `{ ingredient, prices }`.

Replace the existing `editPrice(idx)` function (lines 85–109) with:

```js
  function editPrice(idx) {
    const items = Data.getShoppingList();
    const item = items[idx];
    if (!item) return;
    const card = Data.lookupPriceEntry(item.name);
    const firstPrice = (card && card.prices && card.prices.length > 0) ? card.prices[0] : null;
    const units = ['g','100g','kg','ml','100ml','l','item','tsp','tbsp'];
    const unitOpts = units.map(u =>
      `<option value="${u}" ${(firstPrice ? firstPrice.unit : 'item') === u ? 'selected' : ''}>${u}</option>`
    ).join('');
    const priceEl = document.getElementById('shop-price-' + idx);
    if (!priceEl) return;
    priceEl.innerHTML = `
      <div class="shop-price-form">
        <span class="shop-pf-label">R</span>
        <input type="number" id="sp-price-${idx}" class="shop-pf-input"
          step="0.01" min="0" value="${firstPrice ? firstPrice.pricePerUnit : ''}" placeholder="0.00" />
        <span class="shop-pf-sep">per</span>
        <select id="sp-unit-${idx}" class="shop-pf-unit">${unitOpts}</select>
        <input type="text" id="sp-retailer-${idx}" class="shop-pf-retailer"
          value="${_esc(firstPrice ? (firstPrice.retailer || '') : '')}" placeholder="Store" maxlength="20" />
        <button class="btn-mini btn-mini-primary" onclick="Shopping.savePrice(${idx})">Save</button>
        <button class="btn-mini" onclick="Shopping.render()">✕</button>
      </div>`;
    document.getElementById('sp-price-' + idx)?.focus();
  }
```

- [ ] **Step 3: Update `_renderPriceDisplay` to read from nested card and show "avg" label**

Replace the current `_renderPriceDisplay(idx, item)` function (lines 67–83) with:

```js
  function _renderPriceDisplay(idx, item) {
    const card = Data.lookupPriceEntry(item.name);
    if (!card || !card.prices || card.prices.length === 0) {
      return `<div class="shop-price-display" id="shop-price-${idx}">
        <button class="shop-price-set" onclick="Shopping.editPrice(${idx})">+ Set price</button>
      </div>`;
    }
    const cost = Data.lookupPrice(item.name, item.qty, item.unit);
    const costHtml = cost != null
      ? `<span class="shop-price-cost">R ${cost.toFixed(2)}</span><span class="shop-price-sep">·</span>`
      : '';
    // Show "avg" when multiple prices exist, else show single price with retailer
    let perHtml;
    if (card.prices.length > 1) {
      // If all rows share the same unit, compute and display a true numeric average
      const uniqueUnits = [...new Set(card.prices.map(p => p.unit))];
      if (uniqueUnits.length === 1) {
        const avgPrice = card.prices.reduce((s, p) => s + p.pricePerUnit, 0) / card.prices.length;
        perHtml = `<span class="shop-price-per">avg R ${avgPrice.toFixed(2)}/${uniqueUnits[0]}</span>`;
      } else {
        perHtml = `<span class="shop-price-per">avg (${card.prices.length} prices)</span>`;
      }
    } else {
      const p = card.prices[0];
      const retailerHtml = p.retailer
        ? ` <span class="shop-price-retailer-tag">${_esc(p.retailer)}</span>` : '';
      perHtml = `<span class="shop-price-per">R ${p.pricePerUnit.toFixed(2)}/${p.unit}</span>${retailerHtml}`;
    }
    return `<div class="shop-price-display" id="shop-price-${idx}">
      ${costHtml}${perHtml}
      <button class="shop-price-edit-btn" onclick="Shopping.editPrice(${idx})" title="Edit price">✏</button>
    </div>`;
  }
```

- [ ] **Step 4: Verify shopping list in browser**

Add the starter recipes to the meal planner and generate a shopping list. Check:
- Items with a price entry show cost + per-unit + retailer (or "avg" for multi-price ingredients)
- "+ Set price" shows for unpriced items
- Clicking "✏" opens the inline edit form pre-filled with the first price row
- Saving the inline form calls `Data.setPriceEntry` with the new signature — verify in DevTools: `Data.getPriceBook().find(c => c.ingredient.includes('onion'))` should still be a card with `prices` array
- Running total still appears when items are priced

- [ ] **Step 5: Commit**

```bash
git add js/shopping.js
git commit -m "fix(shopping): update to nested priceBook API and avg label for multi-price items"
```

---

## Self-Review Checklist (run before pushing)

- [ ] All 5 tasks committed — verify with `git log --oneline -5`
- [ ] No old flat `entry.unit` / `entry.pricePerUnit` reads outside of `prices` array context (grep: `entry\.unit` in shopping.js and planner.js)
- [ ] `Data.removePriceEntry` called with `(ingredientName, priceIdx)` everywhere — NOT the old `(idx)` signature
- [ ] `Data.setPriceEntry` called with `(ingredientName, { unit, pricePerUnit, retailer })` everywhere — NOT the old single-object form
- [ ] Push to remote: `git push origin main`
