# Price Book v2 Design Spec

## Goal

Upgrade the price book to support multiple price/unit entries per ingredient (e.g. onion/kg AND onion/item), multiple retailer prices for the same ingredient+unit, automatic date stamping on every price save, and a nested ingredient-card UI.

---

## Data Model

### New `priceBook` structure

```js
priceBook: [
  {
    ingredient: 'onion',          // lowercase, normalised
    prices: [
      { unit: 'kg',   pricePerUnit: 20,  retailer: 'Checkers', updatedDate: '2026-06-17' },
      { unit: 'item', pricePerUnit: 4,   retailer: '',         updatedDate: '2026-06-17' },
    ]
  },
  {
    ingredient: 'beef mince',
    prices: [
      { unit: 'kg', pricePerUnit: 140, retailer: 'Checkers', updatedDate: '2026-06-17' },
      { unit: 'kg', pricePerUnit: 148, retailer: 'PnP',      updatedDate: '2026-06-17' },
    ]
  }
]
```

Each `priceBook` entry is an **ingredient card** with one or more **price rows**. An ingredient card with zero price rows does not exist — removing the last price row removes the card.

### Migration

On `load()`, detect the old flat format by checking if `_db.priceBook[0]?.unit !== undefined` (the old structure had `unit` at the top level). If detected: clear `_db.priceBook` to `[]` and call `loadStarterPrices()` to re-seed in the new nested format.

### Starter data

The 70-entry starter price list is re-seeded in the new nested format. Entries for the same ingredient at different units (e.g. `garlic/item` and `ginger/100g`) are separate ingredient cards, not grouped, since they represent genuinely different purchase units.

---

## Data API (`js/data.js`)

### `getPriceBook()`
Returns `_db.priceBook || []`. No change to call signature.

### `setPriceEntry(ingredientName, priceEntry)`

- `ingredientName`: string (lowercased before use)
- `priceEntry`: `{ unit, pricePerUnit, retailer, updatedDate }`

Logic:
1. Find ingredient card by exact name match (case-insensitive). If not found, create a new card with empty `prices`.
2. Within the card's `prices`, find an existing row matching `unit` AND `retailer` (both case-insensitive). If found, replace it. If not found, push a new row.
3. Always set `priceEntry.updatedDate = new Date().toISOString().slice(0, 10)` before saving, regardless of what the caller passes.
4. Call `save()`.

### `removePriceEntry(ingredientName, priceIdx)`

- Removes the price row at `priceIdx` from the named ingredient's `prices` array.
- If `prices` is now empty, removes the ingredient card entirely.
- Calls `save()`.

### `removeIngredient(ingredientIdx)`

- Removes the ingredient card at `ingredientIdx` from `priceBook`.
- Calls `save()`.

### `lookupPriceEntry(name)`

- Returns the ingredient card object (with `{ ingredient, prices }`) for the best match, or `null`.
- Match order: exact match on `ingredient` first, then substring (`lower.includes(e.ingredient)` only — no reverse direction).

### `lookupPrice(name, qty, unit)`

1. Call `lookupPriceEntry(name)`. Return `null` if none.
2. `parsedQty = parseFloat(qty) || 0`. Return `0` if zero.
3. `[baseQty, baseType] = _normalizeToBase(parsedQty, unit)`.
4. Filter ingredient's `prices` to those where `_pricePerBase(p.pricePerUnit, p.unit)[1] === baseType` (compatible unit family).
5. If no compatible prices, return `null`.
6. Average the compatible `pricePerBase` values across all matching rows.
7. Return `Math.round(baseQty * avgPricePerBase * 100) / 100`.

`_normalizeToBase` and `_pricePerBase` helpers are unchanged.

---

## Price Book UI (`js/prices.js`)

### View layout

```
🔍 [Search ingredients…                        ]

ONION                                [+ Add price]  [✕ Remove]
  R20.00/kg  · Checkers  · Jun 17    [Edit] [✕]
  R 4.00/item            · Jun 17    [Edit] [✕]

BEEF MINCE                           [+ Add price]  [✕ Remove]
  R140.00/kg · Checkers  · Jun 17    [Edit] [✕]
  R148.00/kg · PnP       · Jun 17    [Edit] [✕]

                               [＋ Add ingredient]
```

Search filters ingredient names (shows/hides cards; does not filter individual price rows).

### Functions

