# Pantry Inventory Design Spec

## Goal

Add a pantry inventory system to the recipe book PWA. Users track what food they have at home so the shopping list can automatically show stock levels, auto-tick covered items, and a "Log Purchase" flow updates pantry stock after a shop.

---

## Data Model

### `_db.pantry` (already exists as `[]`)

```js
[
  { ingredient: 'onion', qty: 2, unit: 'kg', updatedDate: '2026-06-17', perishable: false },
  { ingredient: 'milk',  qty: 1, unit: 'l',  updatedDate: '2026-06-17', perishable: true  },
]
```

- `ingredient`: lowercase normalized (`.toLowerCase().trim()`)
- `qty`: numeric — 0 means out of stock
- `unit`: one of `g | 100g | kg | ml | 100ml | l | item | tsp | tbsp`
- `updatedDate`: ISO date YYYY-MM-DD, set automatically on every write
- `perishable`: boolean — `clearPantryPerishables()` zeros out all perishable items

---

## Data API (`js/data.js`)

Five new functions added to the `Data` IIFE and exported:

| Function | Signature | Behaviour |
|---|---|---|
| `getPantry()` | `()` | Returns `_db.pantry \|\| []`. Already exists — no change needed. |
| `setPantryItem(ingredient, opts)` | `(string, {qty, unit, perishable?})` | Upsert by name (case-insensitive). Creates item if not found. Sets `updatedDate = new Date().toISOString().slice(0, 10)`. Calls `save()`. |
| `removePantryItem(ingredientName)` | `(string)` | Removes item by lowercase name. Calls `save()`. |
| `clearPantryPerishables()` | `()` | Sets `qty = 0` for every item where `perishable === true`. Calls `save()`. |
| `getPantryItem(name)` | `(string)` | Returns item or `null`. Exact lowercase match first, then substring match. |

`getPantry()` already exists in `data.js:51` — do NOT re-add it. Only add the four new functions.

---

## Shopping List Integration (`js/shopping.js`)

### Pantry stock badge

In `render()`, after building the item `label`, look up `Data.getPantryItem(item.name)`. Insert a pantry badge `div` immediately after the `shop-item-name` span, inside `.shop-item-main`:

```html
<div class="shop-item-main">
  <div class="shop-item-top">
    <span class="shop-item-name">${label}</span>
    ${hasSources ? ... : ''}
  </div>
  ${pantryHtml}          <!-- NEW: pantry badge -->
  ${_renderPriceDisplay(item._idx, item)}
  ${sourcesHtml}
</div>
```

**Badge logic** (`_renderPantryBadge(item)` helper):
- Get pantry item by `Data.getPantryItem(item.name)`
- If not found or `pantryItem.qty <= 0`: return `''`
- If `pantryItem.unit === item.unit` (same unit, direct comparison):
  - If `pantryItem.qty >= (item.qty || 0)`: auto-tick this item (`Data.toggleShoppingItem(item._idx)` if not already checked), return `<div class="pantry-in-stock">✓ In pantry (${pantryItem.qty} ${pantryItem.unit})</div>`
  - Else: return `<div class="pantry-partial-stock">In pantry: ${pantryItem.qty} ${pantryItem.unit}</div>`
- If units differ (incompatible): return `<div class="pantry-partial-stock">In pantry: ${pantryItem.qty} ${pantryItem.unit}</div>`

**Auto-tick behaviour:** `_renderPantryBadge` must NOT call `toggleShoppingItem` during `render()` — that would cause a re-render loop. Instead, the auto-tick should be applied in a **pre-render pass** in `render()`: before building HTML, iterate items, check pantry, and call `Data.toggleShoppingItem(idx)` for any unchecked items fully covered by pantry. Then re-read items via `Data.getShoppingList()` for the HTML render.

### "Log Purchase" button

Add to `#view-shopping .section-header-actions` in `index.html`:
```html
<button class="btn-small" onclick="Shopping.openLogPurchase()">Log Purchase</button>
```

`openLogPurchase()`:
1. Gets unchecked shopping list items (not yet ticked)
2. If none: `App.toast('Nothing to log — tick items before logging')` and return
3. Shows modal:
   - Title: "Log Purchase"
   - For each unchecked item: a row with item name + number input (pre-filled with `item.qty || 1`) + unit display
   - "Confirm & Update Pantry" button → calls `Shopping.confirmPurchase()`
   - Cancel button

`confirmPurchase()`:
- Reads each row's qty from `#log-qty-${idx}` inputs
- For each: calls `Data.setPantryItem(item.name, { qty: parsedQty, unit: item.unit })`
- Calls `App.closeModal()`
- Toasts "Pantry updated ✓"
- Calls `render()`

