# Batch 3 Features — Design Spec

**Date:** 2026-06-12  
**Status:** Approved

---

## Overview

Four features added to the Recipe Book PWA. All changes are in vanilla JS/CSS — no build step, no new dependencies, no new files beyond what already exists.

---

## Feature 1 — Servings Multiplier

### What

A stepper control `[−] 4 servings [+]` embedded in the recipe detail view meta row. Adjusting it scales ingredient quantities for that viewing session only. Nothing is saved to localStorage.

### UI

The stepper sits in `.detail-meta` alongside category/prep/cook info:
```
📂 Dinner  ·  👥 [−] 4 [+] servings  ·  ⏱ 15m prep  ·  🔥 45m cook
```

Minimum value is 1 serving. No maximum.

### Data flow

- On `openDetail(id)`: sets `_activeId = id` and `_targetServings = r.servings`.
- Ingredients are rendered via `_renderIngredients(multiplier)` where `multiplier = _targetServings / r.servings`.
- `Recipes.setServings(delta)`: increments/decrements `_targetServings`, clamps to 1, calls `_renderIngredients` to update only `#detail-ingredients` innerHTML. Does not re-render the full detail view (avoids scroll position reset).
- `fmtQty()` is called with `qty * multiplier` for each ingredient.

### Backward compat

No schema change. State is in-memory only.

---

## Feature 2 — Shopping List Source Breakdown

### What

Each item in the shopping list shows which recipe(s) contribute to it and how much. Example:

```
☐  500g beef mince
      from: Spaghetti Bolognese 500g · Beef Stir Fry 500g
☐  2 onions
      from: Spaghetti Bolognese 1 · Potato Soup 1
```

The sub-line is always visible (no expand/collapse).

### Data shape change

Shopping list items gain an optional `sources` array:

```js
{
  name: 'beef mince',
  unit: 'g',
  qty: 1000,
  recipes: 'Spaghetti Bolognese, Beef Stir Fry',   // kept for backward compat
  sources: [
    { recipe: 'Spaghetti Bolognese', qty: 500, unit: 'g' },
    { recipe: 'Beef Stir Fry', qty: 500, unit: 'g' },
  ],
  checked: false,
}
```

Items generated before this change (no `sources` field) fall back to the `recipes` string in the display.

### Changes

**`planner.js` — `generateShoppingList()`:**  
Change the aggregation map to also track `sources`:
```js
agg[key] = { name, unit, qty: 0, recipes: [], sources: [] };
// per ingredient:
agg[key].qty += parseFloat(i.qty) || 0;
agg[key].sources.push({ recipe: r.name, qty: parseFloat(i.qty) || 0, unit: i.unit });
```
When building the final items array, set both `recipes` (joined string) and `sources` (array).

**`shopping.js` — `render()`:**  
After the `<span class="shop-item-name">` element, render a source sub-line:
```js
const sourceText = item.sources
  ? item.sources.map(s => `${s.recipe}${s.qty ? ' ' + fmtQty(s.qty) + (s.unit || '') : ''}`).join(' · ')
  : (item.recipes || '');
// rendered as:
`<div class="shop-item-source">${sourceText}</div>`
```
Only render the sub-line if `sourceText` is non-empty.

**CSS:** `.shop-item-source` — small font (0.72rem), muted colour (`var(--text-muted)` or `#888`), left-padded to align under the item name.

---

## Feature 3 — "Add to Plan" Button on Recipe Detail

### What

A `📅 Add to Plan` button in the recipe detail action bar. Opens the existing modal overlay with a small form to pick week, day, and meal. On submit, calls `Data.setMealSlot()` and toasts success.

### UI (modal content)

```
Add "Spaghetti Bolognese" to Plan

Week     [ 1 ▾ ]
Day      [ Monday ▾ ]
Meal     [ Dinner ▾ ]

[Cancel]  [Add to Plan]
```

Defaults: week 1, Monday, dinner.

### Changes

**`recipes.js`:**

