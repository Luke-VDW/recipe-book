# Sub-project F: Pantry Date Batches + FIFO Deduction Design Spec

## Goal

Track pantry stock as dated batches (e.g. "1 can bought 10 Jun + 2 cans bought 19 Jun = 3 total"). When cooking, optionally deduct from the oldest batch first (FIFO). A settings toggle controls whether FIFO or simple deduction is used.

---

## Data Model

### Pantry item shape (new)

```js
{
  ingredient: 'tomatoes',
  unit: 'can',
  gramEquiv: 400,
  perishable: false,
  qty: 3,           // sum of batches — kept for all existing callers
  batches: [
    { qty: 1, date: '2026-06-10' },
    { qty: 2, date: '2026-06-19' }
  ],
  updatedDate: '2026-06-19'
}
```

`qty` is always kept in sync as the sum of `batches[*].qty`. Existing callers that read `item.qty` continue to work without change.

### Migration

When `Data.load()` runs, any pantry item without a `batches` array is given one:
```js
if (!item.batches) item.batches = [{ qty: item.qty, date: item.updatedDate || '' }];
```

### Settings flag

`_db.settings.fifo` (boolean, default `true`) controls FIFO behaviour. Access via `Data.getFIFO()` / `Data.setFIFO(v)`.

---

## New Data Functions

### `Data.addPantryBatch(ingredient, qty, unit, opts)`

Adds a new batch to an existing-or-new pantry item. Used by `confirmShop()`.

```
opts: { gramEquiv?, perishable?, date? }   // date defaults to today
```

Behaviour:
- Upserts item (creates if not exists)
- Appends `{ qty, date }` to `item.batches`
- Updates `item.qty = sum(batches)`
- Updates `item.unit`, `item.gramEquiv` if provided
- Saves

### `Data.deductPantryFIFO(ingredient, deductAmt, unit)`

Deducts `deductAmt` (in `unit`) from the item's batches, oldest-first.

Behaviour:
- Normalises `deductAmt` to the item's native unit using `Data.normalizeToBase()` if units differ and a `gramEquiv` exists; otherwise deducts directly.
- Sorts batches by `date` ascending (empty date treated as oldest).
- Removes from first batch first; if a batch is exhausted, removes it; continues to the next batch.
- Sets `item.qty = max(0, sum(batches))`.
- Saves and returns the item (so callers can show remaining qty).

### `setPantryItem` (unchanged signature, adjusted behaviour)

When called with a direct `qty` (i.e. manual edit via `Pantry.save()`):
- Sets `item.qty` to the new qty.
- Replaces `item.batches` with a single batch: `[{ qty: opts.qty, date: today }]`.
- This preserves the batch structure after a manual edit (single dated batch).

---

## Files Changed

| File | Change |
|---|---|
| `js/data.js` | Migration in `load()`; add `addPantryBatch()`, `deductPantryFIFO()`, `getFIFO()`, `setFIFO()`; update `setPantryItem()` to sync batches; export new functions |
| `js/pantry.js` | Show batch breakdown in pantry cards; in `openAddForm()` show date field; save calls `addPantryBatch` for new adds |
| `js/shopping.js` | `confirmShop()` calls `addPantryBatch` instead of `setPantryItem` |
| `js/recipes.js` | `_deductIngredient()` uses `deductPantryFIFO` when `Data.getFIFO()` is true; existing `setPantryItem` path when false |
| `index.html` | Add FIFO toggle in Settings view |
| `css/style.css` | `.pantry-batch-list`, `.pantry-batch-row` styles |

---

## Pantry UI — Batch Display

Each pantry card gains a batch section below the qty. Only rendered when `batches.length > 0` (which is always after migration).

For single batch:
```
500g · 19 Jun
```

For multiple batches (always expanded, no toggle needed):
```
1 can · 10 Jun
2 cans · 19 Jun
```

Format: `qty unit · DD Mon` (abbreviated month, no year unless different year).

When `batches.length > 1`, a small "FIFO" badge appears if `Data.getFIFO()` is true, indicating deduction order.

---

## Settings Toggle

In `index.html` settings view, add a new settings group:

```html
<div class="settings-group">
  <h3>Pantry FIFO</h3>
  <p class="hint">When cooking, deduct from the oldest batch first.</p>
  <label>
    <input type="checkbox" id="settings-fifo-toggle" onchange="Settings.setFIFO(this.checked)" />
    Use FIFO deduction (oldest batch first)
  </label>
</div>
```

`Settings.setFIFO(v)` calls `Data.setFIFO(v)`. `Settings.init()` pre-populates the checkbox.

---

## Cooking Deduction (recipes.js)

In `_deductIngredient(name, scaledQty, unit, ingIdx)`:

Replace the two `Data.setPantryItem(...)` calls with a unified path:

```js
if (Data.getFIFO()) {
  Data.deductPantryFIFO(name, actualUsed, p.unit);
} else {
  // existing direct setPantryItem path (unchanged)
}
```

The shortfall case (pantry has less than needed) always deducts to zero regardless of FIFO setting.

---

## Key Constraints

- `item.qty` must always equal `sum(item.batches.map(b => b.qty))` after every mutation
- `normalizeToBase` already exists in `data.js` and handles g/kg/ml/l/100g/100ml conversions
- Batches with `qty: 0` are cleaned up (removed) after deduction
- The `gramEquiv` on the item is NOT per-batch — it applies to all batches uniformly
- `addPantryBatch` from `confirmShop` must also preserve `gramEquiv` (pass `existingPantry?.gramEquiv` if not provided in `opts`)
