# Sub-project B: Shopping List Overhaul Design Spec

## Goal

Full redesign of the shopping list interaction model: checkbox means "purchased", a separate per-item "use pantry" option replaces the auto-check behaviour, inline actual price logging feeds a new actual total alongside the estimated total, ad-hoc items can be added mid-shop with autocomplete, and a single "Confirm shop" modal replaces the old "Log Purchase" + "Complete Shop" buttons. Confirmed spend entries can be corrected later in the Analytics view.

---

## Data Model

### Shopping list item (`_db.shoppingList` entries)

Three optional fields are added to the existing shape:

```js
{
  name, unit, qty, recipes, checked,  // existing
  pantryUsed: true,     // user tapped "use pantry" — mutually exclusive with checked
  actualPrice: 14.99,   // actual price paid for this item this shop (total, not per-unit)
  adhoc: true,          // added via "+ Add item" (not from meal planner)
}
```

`checked` and `pantryUsed` are mutually exclusive:
- Ticking the checkbox clears `pantryUsed`
- Tapping "Use pantry" clears `checked`

`actualPrice` is independent of both states and may be set at any time.

### Spend log item shape (`_db.spendLog[n].items`)

Items gain an `estimated` flag to support post-shop correction:

```js
{ name, qty, unit, cost: 45.00, estimated: false }
// estimated: true  → cost came from price book estimate, not logged inline
// estimated: false → cost came from actualPrice logged by user
```

### New `data.js` functions

**`updateShoppingItem(idx, fields)`**
Updates arbitrary fields on a shopping list item and saves.
```js
function updateShoppingItem(idx, fields) {
  if (!_db.shoppingList[idx]) return;
  Object.assign(_db.shoppingList[idx], fields);
  save();
}
```

**`addShoppingItem(item)`**
Appends one item to the shopping list and saves.
```js
function addShoppingItem(item) {
  if (!_db.shoppingList) _db.shoppingList = [];
  _db.shoppingList.push(item);
  save();
}
```

Both are exported in the return statement.

---

## Item Row States

Each row has three possible visual states:

### Idle (default)
```
[□] 500g chicken breast                [View recipes ▾]
    Use pantry ●   ← shown only when pantry has stock for this item
    est. R45.00 · R90/kg [Woolies] ✏   actual: [R___]
```
- "Use pantry ●" button: present when `Data.getPantryItem(item.name)` has qty > 0 AND `!item.checked && !item.pantryUsed`
- `actual: [R___]` — small inline number input; writes to `item.actualPrice` via `Data.updateShoppingItem`

### Purchased (`item.checked === true`)
```
[✓] ~~500g chicken breast~~            [View recipes ▾]
    est. R45.00 · R90/kg [Woolies] ✏   actual: [R___]
```
- Row gets existing `.checked` class (strikethrough + muted name)
- Price display and actual input remain visible (you may log price after ticking)
- Ticking clears `pantryUsed` if set

### Pantry-used (`item.pantryUsed === true`)
```
[□] 500g chicken breast  🏠            [View recipes ▾]
    ✕ undo pantry  ·  In pantry (600g)
```
- Row gets `.pantry-used` class (light green tint background)
- No price display (not purchasing)
- "✕ undo pantry" link clears `pantryUsed`
- Tapping "Use pantry" clears `checked`
- The pantry badge is shown inline (quantity in pantry)

### Pantry auto-check removed
The current `render()` logic that auto-ticks items covered by pantry is removed entirely. The `_userUnchecked` Set is also removed. Pantry coverage is communicated only through the "Use pantry" button appearance.

---

## Total Bar

```
Estimated   R 45.00
Actual      R 42.50       ← only shown when ≥1 actualPrice has been logged
3 items unpriced
```

- **Estimated** = existing `Data.lookupPrice` sum (unchanged logic)
- **Actual** = sum of `item.actualPrice` across all items that have one set (regardless of checked/pantry-used state)
- "N items unpriced" counts items with no price book entry AND no `actualPrice`
- If no `actualPrice` has been logged on any item, the "Actual" row is hidden — appearance matches today

---

## Ad-hoc Item Addition

A "＋ Add item" button in the header opens a mini-modal:

```
Add item

[Name ___________________]
 ↳ chicken breast          ← autocomplete dropdown
   chicken stock
   chicken vienna

[Qty ____]  [Unit ▾]

[Cancel]   [Add to list]
```

**Autocomplete:**
- Triggers after ≥2 characters typed, case-insensitive `contains` match against all `Data.getPriceBook()` ingredient names
- Shows up to 6 suggestions in a dropdown below the name input
- Clicking a suggestion fills the name and hides the dropdown
- If no match, the free-text name is accepted as-is