- `openDetail()`: adds `<button class="btn-secondary" onclick="Recipes.openAddToPlanModal('${r.id}')">📅 Add to Plan</button>` to `.detail-actions`.
- New `openAddToPlanModal(id)`: stores `_planTargetId = id`, builds modal HTML with three `<select>` elements (week 1-4, day, meal), renders into `#modal-content`, shows `#modal-overlay`.
- New `confirmAddToPlan()`: reads the three select values, calls `Data.setMealSlot(week, day, meal, _planTargetId)`, calls `App.closeModal()`, toasts `"Added to Week N, Day, Meal ✓"`.

No changes to `data.js` or `planner.js` needed.

---

## Feature 4 — Desktop 4-Week Stacked Planner + Planner Search Bar

### 4a — 4-week stacked layout (desktop only)

**Breakpoint:** `window.matchMedia('(min-width: 900px)')` — matches the existing desktop CSS breakpoint.

**`planner.js` changes:**

`render()` becomes:
```js
function render() {
  if (window.matchMedia('(min-width: 900px)').matches) {
    _renderAll();
  } else {
    showWeek(_currentWeek);
  }
}
```

New `_renderAll()`: iterates weeks 1–4, renders each as:
```html
<div class="planner-week-section" id="planner-week-{N}">
  <div class="planner-week-header">Week {N}</div>
  <div class="planner-week-grid">
    {day cards with selects — same structure as showWeek()}
  </div>
</div>
```

`showWeek(week, tabEl)`: tab active state is updated regardless of breakpoint. On desktop, scrolls to `#planner-week-{week}` with `scrollIntoView({ behavior: 'smooth', block: 'start' })` instead of re-rendering.

**`css/style.css` changes (inside `@media (min-width: 900px)`):**
```css
.planner-week-section { margin-bottom: 2rem; }
.planner-week-header {
  font-size: 0.8rem; font-weight: 700; letter-spacing: .06em;
  text-transform: uppercase; color: var(--dk-green);
  padding: 6px 0 4px; border-bottom: 2px solid var(--lt-green);
  margin-bottom: 8px;
}
.planner-week-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
}
/* #planner-grid no longer needs to be a grid itself on desktop */
#planner-grid { display: block; }
```

### 4b — Planner search/filter bar

A single text input at the top of the planner view that filters which recipes appear in all slot dropdowns on the current view. On desktop (all 4 weeks visible), filters across all 4 weeks.

**`planner.js`:**
- Add module-level `_recipeFilter = ''` variable.
- New `filterRecipes()` function: reads `#planner-recipe-filter` value, stores in `_recipeFilter`, calls `render()` to rebuild all selects with filtered options.
- In `showWeek()` and `_renderAll()`, when building `<option>` elements filter the recipes array: `recipes.filter(r => !_recipeFilter || r.name.toLowerCase().includes(_recipeFilter.toLowerCase()))`. The `— none —` option is always included regardless of filter.

This approach keeps a single source of truth: the rendered selects always match the data. No DOM option-hiding needed.

**`index.html`:**  
Add a search input above the planner grid, inside the planner view section:
```html
<div class="planner-filter-bar">
  <input id="planner-recipe-filter" type="search" placeholder="Filter recipes…"
    oninput="Planner.filterRecipes()" />
</div>
```

**CSS:** `.planner-filter-bar` — full-width input, styled consistently with `#recipe-search`, small top margin.

---

## Affected Files Summary

| File | Changes |
|------|---------|
| `js/recipes.js` | Servings stepper state + `setServings()`, `_renderIngredients()`; Add to Plan modal (`openAddToPlanModal`, `confirmAddToPlan`) |
| `js/planner.js` | `render()` breakpoint branch, new `_renderAll()`, `showWeek()` scroll-on-desktop, `filterRecipes()` |
| `js/shopping.js` | `render()` source sub-line |
| `js/data.js` | No changes needed |
| `css/style.css` | `.planner-week-section`, `.planner-week-header`, `.planner-week-grid`, `.shop-item-source`, `.planner-filter-bar`, servings stepper button styles |
| `index.html` | `#planner-recipe-filter` input in planner view |

No new files. No schema migrations — all changes are backward-compatible with existing localStorage data.