---

## Pantry View (`js/pantry.js`)

New IIFE module. Module-level state:
```js
let _filter = '';
let _editingName = null;  // ingredient name being edited in modal
```

### `render()`

Reads `Data.getPantry()`, filters by `_filter`, renders cards into `#pantry-list`.

Empty state: `<div class="empty-state"><span class="emoji">🥫</span>Pantry is empty. Add items or log a purchase.</div>`

Card structure:
```html
<div class="pantry-card">
  <div class="pantry-card-header">
    <div class="pantry-card-left">
      <span class="pantry-card-name">Onion</span>
      <span class="pantry-card-qty">2 kg</span>
      [if perishable: <span class="pantry-perishable-badge">perishable</span>]
    </div>
    <div class="pantry-card-actions">
      <button class="btn-mini" onclick="Pantry.openEditForm(realIdx)">Edit</button>
      <button class="btn-mini btn-danger-mini" onclick="Pantry.remove(realIdx)">✕</button>
    </div>
  </div>
</div>
```

Use `allItems.indexOf(item)` for `realIdx` when filtered (same pattern as `prices.js`).

### `filter()`

Sets `_filter` from `#pantry-search`, calls `render()`.

### `openAddForm()`

Opens modal with:
- Ingredient name text input (`#pantry-form-ing`, autofocus)
- Qty number input (`#pantry-form-qty`, min=0, step=0.1)
- Unit select (`#pantry-form-unit`, options: g/100g/kg/ml/100ml/l/item/tsp/tbsp, default `item`)
- Perishable checkbox (`#pantry-form-perishable`)
- Cancel + "Add to Pantry" buttons

### `saveNew()`

Reads form fields. Validates: ingredient not empty, qty >= 0. Calls `Data.setPantryItem(ingredient, { qty, unit, perishable })`. Closes modal, re-renders, toasts "Added to pantry ✓".

### `openEditForm(idx)`

Sets `_editingName = allItems[idx].ingredient`. Opens modal pre-filled:
- Ingredient name shown as read-only text (not editable — identified by name)
- Qty pre-filled
- Unit pre-filled
- Perishable checkbox pre-filled

### `save()`

Reads form. Validates qty >= 0. Calls `Data.setPantryItem(_editingName, { qty, unit, perishable })`. Closes modal, re-renders, toasts "Pantry updated ✓".

### `remove(idx)`

Calls `confirm('Remove this item from pantry?')`. Calls `Data.removePantryItem(item.ingredient)`. Re-renders. Toasts "Removed".

### `resetPerishables()`

Calls `confirm('Reset all perishable items to 0?')`. Calls `Data.clearPantryPerishables()`. Re-renders. Toasts "Perishables reset ✓".

### Public API

```js
return { render, filter, openAddForm, saveNew, openEditForm, save, remove, resetPerishables };
```

---

## Navigation

### Settings page (`#view-settings` in `index.html`)

Add a new settings group after the Price Book group:

```html
<div class="settings-group">
  <h3>Pantry</h3>
  <p class="hint">Track what you have at home. Shopping list shows stock levels automatically.</p>
  <button class="btn-secondary" onclick="App.pushView('pantry','Pantry'); Pantry.render()">Manage Pantry →</button>
</div>
```

### Shopping list header (`#view-shopping .section-header-actions`)

Add "Pantry" and "Log Purchase" buttons alongside the existing "Price Book" and "Clear checked" buttons:

```html
<button class="btn-small" onclick="App.pushView('pantry','Pantry'); Pantry.render()">Pantry</button>
<button class="btn-small" onclick="Shopping.openLogPurchase()">Log Purchase</button>
```

---

## HTML View (`index.html`)

New view section added before the closing `</main>`:

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

Script tag added before `js/app.js`:
```html
<script src="js/pantry.js"></script>
```

---

## CSS (`css/style.css`)

Append at end of file:

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

---

## Files Changed

| File | Change |
|---|---|
| `js/data.js` | Add `setPantryItem`, `removePantryItem`, `clearPantryPerishables`, `getPantryItem`; add to exports |
| `js/pantry.js` | New IIFE module (create from scratch) |
| `js/shopping.js` | Add `_renderPantryBadge`, pantry auto-tick pre-pass in `render()`, "Log Purchase" button `openLogPurchase()` and `confirmPurchase()` functions |
| `index.html` | Add `#view-pantry` section, `<script src="js/pantry.js">` before `js/app.js`, navigation buttons in settings + shopping header |
| `css/style.css` | Append pantry card styles |
