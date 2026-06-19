# Sub-project D: Recipe Form UX Design Spec

## Goal

Replace the semicolon-delimited ingredients textarea and free-text method textarea in the recipe add/edit modal with structured, row-based inputs. Also fix the Spoonacular ingredient parser to handle concatenated unit strings like "1can".

---

## Scope

Three changes, all within `js/recipes.js` and `js/spoonacular.js`:

1. **Ingredient rows** — structured [qty] [unit] [name] inputs replacing the ingredients textarea
2. **Method step rows** — structured draggable step inputs replacing the method textarea
3. **Spoonacular "1can" fix** — extend `parseIngredients()` to handle container-type units

**Storage format is unchanged.** Ingredients remain stored as a semicolon-delimited string. Method remains stored as a newline-delimited string. No data migration required.

---

## Ingredient Rows

### Layout

Each ingredient row contains, left to right:

```
[qty: number input ~65px] [unit: select dropdown] [name: text input, flex] [✕ remove button]
```

A "＋ Add ingredient" button sits below the row list. The first row is always present (never removable if it's the only row — the ✕ is hidden when only one row exists, or allowed with validation on save).

### Unit dropdown options

```
g, 100g, kg, ml, 100ml, l, item, tsp, tbsp, clove, bunch, head, can, jar, bottle, bag, packet, loaf, dozen
```

(Extends the cook confirmation modal list with the new container units.)

### Editing an existing recipe

When `openEditModal(id)` is called, the stored `r.ingredients` string is parsed via `parseIngredients()` into `[{ qty, unit, name }]` objects. Each object renders as one pre-populated row. A recipe with no ingredients gets one blank row.

### Saving

On `saveModal()`, rows are read from the DOM and assembled into a semicolon-delimited string:

```js
// With unit:    "2 clove garlic"   → matches parser pattern 3
`${qty} ${unit} ${name}`
// Without unit: "1 onion"          → matches parser pattern 4
`${qty} ${name}`
```

Rows with an empty name are skipped. The assembled string is stored in `recipe.ingredients` exactly as before.

### New recipe

`openAddModal()` renders one blank ingredient row.

---

## Method Step Rows

### Layout

Each step row contains, left to right:

```
[⠿ drag handle] [step text input, flex] [✕ remove button]
```

A "＋ Add step" button sits below the row list.

### Step numbers

Step numbers are **not stored**. They are stripped on load and re-applied on display (unchanged from current behaviour). The input rows are un-numbered — the user types the step text only.

### Drag to reorder

Native HTML5 drag events (`draggable="true"`, `dragover`, `drop`) on each row. The drag handle is the only draggable trigger area (pointer style: `grab`). On drop, the dragged row is inserted before/after the target row. No library required.

### Editing an existing recipe

The stored `r.method` string is split by `\n`, each line is stripped of a leading step number pattern (`/^\d+\.\s*/`), and rendered as one pre-populated row. A recipe with no method gets one blank row.

### Saving

On `saveModal()`, step text values are read from the DOM and joined with `\n`. Empty rows are skipped. Stored in `recipe.method` exactly as before.

### New recipe

`openAddModal()` renders one blank step row.

---

## Spoonacular "1can" Fix

### Problem

Spoonacular sometimes produces ingredient strings like `"1can tomatoes"` or `"2cans beans"` where the unit is glued directly to the quantity digit. The current `UNITS` array in `parseIngredients()` does not include container-type units (`can`, `jar`, `bottle`, `bag`, `packet`), so these strings fall through all regex patterns and end up as name-only ingredients with no qty or unit.

### Fix

**In `parseIngredients()` (`js/recipes.js`):**

Add to the `UNITS` array:
```js
'cans', 'can', 'jars', 'jar', 'bottles', 'bottle', 'bags', 'bag', 'packets', 'packet',
```

Add to the `normaliseUnit()` map:
```js
cans: 'can', jars: 'jar', bottles: 'bottle', bags: 'bag', packets: 'packet',
```

With these additions, the existing regex patterns already handle `"1can tomatoes"` (pattern 2: `^(\d+)(UNIT)(.+)$`) and `"2 cans beans"` (pattern 3: `^(\d+)\s+(UNIT)\s+(.+)$`).

No changes required to `js/spoonacular.js`.

---

## Files Changed

| File | Change |
|---|---|
| `js/recipes.js` | Replace `rf-ing` textarea with dynamic ingredient rows; replace `rf-method` textarea with dynamic step rows; extend `UNITS` and `normaliseUnit`; add row-management helpers; update `_showModal`, `saveModal` |
| `css/style.css` | Add styles for `.ing-row`, `.step-row`, `.step-drag-handle` |

---

## Key Constraints

- Storage format unchanged — no migration, no breaking change to existing recipes
- `parseIngredients()` is used by shopping list, cook confirmation, calorie calculation — extending UNITS is purely additive and safe
- Drag reorder uses no external library — native HTML5 only
- The ingredient row ✕ button is always shown; empty rows are simply skipped on save
