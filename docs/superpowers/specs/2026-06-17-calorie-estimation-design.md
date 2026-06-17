# Calorie Estimation — Design Spec

**Date:** 2026-06-17
**Status:** Approved

---

## Overview

Add per-recipe calorie data to the app, sourced on demand from Spoonacular's ingredient-parsing API. Display calories in the recipe detail view, inline in planner meal slots, in the treats tab, and as a full day-by-day + weekly summary in the planner Summary tab.

---

## Data shape

One new field added to the recipe object:

```js
{
  // existing fields unchanged...
  kcalTotal: 1840, // total kcal for the full recipe (all servings). null = unknown.
}
```

All calorie values elsewhere are derived — never stored separately:

| Derived value | Formula |
|---|---|
| `kcalPerServing` | `kcalTotal / (recipe.servings \|\| 1)` |
| Planner slot kcal | `kcalPerServing` (1 slot = 1 serving) |
| Treat kcal | `kcalTotal * treat.batches` |

`kcalTotal: null` means no data has been entered or calculated yet.

---

## Calorie calculation

### Trigger

Calorie calculation is **never automatic**. It only fires when the user explicitly clicks **Calculate** (or **Recalculate**) inside the recipe add/edit form. It never fires on save.

### API call

Endpoint: `POST https://api.spoonacular.com/recipes/parseIngredients`

Parameters:
- `ingredientList` — the recipe's semicolon-separated ingredient string converted to newline-separated (replace `; ` with `\n`)
- `servings=1`
- `includeNutrition=true`
- `apiKey` — from `localStorage.spoonacularKey`

Response: array of parsed ingredient objects. Each has `nutrition.nutrients` array. Sum the `amount` field for the entry where `name === 'Calories'` across all ingredients to get `kcalTotal`.

Cost: ~1 Spoonacular point per ingredient. A 10-ingredient recipe costs ~10 points.

### Failure handling

If the key is not set, the request fails, or the response contains no calorie data:
- Show a toast: *"Calorie calculation failed — check your Spoonacular key"*
- Leave `kcalTotal` unchanged (null if new, previous value if recalculating)

---

## Recipe form — calories row

The recipe add/edit form gains a **Calories** row below the servings field.

### State: unknown (`kcalTotal === null`)

```
Calories:  [ —  ]  [Enter manually]  [Calculate]
```

- **Enter manually**: reveals an inline number input. On confirm, saves the typed value as `kcalTotal`.
- **Calculate**: calls Spoonacular with the current ingredient list. On success, populates the field and saves.

### State: known (`kcalTotal` is set)

```
Calories:  [ 1,840 kcal ]  [Edit]  [Recalculate]
```

- **Edit**: reveals an inline number input pre-filled with the current value. On confirm, saves the new value.
- **Recalculate**: calls Spoonacular again with the current ingredient list, overwriting the existing value.

Both buttons are visible regardless of how `kcalTotal` was set (API or manual).

---

## Recipe detail view

A single line is added below the prep/cook time line:

```
Prep: 15 min  ·  Cook: 30 min  ·  1,840 kcal total  ·  460 kcal/serving
```

If `kcalTotal` is null: `— kcal` in place of the numbers.

---

## Planner — meal slots

Each meal slot in the Meals tab gains a small calorie label beneath the dropdown:

```
[ Breakfast         ]
[ Banana Pancakes ▼ ]
  230 kcal
```

- Only rendered when a recipe is selected for that slot
- If the selected recipe has `kcalTotal === null`: shows `— kcal`
- If the slot is empty: nothing rendered

---

## Planner — Treats tab

Each treat row gains a calorie value between the batch stepper and the remove button:

```
Brownies   [−] 2 batches [+]   4,800 kcal   ×
```

Formula: `kcalTotal * batches`. If `kcalTotal === null`: shows `— kcal`.

---

## Planner — Summary tab

Replaces the "Coming soon" placeholder with a full weekly breakdown.

### Layout

```
┌─────────────────────────────────────────────┐
│  Week 1 — Calorie Summary                   │
├───────────┬───────────────────┬─────────────┤
│ Monday    │ B·320  L·450  D·650│ 1,420 kcal │
│ Tuesday   │ B·230  L·500  D·780│ 1,510 kcal │
│ ...       │                   │            │
├───────────┴───────────────────┴─────────────┤
│ Meals total                    12,400 kcal  │
│ Treats                                      │
│   Brownies ×2 batches           4,800 kcal  │
│   Banana Bread ×1 batch         1,200 kcal  │
│ Treats total                    6,000 kcal  │
├─────────────────────────────────────────────┤
│ Week total                     18,400 kcal  │
└─────────────────────────────────────────────┘
```

### Rules

- All 7 days are always shown; days with no meals planned show 0 kcal
- Meal labels abbreviated: B = Breakfast, L = Lunch, D = Dinner
- If a slot has a recipe with `kcalTotal === null`, that slot contributes `0` to the day total with a `*` marker
- A footnote is shown if any `*` exists: *"* Calorie data missing for some recipes"*
- Treats section is omitted if no treats are planned
- If no meals and no treats are planned: show *"No meals planned for this week"*

---

## Affected files

| File | Changes |
|------|---------|
| `js/data.js` | Add `kcalTotal` to recipe schema; add `setRecipeCalories(id, kcal)` method |
| `js/recipes.js` | Add calories row to recipe form; Calculate/Recalculate/Edit buttons; Spoonacular fetch; show kcal in detail view |
| `js/planner.js` | Add kcal label to `_buildDayHtml`; update `_renderTreats` row; replace `_renderSummary` stub with full weekly breakdown |
| `css/style.css` | Styles for `.slot-kcal`, `.treat-kcal`, `.summary-table`, `.summary-total`, `.summary-footnote` |

No new files. `kcalTotal: null` on all existing recipes is backward-compatible — all display locations handle null gracefully.

---

## Out of scope

- Macro tracking (protein, carbs, fat)
- Price estimation
- Automatic calorie calculation on save
- Per-ingredient calorie editing
