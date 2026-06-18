# Sub-project C: Unit Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add counting and pack-based units to pantry and price book forms, with optional gram-equivalent fields enabling cross-unit pantry coverage checking and price estimation.

**Architecture:** Four tasks. Task 1 extends the data API (conversion functions + storage). Tasks 2 and 3 update pantry and price book forms independently. Task 4 updates shopping list pantry matching to use cross-unit comparison via the newly exported `Data.normalizeToBase`. No new files needed.

**Tech Stack:** Vanilla JS IIFE modules, localStorage, `innerHTML` rendering. No framework, no bundler, no test suite.

---

### Task 1: Extend conversion functions and data API (`js/data.js`)

**Files:**
- Modify: `js/data.js`

**Context:**
- `_normalizeToBase(qty, unit)` — lines 174–186. Converts qty+unit to a base `[qty, 'g'|'ml'|'item']` tuple. Currently private (underscore prefix, not exported).
- `_pricePerBase(pricePerUnit, pbUnit)` — lines 188–199. Converts price-per-unit to price-per-base-unit. Called only from `lookupPrice`.
- `lookupPrice(name, qty, unit)` — lines 268–281. Calls both functions above to compute ingredient cost.
- `setPantryItem(ingredientName, opts)` — lines 54–67. Stores pantry items in `_db.pantry`.
- `setPriceEntry(ingredientName, priceEntry)` — lines 220–240. Stores price entries in `_db.priceBook`.
- Return statement — lines 582–595.

---

- [ ] **Step 1: Rename `_normalizeToBase` to `normalizeToBase` and add new unit cases**

Find (lines 174–186):
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
```

Change to:
```js
function normalizeToBase(qty, unit, gramEquiv) {
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
  if (u === 'clove') return [qty * 5, 'g'];
  if (u === 'dozen') return [qty * 12, 'item'];
  if (['can','packet','loaf','bunch','head'].includes(u) && gramEquiv) return [qty * gramEquiv, 'g'];
  return [qty, 'item'];
}
```

- [ ] **Step 2: Update the internal call to `_normalizeToBase` inside `lookupPrice`**

Find in `lookupPrice` (line ~273):
```js
  const [baseQty, baseType] = _normalizeToBase(parsedQty, unit || '');
```

Change to:
```js
  const [baseQty, baseType] = normalizeToBase(parsedQty, unit || '');
```

- [ ] **Step 3: Extend `_pricePerBase` with new units and `gramEquiv` parameter**

Find (lines 188–199):
```js
function _pricePerBase(pricePerUnit, pbUnit) {
  if (pbUnit === 'g')     return [pricePerUnit, 'g'];
  if (pbUnit === '100g')  return [pricePerUnit / 100, 'g'];
  if (pbUnit === 'kg')    return [pricePerUnit / 1000, 'g'];
  if (pbUnit === 'ml')    return [pricePerUnit, 'ml'];
  if (pbUnit === '100ml') return [pricePerUnit / 100, 'ml'];
  if (pbUnit === 'l')     return [pricePerUnit / 1000, 'ml'];
  if (pbUnit === 'tsp')   return [pricePerUnit / 5, 'ml'];
  if (pbUnit === 'tbsp')  return [pricePerUnit / 15, 'ml'];
  if (pbUnit === 'cup')   return [pricePerUnit / 240, 'ml'];
  return [pricePerUnit, 'item'];
}
```

Change to:
```js
function _pricePerBase(pricePerUnit, pbUnit, gramEquiv) {
  if (pbUnit === 'g')     return [pricePerUnit, 'g'];
  if (pbUnit === '100g')  return [pricePerUnit / 100, 'g'];
  if (pbUnit === 'kg')    return [pricePerUnit / 1000, 'g'];
  if (pbUnit === 'ml')    return [pricePerUnit, 'ml'];
  if (pbUnit === '100ml') return [pricePerUnit / 100, 'ml'];
  if (pbUnit === 'l')     return [pricePerUnit / 1000, 'ml'];
  if (pbUnit === 'tsp')   return [pricePerUnit / 5, 'ml'];
  if (pbUnit === 'tbsp')  return [pricePerUnit / 15, 'ml'];
  if (pbUnit === 'cup')   return [pricePerUnit / 240, 'ml'];
  if (pbUnit === 'clove') return [pricePerUnit / 5, 'g'];
  if (pbUnit === 'dozen') return [pricePerUnit / 12, 'item'];
  if (['can','packet','loaf','bunch','head'].includes(pbUnit) && gramEquiv) return [pricePerUnit / gramEquiv, 'g'];
  return [pricePerUnit, 'item'];
}
```

- [ ] **Step 4: Update `lookupPrice` to pass `gramEquiv` to `_pricePerBase`**

Find in `lookupPrice` (lines ~275–277):
```js
  const compatible = card.prices
    .map(p => _pricePerBase(p.pricePerUnit, p.unit))
    .filter(([, t]) => t === baseType)
    .map(([ppb]) => ppb);
