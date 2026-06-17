# Batch 4 Features — Design Spec

**Date:** 2026-06-17
**Status:** Approved

---

## Overview

Three interconnected features for the meal planner and shopping list, plus a planner UI revision. All changes are in vanilla JS/CSS — no build step, no new dependencies.

---

## Feature 1 — Serving-aware shopping list

### What

When generating the shopping list, ingredient quantities are scaled to reflect how many servings are actually needed that week, not just a flat sum per recipe.

### Logic

Each meal slot counts as **1 serving**. For each unique recipe in the week's plan:

```
multiplier = slotsUsed / recipe.servings
```

Examples:
- Greek Salad (2 servings) in 3 slots → multiplier = 3 ÷ 2 = 1.5×
- Bolognese (4 servings) in 2 slots → multiplier = 2 ÷ 4 = 0.5×
- Any recipe with 1 serving in 1 slot → multiplier = 1.0 (unchanged)

If `recipe.servings` is 0 or absent, treat it as 1 (no scaling).

### Shopping list source sub-line

The existing `sources` array (added in Batch 3) gains a `context` string per source entry to explain the multiplier:

```js
// Meal slot source:
{ recipe: 'Greek Salad', qty: 1.5, unit: '', context: '3 of 2-serving recipe' }

// Treat source:
{ recipe: 'Brownies', qty: 400, unit: 'g', context: '2 batches' }
```

Display format (in `shopping.js`):

> **Beef mince** — 375g
> Bolognese 375g *(2 of 4-serving recipe)*

> **Flour** — 600g
> Brownies 400g *(2 batches)* · Chocolate Cake 200g *(1 batch)*

The `context` field is appended in italics-style parentheses after the qty/unit.

### Backward compat

Existing items in localStorage without a `context` field on sources render as before (no parenthetical). Existing shopping list items without a `sources` field are unaffected.

---

## Feature 2 — Treats tab

### What

Each week in the planner gets a **Treats** tab where the user adds batch-baked recipes to prep for the week (e.g. 1 batch of Brownies, 2 batches of Chocolate Cake). Treats are full recipes from the recipe book, scaled by a batch multiplier, and contribute to the shopping list.

### Data shape

The `treats` array is added at the **week level** inside `mealPlan`:

```js
mealPlan.week1 = {
  monday:    { breakfast: '', lunch: '', dinner: '' },
  tuesday:   { ... },
  // ...
  treats: [
    { recipeId: 'r_004', batches: 1 },
    { recipeId: 'r_005', batches: 2 },
  ]
}
```

**Backward compat:** Old data without `treats` reads as `[]`. `Data.load()` does not need migration — callers use `wk.treats || []`.

### UI

The Treats tab shows:
- A list of current treats for the week. Each treat row:
  - Recipe name
  - Batch stepper: `[−] 2 batches [+]` (minimum 1)
  - Remove button (`×`)
- An **＋ Add treat** button at the bottom

Clicking **＋ Add treat** opens the existing `#modal-overlay` with a recipe picker `<select>` (all recipes, alphabetical) defaulting to the first recipe. On confirm, the treat is added with `batches: 1`.

If no treats are added, the tab shows an empty-state message: *"No treats this week. Tap ＋ to add one."*

### Shopping list integration

In `generateShoppingList()`, after processing meal slots, also process treats:

```js
(wk.treats || []).forEach(treat => {
  const r = Data.getRecipeById(treat.recipeId);
  if (!r) return;
  const batches = treat.batches || 1;
  Recipes.parseIngredients(r.ingredients).forEach(i => {
    const key = `${i.name.toLowerCase()}|${i.unit}`;
    if (!agg[key]) agg[key] = { name: i.name, unit: i.unit, qty: 0, sources: [] };
    const scaledQty = (parseFloat(i.qty) || 0) * batches;
    agg[key].qty += scaledQty;
    agg[key].sources.push({
      recipe: r.name,
      qty: scaledQty,
      unit: i.unit,
      context: `${batches} batch${batches !== 1 ? 'es' : ''}`,
    });
  });
});
```

### Persistence

Treats are saved via existing `Data.setMealSlot` is **not** used for treats. Add a new `Data` method:

```js
function setTreats(week, treats) {
  const wk = 'week' + week;
  _db.mealPlan[wk] = _db.mealPlan[wk] || {};
  _db.mealPlan[wk].treats = treats;
  save();
}
```

---

## Feature 3 — Planner UI revision

### What