**On "Add to list":**
1. Appends `{ name, qty: parsedQty, unit, adhoc: true, checked: false }` via `Data.addShoppingItem(item)`
2. If the name has no price book entry, calls `Data.ensurePriceBookEntries([{ name }])` — creates a placeholder so the name appears in future autocomplete
3. Closes modal, calls `Shopping.render()`

The new item lands in the correct category group via the existing `guessCategory` logic.

---

## Confirm Shop Modal

Triggered by the "Confirm shop" button in the header.

### Layout

```
Confirm Shop

Store: [_________________]   ← retailer, applied to all price book updates

── Purchased (N items) ──
chicken breast  500g    R 45.00        ← actualPrice logged
beef mince      500g    R 55.00        ← actualPrice logged
garlic          1 head  ~ R 4.50       ← estimated (greyed, ~ prefix)

── From pantry (N items) ──
olive oil       30ml    (not purchasing)
lemon           1 item  (not purchasing)

[ ] Include estimated prices for unpriced items   ← checkbox, DEFAULT OFF

Total: R 100.00
Override total: [________]   ← always visible; if filled, takes precedence

[Cancel]   [Confirm & save]
```

**Total calculation:**
- Base total = sum of `actualPrice` for items that have one
- If "Include estimated" checkbox is ticked: add estimated costs for items without `actualPrice`
- If override total field is filled: use override value regardless of checkbox state
- Spend log entry uses: override (if filled) → calculated total → R 0.00 fallback

**Guard:** If no items are checked and no items are pantry-used, show a toast "Nothing confirmed yet — tick items as bought or mark as pantry use" and do not open the modal.

### On "Confirm & save"

1. **Price book update** (bought items with `actualPrice` only):
   `pricePerUnit = actualPrice / qty`, unit = `item.unit`, retailer from store field
   → `Data.setPriceEntry(name, { unit, pricePerUnit, retailer })`

2. **Pantry update** (all `checked` items):
   → `Data.setPantryItem(name, { qty, unit })` — adds to pantry stock

3. **Spend log entry:**
   ```js
   Data.logSpend({
     date: today ISO string,
     total: (override || calculatedTotal),
     retailer: storeField,
     items: boughtItems.map(i => ({
       name: i.name, qty: i.qty, unit: i.unit,
       cost: i.actualPrice ?? estimatedCost,
       estimated: i.actualPrice == null,
     }))
   })
   ```

4. **Remove confirmed items:** Filter out all `checked` and `pantryUsed` items from `_db.shoppingList` via `Data.setShoppingList(remaining)`

5. Close modal, `App.toast('Shop confirmed ✓')`, `Shopping.render()`

---

## Post-Shop Spend Entry Editing (Analytics)

Each entry in the "Recent shops" list in the Analytics view gains an "Edit" button. Tapping it expands an inline edit panel showing all items for that shop. Items with `estimated: true` are highlighted with an amber `~est` badge to draw attention to values worth correcting.

The user can update individual item costs (e.g. from a receipt at home). On save:

1. Recalculate the entry total from the updated item costs
2. For each corrected item (was `estimated: true`, now has a new cost): call `Data.setPriceEntry` to update the price book with the corrected price + the entry's retailer
3. Clear `estimated: true` on the corrected items
4. Save the updated entry back to `_db.spendLog`
5. Re-render the Analytics view

This lives in `analytics.js` as `editSpendEntry(entryIdx)` / `saveSpendEntry(entryIdx)`.

---

## Header Changes

```
BEFORE:  Price Book | Pantry | Log Purchase | Complete Shop | Clear checked
AFTER:   Price Book | Pantry | ＋ Add item  | Confirm shop  | Clear checked
```

"Confirm shop" uses `btn-small btn-small-primary` styling (green fill) to distinguish it as the primary action.

---

## Files Changed Summary

| File | Change |
|---|---|
| `js/data.js` | Add `updateShoppingItem(idx, fields)`, `addShoppingItem(item)`; update `logSpend` to store `retailer` field on entries; export both new functions |
| `js/shopping.js` | Full overhaul: remove `openLogPurchase`, `confirmPurchase`, `openCompleteShop`, `confirmCompleteShop`, `_userUnchecked`, `_logItems`, `_pendingSpend`, pantry auto-check in `render()`; add `markPantryUsed(idx)`, `openAddAdHocItem()`, `saveAdHocItem()`, `openConfirmShop()`, `confirmShop()`; update `render()`, `toggle()`, `_renderTotal()` |
| `js/analytics.js` | Add `editSpendEntry(idx)`, `saveSpendEntry(idx)` for correcting estimated prices post-shop |
| `index.html` | Swap header buttons in `#view-shopping` |
| `css/style.css` | Add `.pantry-used` row style, `.shop-actual-input`, `.shop-est-badge`, `.btn-small-primary`, spend entry edit styles |
