# Sub-project E: Shopping List Enhancements Design Spec

## Goal

Three improvements to the shopping list: (1) editable purchase-quantity field per item in the confirm-shop modal so the pantry update reflects what was actually bought; (2) pantry stock hint on all items that have stock (not just pantry-used items); (3) recipe filter to show only items sourced from a specific recipe.

---

## Enhancement 1: Purchase Quantity in Confirm-Shop Modal

### Problem

`confirmShop()` currently updates the pantry using the recipe-required qty (`item.qty`). If the user buys a different size (e.g., needs 500g, buys 1kg), the pantry records the wrong quantity.

### Design

In the confirm-shop modal (`openConfirmShop()`), each "Purchased" row gains an editable qty input pre-filled with `item.qty`. The input is stored temporarily in `_confirmQtyOverrides` (a module-level plain object `{ idx: qty }`) so changes are held in memory until the user clicks "Confirm & save".

When `confirmShop()` runs, it uses `_confirmQtyOverrides[idx] ?? item.qty` as the purchase quantity for:
- Pantry update (`Data.setPantryItem`)
- Price-per-unit calculation (`item.actualPrice / purchaseQty`)

The spend log always uses `item.qty` (the recipe-required qty) to stay consistent with how the shopping list was generated.

### UI Change (openConfirmShop)

Bought row before:
```
[name]        [qty] [unit]    [cost]
```

Bought row after:
```
[name]        <input qty> [unit]    [cost]
```

The qty input is `type="number"`, pre-filled with `item.qty`, step `0.01`, min `0`. `oninput` calls `Shopping._setConfirmQty(idx, this.value)` which updates `_confirmQtyOverrides[idx]`.

---

## Enhancement 2: Pantry Stock Hint on All Items

### Problem

Pantry stock is only shown for items marked as `pantryUsed`. Items with pantry stock but not yet marked show a "Use pantry ●" button but no qty hint, so the user doesn't know how much is available.

### Design

In `_renderItem()`, for items that are NOT `pantryUsed` and are NOT checked, show the pantry qty in the `usePantryBtn` area:

Before:
```
[Use pantry ●]
```

After:
```
[Use pantry ●]  · X unit in pantry
```

Implementation: extend the existing `_hasPantryStock(item)` check — when true, also render `<span class="shop-pantry-stock-hint">· ${qty} ${unit} in pantry</span>` next to the use-pantry button.

For items with no pantry stock, behaviour is unchanged (no button, no hint).

---

## Enhancement 3: Recipe Filter

### Design

A filter row appears above the shopping list items. It shows a horizontally scrollable list of recipe-name chips, derived from `item.sources[*].recipe` across all items. An "All" chip is always first.

Clicking a chip sets a module-level `_recipeFilter` string and calls `render()`. `render()` applies the filter: if `_recipeFilter` is set, only items whose `sources` array contains a source with that recipe name (or items with no sources, i.e., ad-hoc items) are shown.

Ad-hoc items (items with no sources) are never filtered out — they always show regardless of the active recipe filter.

The filter row is only rendered if there are 2+ distinct recipe names in the list. If only one recipe (or none), the filter is hidden.

### UI

```
[ All ] [ Pasta Bolognese ] [ Chicken Stir-Fry ] …  (scrollable chips)
```

### Module State

```js
let _recipeFilter = null;
```

`Shopping.setRecipeFilter(name)` sets `_recipeFilter` to `name` (or `null` for "All") then calls `render()`.

---

## Files Changed

| File | Change |
|---|---|
| `js/shopping.js` | Add `_confirmQtyOverrides`, `_setConfirmQty()`, update `openConfirmShop()` bought rows, update `confirmShop()` to use purchase qty; extend `_renderItem()` with pantry stock hint; add `_recipeFilter`, `setRecipeFilter()`, render recipe filter chips, apply filter in `render()` |
| `css/style.css` | Add `.shop-recipe-filter`, `.shop-recipe-chip`, `.shop-pantry-stock-hint` styles |

---

## Key Constraints

- `_confirmQtyOverrides` lives in module memory only — not persisted to `_db`
- Ad-hoc items (no sources, no `recipes` field) are never hidden by the recipe filter
- Pantry stock hint only appears for items with stock > 0 that are not `pantryUsed` and not `checked`
- The purchase qty input in the confirm modal accepts blanks (treated as original qty)
