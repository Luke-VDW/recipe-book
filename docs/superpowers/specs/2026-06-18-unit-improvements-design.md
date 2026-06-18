# Sub-project C: Unit Improvements Design Spec

## Goal

Expand the pantry and price book unit dropdown to include counting units (`clove`, `bunch`, `head`) and pack-based units (`can`, `packet`, `loaf`, `dozen`). For entries that use these new units, support an optional gram-equivalent field so the app can perform cross-unit comparison for pantry coverage and price estimation.

---

## New Units

The `UNITS` constant (currently `['g','100g','kg','ml','100ml','l','item','tsp','tbsp']`) is updated identically in all three files that define it:

- `js/pantry.js`
- `js/prices.js`
- `js/shopping.js`

New value:
```js
const UNITS = ['g','100g','kg','ml','100ml','l','item','tsp','tbsp','clove','bunch','head','can','packet','loaf','dozen'];
```

### Global conversion defaults (no user input needed)

| Unit | Converts to |
|---|---|
| `clove` | 5g (garlic clove — reliably ~5g) |
| `dozen` | 12 × item (for price: R48/dozen → R4/item) |

### Pack units requiring gram-equivalent

`can`, `packet`, `loaf`, `bunch`, `head` — these vary too much by ingredient to have a reliable default. When no gram-equivalent is provided, they fall back to `item` for conversion purposes (the unit still displays correctly).

---

## Gram Equivalent Field

### Data model

An optional `gramEquiv` field is added to two existing structures. It means "grams per 1 of this unit" (e.g. `gramEquiv: 400` on a `can` entry means 1 can = 400g).

**Pantry item** (in `_db.pantry`):
```js
{ ingredient, qty, unit, gramEquiv, perishable, updatedDate }
```

**Price book price entry** (in `_db.priceBook[n].prices`):
```js
{ unit, pricePerUnit, gramEquiv, retailer, updatedDate }
```

Existing entries without `gramEquiv` continue to work — the field is absent, and conversion falls back to `item`.

### UI

When the selected unit is one of `can`, `packet`, `loaf`, `bunch`, or `head`, a small optional numeric field appears immediately below the unit dropdown:

```
1 [can] ≈ [____] g   (optional)
```

- Placeholder: `e.g. 400`
- Numeric input only (no negative values)
- Left blank → entry is saved without `gramEquiv` (no conversion)
- `clove` and `dozen` never show this field — their conversions are fixed

This field appears in:
- Pantry: add form and edit form
- Price book: "Add price" modal and "Edit price" modal

---

## Conversion Functions

### `_normalizeToBase(qty, unit, gramEquiv?)`

Extended with new cases (added before the final fallback):

```js
if (u === 'clove')  return [qty * 5, 'g'];
if (u === 'dozen')  return [qty * 12, 'item'];
if (['can','packet','loaf','bunch','head'].includes(u) && gramEquiv) return [qty * gramEquiv, 'g'];
// existing fallback:
return [qty, 'item'];
```

The function signature gains an optional third parameter `gramEquiv` (number). Existing callers that pass only `(qty, unit)` are unaffected.

### `lookupPrice()` call site in `data.js`

`lookupPrice()` calls `_pricePerBase(price.pricePerUnit, price.unit)` for each price entry. This call must be updated to pass the entry's gram equivalent:

```js
_pricePerBase(price.pricePerUnit, price.unit, price.gramEquiv)
```

This is the only internal call site for `_pricePerBase`.

### `_pricePerBase(pricePerUnit, pbUnit, gramEquiv?)`

Extended with matching cases:

```js
if (pbUnit === 'clove')  return [pricePerUnit / 5, 'g'];
if (pbUnit === 'dozen')  return [pricePerUnit / 12, 'item'];
if (['can','packet','loaf','bunch','head'].includes(pbUnit) && gramEquiv) return [pricePerUnit / gramEquiv, 'g'];
// existing fallback:
return [pricePerUnit, 'item'];
```

### Export `normalizeToBase` from `data.js`

`_normalizeToBase` is renamed to `normalizeToBase` (removing the private-convention underscore) and added to the IIFE return statement. This lets `shopping.js` call it directly without duplicating the conversion table.

The internal call in `_pricePerBase` (if it calls `_normalizeToBase`) is updated to use the new name. All other internal references are updated.

---

## Pantry Matching in `shopping.js`

Two functions currently do a strict unit + quantity match against the pantry. Both are updated to use cross-unit normalisation.

### `checkPantryItems()` — auto-check logic

Current:
```js
if (pantryItem.unit === item.unit && pantryItem.qty >= item.qty) {
  Data.toggleShoppingItem(idx);
}
```

New:
```js
const [shoppingBase, shoppingBaseUnit] = Data.normalizeToBase(item.qty, item.unit);
const [pantryBase, pantryBaseUnit] = Data.normalizeToBase(pantryItem.qty, pantryItem.unit, pantryItem.gramEquiv);
if (shoppingBaseUnit === pantryBaseUnit && pantryBase >= shoppingBase) {
  Data.toggleShoppingItem(idx);
}
```

### `_renderPantryBadge()` — badge display

Current uses `pantryItem.unit === item.unit` to decide whether to show "In pantry" vs "Partial stock". Updated to compare normalised base units and quantities using the same pattern as above.

When cross-unit but convertible (e.g. pantry has "1 can = 400g", recipe needs "400g"):
- If `pantryBase >= shoppingBase`: "✓ In pantry (1 can)"
- If `pantryBase < shoppingBase`: "In pantry: 1 can"

When units are incompatible (base units differ, e.g. `g` vs `ml`): show raw pantry quantity without comparison, same as current behaviour for different units.

---

## Files Changed Summary

| File | Change |
|---|---|
| `js/data.js` | Rename `_normalizeToBase` → `normalizeToBase`; extend with new units + gramEquiv param; extend `_pricePerBase` with new units + gramEquiv param; update `setPantryItem` to accept + store `gramEquiv`; export `normalizeToBase` in return statement |
| `js/pantry.js` | Expand `UNITS`; show gramEquiv input when relevant unit selected in add/edit form |
| `js/prices.js` | Expand `UNITS`; show gramEquiv input in add-price and edit-price modals |
| `js/shopping.js` | Expand `UNITS`; update `checkPantryItems` and `_renderPantryBadge` to use `Data.normalizeToBase` for cross-unit comparison |