```

Change to:
```js
  const compatible = card.prices
    .map(p => _pricePerBase(p.pricePerUnit, p.unit, p.gramEquiv))
    .filter(([, t]) => t === baseType)
    .map(([ppb]) => ppb);
```

- [ ] **Step 5: Update `setPantryItem` to store `gramEquiv`**

Find (lines 54–67):
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
```

Change to:
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

- [ ] **Step 6: Update `setPriceEntry` to store `gramEquiv`**

Find the `entry` object construction in `setPriceEntry` (lines ~228–233):
```js
  const entry = {
    unit: priceEntry.unit,
    pricePerUnit: priceEntry.pricePerUnit,
    retailer: (priceEntry.retailer || '').trim(),
    updatedDate: new Date().toISOString().slice(0, 10),
  };
```

Change to:
```js
  const entry = {
    unit: priceEntry.unit,
    pricePerUnit: priceEntry.pricePerUnit,
    retailer: (priceEntry.retailer || '').trim(),
    updatedDate: new Date().toISOString().slice(0, 10),
  };
  if (priceEntry.gramEquiv) entry.gramEquiv = parseFloat(priceEntry.gramEquiv);
```

- [ ] **Step 7: Export `normalizeToBase` in the return statement**

Find (lines 582–595):
```js
return {
  load, save, getRecipes, getPlan, getPantry, getShoppingList,
  addRecipe, updateRecipe, deleteRecipe, getRecipeById,
  setMealSlot, setShoppingList, setTreats, setRecipeCalories, toggleShoppingItem,
  isDriveConnected, connectDrive, disconnectDrive, syncDrive,
  exportJSON, importJSON, handleImportFile, clearAll,
  loadStarterData, loadStarterPrices, getClientId, setClientId,
  getPriceBook, setPriceEntry, removePriceEntry, removeIngredient,
  lookupPriceEntry, lookupPrice, ensurePriceBookEntries,
  setPantryItem, removePantryItem, clearPantryPerishables, getPantryItem,
  getSpendLog, logSpend, clearSpendLog,
  DAYS, MEALS,
};
```

Change to:
```js
return {
  load, save, getRecipes, getPlan, getPantry, getShoppingList,
  addRecipe, updateRecipe, deleteRecipe, getRecipeById,
  setMealSlot, setShoppingList, setTreats, setRecipeCalories, toggleShoppingItem,
  isDriveConnected, connectDrive, disconnectDrive, syncDrive,
  exportJSON, importJSON, handleImportFile, clearAll,
  loadStarterData, loadStarterPrices, getClientId, setClientId,
  getPriceBook, setPriceEntry, removePriceEntry, removeIngredient,
  lookupPriceEntry, lookupPrice, ensurePriceBookEntries,
  setPantryItem, removePantryItem, clearPantryPerishables, getPantryItem,
  getSpendLog, logSpend, clearSpendLog,
  normalizeToBase,
  DAYS, MEALS,
};
```

- [ ] **Step 8: Commit**

```bash
git add js/data.js
git commit -m "feat(data): add new units to normalizeToBase/_pricePerBase, export normalizeToBase, store gramEquiv"
```

---

### Task 2: Pantry form — expand units and gramEquiv field (`js/pantry.js`)