#### `render()`
Iterates `Data.getPriceBook()`, renders one `.pb-card` per ingredient. Uses `entries.indexOf(entry)` for the `ingredientIdx` on all buttons. Within each card, uses the prices array index for `priceIdx` buttons.

#### `filter()`
Sets `_filter` from `#pb-search`, calls `render()`.

#### `openAddIngredientForm()`
Opens modal with:
- Ingredient name input (`pb-form-ing`)
- Price number input (`pb-form-price`)
- Unit select (`pb-form-unit`, default `'item'`)
- Retailer text input (`pb-form-retailer`, optional)
- Save calls `PriceBook.saveNewIngredient()`

#### `saveNewIngredient()`
Reads modal fields. Validates: ingredient name not empty, price >= 0. Calls `Data.setPriceEntry(ingredient, { unit, pricePerUnit, retailer })`. Closes modal, re-renders, toasts.

#### `openAddPriceForm(ingredientIdx)`
Opens modal pre-filled with the ingredient name (read-only display, not editable). Fields: price, unit, retailer. Save calls `PriceBook.savePrice(ingredientName, null)`.

#### `openEditPriceForm(ingredientIdx, priceIdx)`
Opens modal pre-filled with all fields from the existing price row. Save calls `PriceBook.savePrice(ingredientName, priceIdx)` — note: since `setPriceEntry` matches by `unit+retailer`, passing the original values correctly updates in place.

#### `savePrice(ingredientName, priceIdx)`
Reads modal fields. Validates price >= 0. If `priceIdx !== null`, calls `Data.removePriceEntry(ingredientName, priceIdx)` first (handles unit/retailer rename without duplicates). Then calls `Data.setPriceEntry(ingredientName, { unit, pricePerUnit, retailer })`. Closes modal, re-renders, toasts.

#### `removePrice(ingredientName, priceIdx)`
Calls `confirm()`. Calls `Data.removePriceEntry(ingredientName, priceIdx)`. Re-renders, toasts.

#### `removeIngredient(ingredientIdx)`
Calls `confirm()`. Calls `Data.removeIngredient(ingredientIdx)`. Re-renders, toasts.

---

## Shopping List (`js/shopping.js`)

### `savePrice(idx)`
Update call from:
```js
Data.setPriceEntry({ ingredient, unit, pricePerUnit, retailer, updatedDate })
```
To:
```js
Data.setPriceEntry(ingredient, { unit, pricePerUnit, retailer })
```
(Date is now set automatically inside `Data.setPriceEntry`.)

### `_renderPriceDisplay(idx, item)`
No structural change. When multiple compatible prices exist, the per-unit display reads:
- Single retailer: `R18.00/100g [Checkers]`
- Multiple retailers: `avg R19.00/100g`

To produce this, call `Data.lookupPriceEntry(item.name)`, count compatible prices for the item's unit, and choose the label accordingly. The cost figure (`R XX.XX`) always uses the averaged `Data.lookupPrice` result.

---

## CSS (`css/style.css`)

New classes needed:

```css
/* Ingredient card */
.pb-card            — white card, border-radius, margin-bottom, border
.pb-card-header     — flex row, space-between, padding, background lt-green
.pb-card-name       — font-weight 700, text-transform capitalize
.pb-card-actions    — flex, gap

/* Price rows */
.pb-price-rows      — padding 0 16px
.pb-price-row       — flex, align-items center, justify-content space-between, padding 8px 0, border-bottom
.pb-price-row:last-child — no border-bottom
.pb-price-row-info  — flex, gap, align-items center, font-size 0.85rem
.pb-price-date      — font-size 0.72rem, color text-muted, opacity 0.7
.pb-add-ingredient-btn — full-width secondary button at bottom of list
```

Existing `.pb-ingredient`, `.pb-price`, `.pb-retailer`, `.pb-row`, `.pb-row-main`, `.pb-row-actions`, `.btn-danger-mini` classes are replaced by the card-based classes above.

---

## Files Changed

| File | Change |
|---|---|
| `js/data.js` | New nested priceBook model, migration guard in `load()`, updated `setPriceEntry` / `removePriceEntry` / `removeIngredient` / `lookupPriceEntry` / `lookupPrice`, re-seeded starter data |
| `js/prices.js` | Full rewrite: ingredient cards, per-card add-price, edit/delete per row |
| `js/shopping.js` | Update `savePrice` call signature; update `_renderPriceDisplay` for avg label |
| `css/style.css` | Replace old pb-row styles with card-based styles |
