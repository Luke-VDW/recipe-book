# Sub-project C: Cook Confirmation & Pantry Deduction Design Spec

## Goal

Add a "Just cooked this" flow to the recipe detail page. The user confirms they cooked a recipe, optionally adjusts the serving count, reviews what will be deducted from the pantry (with inline correction for shortfalls), and optionally adds extra ingredients they used. On confirmation, pantry stock is updated and a cook log entry is saved for analytics and future calendar integration.

---

## Data Model

### Cook log item (`_db.cookLog` entries)

```js
{
  date: '2026-06-18',       // ISO date YYYY-MM-DD
  recipeId: 'r_001',
  recipeName: 'Spaghetti Bolognese',
  servings: 3,              // actual servings cooked
  baseServings: 4,          // recipe's default servings
}
```

No per-ingredient breakdown stored — pantry deductions happen live; the log is for history and calendar use.

### New `data.js` functions

**`logCook(entry)`** — appends a cook entry and saves.
**`getCookLog()`** — returns `_db.cookLog`.

Both exported in the return statement.

---

## Button Placement

A "✅ Just cooked this" button is added to the `detail-actions` div rendered inside `openDetail()` in `js/recipes.js`, alongside the existing Timer / Add to Plan / Edit / Delete buttons.

---

## Cook Confirmation Modal

Single modal, same pattern as Confirm Shop.

```
Confirm Cook — Spaghetti Bolognese

Servings cooked: [3]    (recipe base: 4)

── Ingredients ──────────────────────────
Beef mince     375g    → 425g left          ← normal (pantry sufficient)
Garlic         1.5 cloves  ⚠ only 1 tracked
               Actual used: [1  ] cloves    ← shortfall — editable
Tinned tomatoes 300g   (not tracked)         ← not in pantry, skip

── Extra ingredients ────────────────────
                              [＋ Add extra]
[name ___________] [qty __] [unit ▾]  ✕     ← appended rows

[Cancel]   [Confirm & save]
```

### Servings input
- Number input pre-filled with `_targetServings` (the detail view's current serving count).
- `onchange` calls `Recipes._cookRefresh(recipeId, this.value)` which re-renders only the `#cook-ing-rows` section without closing the modal.

### Ingredient rows — three states

**Normal** (`pantryQty >= scaledQty`, same base unit):
- Shows item name, scaled qty, pantry qty after deduction
- No input needed

**Shortfall** (`pantryQty < scaledQty`, same base unit, pantry has some stock):
- Orange/amber highlight
- Shows "⚠ only X tracked"
- Editable `#cook-actual-N` number input pre-filled with `pantryItem.qty` (in pantry's unit)
- Label clarifies: "Actual used (max: X unit)"
- On confirm: deducts `actualUsed` amount; remaining = `max(0, pantry.qty - actualUsed)`

**Not tracked** (no pantry entry, or qty = 0):
- Shown greyed out with "not tracked" label
- No deduction

### Unit compatibility
Both the scaled ingredient qty and the pantry qty are normalised to base units via `Data.normalizeToBase` before comparison. If base units differ (e.g. recipe uses `g`, pantry uses `item`) — treat as **not tracked** (skip deduction).

For **normal** deductions: convert remaining back to pantry's original unit before calling `setPantryItem`:
- Pantry was `kg`, deduction was `g` → remaining in `g` → divide by 1000 → store as `kg`
- Pantry was `l`, deduction was `ml` → divide by 1000 → store as `l`
- Otherwise store in base unit

For **shortfall** deductions: the input is already in pantry units, so `remaining = max(0, pantry.qty - actualUsed)` in pantry units directly.

### Extra ingredients section
- "＋ Add extra" button appends a row: plain text name input, qty number input, unit select (same list as ad-hoc shopping items), remove (✕) button.
- Each row identified by an incrementing counter `_cookExtraCount`.
- On confirm, extras with a name are deducted from pantry using the same normal/shortfall/not-tracked logic as recipe ingredients.
- Extras are NOT shown in the ingredient rows section — they appear below in their own section.

---

## On "Confirm & save"

1. Read `servings` from `#cook-servings-input`.
2. Parse recipe ingredients via `parseIngredients`. Scale each: `scaledQty = base.qty * (servings / baseServings)`.
3. For each ingredient:
   - Look up pantry via `Data.getPantryItem(name)`
   - Normalise both quantities to base units
   - If base units differ or no pantry entry: skip
   - If shortfall: read `#cook-actual-N` input; deduct that amount (pantry units)
   - If normal: deduct scaled qty (converting back to pantry unit)
4. For each extra ingredient row with a name: same deduction logic.
5. Call `Data.logCook({ date: today, recipeId, recipeName, servings, baseServings })`.
6. `App.closeModal()`; `App.toast('Cooked ✓')`; `App.refresh()`.

---

## Analytics — Recent Cooks Section

Added to the existing `render()` in `js/analytics.js`, below the Recent Shops section.

```
── Recent Cooks ─────────────────
18 Jun  Spaghetti Bolognese   4 servings
17 Jun  Banana Oat Pancakes   2 servings
```

- Shows last 10 entries, newest first.
- Format: `_fmtDate(entry.date)` · recipe name · `N servings`.
- Empty state: "No cooks logged yet. Use 'Just cooked this' on any recipe."

---

## Files Changed Summary

| File | Change |
|---|---|
| `js/data.js` | Add `cookLog: []` to `_db`; add `logCook`, `getCookLog`; export both |
| `js/recipes.js` | Add `_esc` helper; add "Just cooked this" button in `openDetail()`; add `openCookConfirm(id)`, `_cookRefresh(id, servings)`, `_cookAddExtra()`, `confirmCook(id)` |
| `js/analytics.js` | Add Recent Cooks section to `render()` |
| `css/style.css` | Add cook modal styles (shortfall highlight, not-tracked muted style, extras section) |