**Files:**
- Modify: `js/pantry.js`

**Context:**
- `UNITS` constant — line 9: `['g','100g','kg','ml','100ml','l','item','tsp','tbsp']`
- `openAddForm` — lines 53–82. Renders the "Add to Pantry" modal.
- `openEditForm` — lines 97–125. Renders the "Edit" modal, pre-populated with existing item data.
- `saveNew` — lines 84–95. Reads form values, calls `Data.setPantryItem(ingredient, { qty, unit, perishable })`.
- `save` (edit save) — lines 127–137. Reads form values, calls `Data.setPantryItem(_editingName, { qty, unit, perishable })`.

The gramEquiv input is rendered in the modal HTML but hidden (`style="display:none"`) by default. An `onchange` on the unit `<select>` calls `Pantry.onUnitChange(this)` to show/hide it and update the unit label inline.

Units that show the gramEquiv field: `can`, `packet`, `loaf`, `bunch`, `head`.
Units that do NOT (fixed defaults or no conversion): `clove`, `dozen`, and all others.

---

- [ ] **Step 1: Expand `UNITS` and add `GRAM_EQUIV_UNITS` constant**

Find (line 9):
```js
const UNITS = ['g','100g','kg','ml','100ml','l','item','tsp','tbsp'];
```

Change to:
```js
const UNITS = ['g','100g','kg','ml','100ml','l','item','tsp','tbsp','clove','bunch','head','can','packet','loaf','dozen'];
const GRAM_EQUIV_UNITS = ['can','packet','loaf','bunch','head'];
```

- [ ] **Step 2: Add `onUnitChange` function before `openAddForm`**

Insert after the `GRAM_EQUIV_UNITS` line and before the first function in the file:
```js
  function onUnitChange(selectEl) {
    const val = typeof selectEl === 'string' ? selectEl : selectEl.value;
    const show = GRAM_EQUIV_UNITS.includes(val);
    const group = document.getElementById('pantry-gram-equiv-group');
    const unitLabel = document.getElementById('pantry-gram-equiv-unit');
    if (group) group.style.display = show ? '' : 'none';
    if (unitLabel) unitLabel.textContent = val;
  }
```

- [ ] **Step 3: Update `openAddForm` to include gramEquiv field and unit onchange**

Find (lines 53–82):
```js
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
```

Change to:
```js
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
        <select id="pantry-form-unit" onchange="Pantry.onUnitChange(this)">${unitOpts}</select>
      </div>
    </div>
    <div class="form-group" id="pantry-gram-equiv-group" style="display:none">
      <label>1 <span id="pantry-gram-equiv-unit">unit</span> ≈ <input id="pantry-form-gramequiv" type="number" step="1" min="0" placeholder="e.g. 400" style="width:70px" /> g (optional)</label>
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
```

- [ ] **Step 4: Update `openEditForm` to include gramEquiv field (pre-populated)**

Find (lines 97–125):
```js
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
```

Change to:
```js
function openEditForm(idx) {
  const allItems = Data.getPantry();
  const item = allItems[idx];
  if (!item) return;
  _editingName = item.ingredient;
  const showGramEquiv = GRAM_EQUIV_UNITS.includes(item.unit);
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
        <select id="pantry-form-unit" onchange="Pantry.onUnitChange(this)">${unitOpts}</select>
      </div>
    </div>
    <div class="form-group" id="pantry-gram-equiv-group" style="display:${showGramEquiv ? '' : 'none'}">
      <label>1 <span id="pantry-gram-equiv-unit">${item.unit}</span> ≈ <input id="pantry-form-gramequiv" type="number" step="1" min="0" value="${item.gramEquiv || ''}" placeholder="e.g. 400" style="width:70px" /> g (optional)</label>
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
```

- [ ] **Step 5: Update `saveNew` to read and pass `gramEquiv`**

Find (lines 84–95):
```js
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
```