Remove the Batch 3 multi-week desktop layout. Return to 1 week at a time on all screen sizes. Add inner-week tabs: **Meals** | **Treats** | **Summary** (placeholder).

### Tab structure

```
[ Week 1 ]  [ Week 2 ]  [ Week 3 ]  [ Week 4 ]
─────────────────────────────────────────────────
[ Meals ]  [ Treats ]  [ Summary ]
─────────────────────────────────────────────────
(content area)
```

**Week tabs** (existing) — select which week is shown. Switching weeks resets to the Meals inner tab.

**Inner tabs** (new) — switch content within the selected week:
- **Meals** — existing 7-day breakfast/lunch/dinner grid + recipe filter bar + Generate Shopping List button. Default active tab.
- **Treats** — treat list UI (Feature 2).
- **Summary** — placeholder card: *"📊 Calorie & cost summary — coming soon"*.

### State

Two module-level variables:
```js
let _currentWeek = 1;
let _currentTab  = 'meals'; // 'meals' | 'treats' | 'summary'
```

`showWeek(week, tabEl)` resets `_currentTab = 'meals'` then calls `render()`.
`showTab(tab)` sets `_currentTab = tab` then calls `render()`.

### HTML structure in index.html

The planner view gets a static inner-tab bar inserted between the week tabs and the grid. Mirrors the existing week-tab pattern:

```html
<!-- inner-week tabs (new) -->
<div class="inner-tabs">
  <button class="inner-tab active" data-tab="meals"   onclick="Planner.showTab('meals')">Meals</button>
  <button class="inner-tab"        data-tab="treats"  onclick="Planner.showTab('treats')">Treats</button>
  <button class="inner-tab"        data-tab="summary" onclick="Planner.showTab('summary')">Summary</button>
</div>
```

The recipe filter bar (`#planner-filter-bar`) and generate button (`#btn-generate-shopping`) remain as static HTML. They are hidden via CSS when the active inner tab is not `meals` — `render()` adds/removes a `.meals-active` class on `#view-planner` and CSS rules show/hide accordingly:

```css
#view-planner:not(.meals-active) .planner-filter-bar,
#view-planner:not(.meals-active) .planner-actions { display: none; }
```

### render() behaviour

`render()` always renders a single week (no desktop branch):

```js
function render() {
  // update inner-tab active states
  document.querySelectorAll('.inner-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === _currentTab)
  );
  // show/hide filter bar and generate button
  const plannerView = document.getElementById('view-planner');
  if (plannerView) plannerView.classList.toggle('meals-active', _currentTab === 'meals');
  // update generate button label
  _updateGenBtn();
  // render content
  if (_currentTab === 'meals')   _renderMeals();
  if (_currentTab === 'treats')  _renderTreats();
  if (_currentTab === 'summary') _renderSummary();
}
```

### Removals from Batch 3

- `_renderAll()` function — deleted
- `_isDesktop()` helper — deleted
- `generateForWeek()` function — deleted (and removed from return object)
- Per-section `🛒` mini-buttons in week section headers — deleted
- CSS: `.week-tabs { display: none }` inside `@media (min-width: 900px)` — deleted
- CSS: `.btn-mini-generate` rule — deleted
- CSS: `.planner-week-section`, `.planner-week-header`, `.planner-week-grid` rules — deleted (no longer needed)

The `#planner-grid` element in `index.html` remains as the content container. The week-tab buttons remain. The `btn-generate-shopping` button remains in the Meals tab.

### Generate Shopping List

Stays in the Meals tab. Button label: `🛒 Generate Week N List`. Generates ingredients from **both** meal slots AND treats for `_currentWeek`.

---

## Affected Files

| File | Changes |
|------|---------|
| `js/planner.js` | Remove `_renderAll`, `_isDesktop`, `generateForWeek`; add `_currentTab`, `showTab`, `_renderTreats`, `_renderSummary`, `_renderInnerTabs`; update `generateShoppingList` for serving-aware math + treats |
| `js/data.js` | Add `setTreats(week, treats)` method |
| `js/shopping.js` | Update source sub-line to render `context` field |
| `css/style.css` | Add inner-tab styles; remove Batch 3 desktop planner rules; add treat-row styles |
| `index.html` | Add inner-tab bar HTML inside planner view |

No new files. Schema change is backward-compatible (treats array is optional, defaults to `[]`).

---

## Out of Scope (future batches)

- Summary tab calorie/cost calculation (placeholder only)
- Price estimation tool
- Calorie tracking per ingredient