Change to:
```js
function saveNew() {
  const ingredient = (document.getElementById('pantry-form-ing')?.value || '').trim().toLowerCase();
  const qty = parseFloat(document.getElementById('pantry-form-qty')?.value) || 0;
  const unit = document.getElementById('pantry-form-unit')?.value || 'item';
  const perishable = document.getElementById('pantry-form-perishable')?.checked || false;
  const gramEquiv = document.getElementById('pantry-form-gramequiv')?.value || '';
  if (!ingredient) { App.toast('Enter an ingredient name', 'warn'); return; }
  if (qty < 0) { App.toast('Qty cannot be negative', 'warn'); return; }
  Data.setPantryItem(ingredient, { qty, unit, perishable, gramEquiv });
  App.closeModal();
  render();
  App.toast('Added to pantry ✓');
}
```

- [ ] **Step 6: Update `save` (edit) to read and pass `gramEquiv`**

Find (lines 127–137):
```js
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
```

Change to:
```js
function save() {
  if (!_editingName) { App.toast('No item selected', 'warn'); return; }
  const qty = parseFloat(document.getElementById('pantry-form-qty')?.value) || 0;
  const unit = document.getElementById('pantry-form-unit')?.value || 'item';
  const perishable = document.getElementById('pantry-form-perishable')?.checked || false;
  const gramEquiv = document.getElementById('pantry-form-gramequiv')?.value || '';
  if (qty < 0) { App.toast('Qty cannot be negative', 'warn'); return; }
  Data.setPantryItem(_editingName, { qty, unit, perishable, gramEquiv });
  App.closeModal();
  render();
  App.toast('Pantry updated ✓');
}
```

- [ ] **Step 7: Export `onUnitChange` in the return statement**

Search `js/pantry.js` for `return {` near the bottom of the file. The return statement lists the public API functions. Add `, onUnitChange` before the closing `}`. For example:

```js
  // before
  return { render, openAddForm, saveNew, openEditForm, save, remove, clearPerishables };
  // after
  return { render, openAddForm, saveNew, openEditForm, save, remove, clearPerishables, onUnitChange };
```

The exact set of names already in the return statement does not matter — just append `, onUnitChange` to it.

- [ ] **Step 8: Commit**

```bash
git add js/pantry.js
git commit -m "feat(pantry): expand units, add gramEquiv field for can/packet/loaf/bunch/head"
```

---

### Task 3: Price book form — expand units and gramEquiv field (`js/prices.js`)

**Files:**
- Modify: `js/prices.js`

**Context:**
- `UNITS` constant — line 11: `['g','100g','kg','ml','100ml','l','item','tsp','tbsp']`
- `openAddPriceForm(ingredientIdx)` — lines 138–168. Renders "Add Price" modal.
- `openEditPriceForm(ingredientIdx, priceIdx)` — lines 170–203. Renders "Edit Price" modal, pre-populated with existing price data (`p = card.prices[priceIdx]`).
- `savePrice()` — lines 205–218. Reads form, calls `Data.setPriceEntry(_modalIngredientName, { unit, pricePerUnit, retailer })`.
- Return statement — currently around line 247: `return { render, filter, toggleOrphans, openAddIngredientForm, saveNewIngredient, openAddPriceForm, openEditPriceForm, savePrice, removePrice, removeIngredient };`

Same gramEquiv show/hide pattern as Task 2 but using IDs `pb-gram-equiv-group`, `pb-gram-equiv-unit`, `pb-form-gramequiv` and calling `PriceBook.onUnitChange(this)`.

---

- [ ] **Step 1: Expand `UNITS` and add `GRAM_EQUIV_UNITS` constant**

Find (line 11):
```js
const UNITS = ['g','100g','kg','ml','100ml','l','item','tsp','tbsp'];
```

Change to:
```js
const UNITS = ['g','100g','kg','ml','100ml','l','item','tsp','tbsp','clove','bunch','head','can','packet','loaf','dozen'];
const GRAM_EQUIV_UNITS = ['can','packet','loaf','bunch','head'];
```

- [ ] **Step 2: Add `onUnitChange` function**

Add after the `GRAM_EQUIV_UNITS` line (before `render`):
```js
  function onUnitChange(selectEl) {
    const val = typeof selectEl === 'string' ? selectEl : selectEl.value;
    const show = GRAM_EQUIV_UNITS.includes(val);
    const group = document.getElementById('pb-gram-equiv-group');
    const unitLabel = document.getElementById('pb-gram-equiv-unit');
    if (group) group.style.display = show ? '' : 'none';
    if (unitLabel) unitLabel.textContent = val;
  }
```

- [ ] **Step 3: Update `openAddPriceForm` to include gramEquiv field**

Find (lines 138–168):
```js
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
```

Change to:
```js
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
        <select id="pb-form-unit" onchange="PriceBook.onUnitChange(this)">${unitOpts}</select>
      </div>
    </div>
    <div class="form-group" id="pb-gram-equiv-group" style="display:none">
      <label>1 <span id="pb-gram-equiv-unit">unit</span> ≈ <input id="pb-form-gramequiv" type="number" step="1" min="0" placeholder="e.g. 400" style="width:70px" /> g (optional)</label>
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
```

- [ ] **Step 4: Update `openEditPriceForm` to include gramEquiv field (pre-populated)**

Find (lines 170–203):
```js
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
```

Change to:
```js
function openEditPriceForm(ingredientIdx, priceIdx) {
  const entries = Data.getPriceBook();
  const card = entries[ingredientIdx];
  if (!card) return;
  const p = card.prices[priceIdx];
  if (!p) return;
  _modalIngredientName = card.ingredient;
  _modalPriceIdx = priceIdx;
  const showGramEquiv = GRAM_EQUIV_UNITS.includes(p.unit);
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
        <select id="pb-form-unit" onchange="PriceBook.onUnitChange(this)">${unitOpts}</select>
      </div>
    </div>
    <div class="form-group" id="pb-gram-equiv-group" style="display:${showGramEquiv ? '' : 'none'}">
      <label>1 <span id="pb-gram-equiv-unit">${p.unit}</span> ≈ <input id="pb-form-gramequiv" type="number" step="1" min="0" value="${p.gramEquiv || ''}" placeholder="e.g. 400" style="width:70px" /> g (optional)</label>
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
```

- [ ] **Step 5: Update `savePrice` to read and pass `gramEquiv`**

Find (lines 205–218):
```js
function savePrice() {
  if (!_modalIngredientName) { App.toast('No ingredient selected', 'warn'); return; }
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
```

Change to:
```js
function savePrice() {
  if (!_modalIngredientName) { App.toast('No ingredient selected', 'warn'); return; }
  const price = parseFloat(document.getElementById('pb-form-price')?.value);
  const unit = document.getElementById('pb-form-unit')?.value || 'item';
  const retailer = (document.getElementById('pb-form-retailer')?.value || '').trim();
  const gramEquiv = document.getElementById('pb-form-gramequiv')?.value || '';
  if (isNaN(price) || price < 0) { App.toast('Enter a valid price', 'warn'); return; }
  if (_modalPriceIdx !== null) {
    Data.removePriceEntry(_modalIngredientName, _modalPriceIdx);
  }
  Data.setPriceEntry(_modalIngredientName, { unit, pricePerUnit: price, retailer, gramEquiv });
  App.closeModal();
  render();
  App.toast('Price saved ✓');
}
```

- [ ] **Step 6: Export `onUnitChange` in the return statement**

Find (around line 247):
```js
    return { render, filter, toggleOrphans, openAddIngredientForm, saveNewIngredient, openAddPriceForm, openEditPriceForm, savePrice, removePrice, removeIngredient };
```

Change to:
```js
    return { render, filter, toggleOrphans, openAddIngredientForm, saveNewIngredient, openAddPriceForm, openEditPriceForm, savePrice, removePrice, removeIngredient, onUnitChange };
```

- [ ] **Step 7: Commit**

```bash
git add js/prices.js
git commit -m "feat(prices): expand units, add gramEquiv field for can/packet/loaf/bunch/head"
```

---

### Task 4: Cross-unit pantry matching in `shopping.js`

**Files:**
- Modify: `js/shopping.js`

**Context:**
- There is a local `const units = [...]` variable at line ~125, inside the inline price-edit form function. Expand it.
- Pantry auto-check logic is inline in `render()` at lines 179–191 — NOT a named function. Uses `Data.toggleShoppingItem`.
- `_renderPantryBadge(item)` — lines 105–115. Returns an HTML string showing pantry stock status.
- `Data.normalizeToBase(qty, unit, gramEquiv?)` is now exported from `data.js` (Task 1).
- `Data.getPantryItem(name)` returns the full pantry item object, which now includes `gramEquiv` if set.

---

- [ ] **Step 1: Expand the local `units` array inside the price-edit form function**

Find (line ~125):
```js
    const units = ['g','100g','kg','ml','100ml','l','item','tsp','tbsp'];
```

Change to:
```js
    const units = ['g','100g','kg','ml','100ml','l','item','tsp','tbsp','clove','bunch','head','can','packet','loaf','dozen'];
```

- [ ] **Step 2: Update pantry auto-check logic in `render()` to use cross-unit normalisation**

Find (lines 179–191):
```js
    // Auto-tick items fully covered by pantry stock (same unit, sufficient qty)
    const preItems = Data.getShoppingList();
    preItems.forEach((item, idx) => {
      if (item.checked) return;
      if (_userUnchecked.has(item.name.toLowerCase().trim())) return; // user explicitly unticked
      const pantry = Data.getPantry();
      const pantryItem = pantry.find(p => p.ingredient.toLowerCase() === item.name.toLowerCase().trim());
      if (!pantryItem || pantryItem.qty <= 0) return;
      if (!item.qty) return; // skip items with no specified quantity
      if (pantryItem.unit === item.unit && pantryItem.qty >= item.qty) {
        Data.toggleShoppingItem(idx);
      }
    });
```

Change to:
```js
    // Auto-tick items fully covered by pantry stock (cross-unit aware)
    const preItems = Data.getShoppingList();
    preItems.forEach((item, idx) => {
      if (item.checked) return;
      if (_userUnchecked.has(item.name.toLowerCase().trim())) return; // user explicitly unticked
      const pantry = Data.getPantry();
      const pantryItem = pantry.find(p => p.ingredient.toLowerCase() === item.name.toLowerCase().trim());
      if (!pantryItem || pantryItem.qty <= 0) return;
      if (!item.qty) return; // skip items with no specified quantity
      const [shoppingBase, shoppingBaseUnit] = Data.normalizeToBase(item.qty, item.unit);
      const [pantryBase, pantryBaseUnit] = Data.normalizeToBase(pantryItem.qty, pantryItem.unit, pantryItem.gramEquiv);
      if (shoppingBaseUnit === pantryBaseUnit && pantryBase >= shoppingBase) {
        Data.toggleShoppingItem(idx);
      }
    });
```

- [ ] **Step 3: Update `_renderPantryBadge` to use cross-unit comparison**

Find (lines 105–115):
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
```

Change to:
```js
function _renderPantryBadge(item) {
  const pantryItem = Data.getPantryItem(item.name);
  if (!pantryItem || pantryItem.qty <= 0) return '';
  const [shoppingBase, shoppingBaseUnit] = Data.normalizeToBase(item.qty || 0, item.unit);
  const [pantryBase, pantryBaseUnit] = Data.normalizeToBase(pantryItem.qty, pantryItem.unit, pantryItem.gramEquiv);
  if (shoppingBaseUnit === pantryBaseUnit) {
    if (pantryBase >= (item.qty ? shoppingBase : 0)) {
      return `<div class="pantry-in-stock">✓ In pantry (${_fmtPantryQty(pantryItem.qty)} ${_esc(pantryItem.unit)})</div>`;
    }
    return `<div class="pantry-partial-stock">In pantry: ${_fmtPantryQty(pantryItem.qty)} ${_esc(pantryItem.unit)}</div>`;
  }
  return `<div class="pantry-partial-stock">In pantry: ${_fmtPantryQty(pantryItem.qty)} ${_esc(pantryItem.unit)}</div>`;
}
```

- [ ] **Step 4: Commit**

```bash
git add js/shopping.js
git commit -m "feat(shopping): cross-unit pantry matching and badge using Data.normalizeToBase"
```
