# Sub-project D: Price Book Intelligence Design Spec

## Goal

Two features: (1) automatically create placeholder price book entries when a recipe is added, so every ingredient has a price book card ready to fill in; (2) show which price book entries are not referenced by any current recipe, so stale entries can be cleaned up after deleting recipes.

---

## Feature 1: Auto-create Price Book Entries on Recipe Add

### Trigger

Fires whenever a new recipe is saved — both from manual creation (`recipes.js` → `saveModal()`) and Spoonacular import (`spoonacular.js`). Does NOT fire on recipe updates (editing an existing recipe).

### Hook sites

- `js/recipes.js` line ~358: after `const saved = Data.addRecipe(recipe);` add:
  ```js
  Data.ensurePriceBookEntries(parseIngredients(recipe.ingredients));
  ```
  (`parseIngredients` is available directly inside the Recipes IIFE without a prefix.)

- `js/spoonacular.js` line ~147: after `Data.addRecipe(recipe);` add:
  ```js
  Data.ensurePriceBookEntries(Recipes.parseIngredients(recipe.ingredients));
  ```
  (`Recipes` is a global; spoonacular.js loads after recipes.js.)

### New function: `Data.ensurePriceBookEntries(parsedIngredients)`

Added to `js/data.js`, exported in the return statement.

**Algorithm:**

```js
const STRIP_WORDS = /\b(large|small|medium|big|fresh|frozen|dried|diced|chopped|minced|sliced|ground|grated|boneless|skinless|lean|extra|finely|roughly|thinly|thick)\b/gi;

function ensurePriceBookEntries(parsedIngredients) {
  if (!_db.priceBook) _db.priceBook = [];
  let added = false;
  (parsedIngredients || []).forEach(item => {
    if (!item.name) return;
    const normalised = item.name.replace(STRIP_WORDS, '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!normalised) return;
    if (lookupPriceEntry(normalised)) return; // already exists (exact or substring match)
    _db.priceBook.push({ ingredient: normalised, prices: [] });
    added = true;
  });
  if (added) save();
}
```

**Key details:**
- `STRIP_WORDS` removes common size/preparation adjectives before lookup and creation
- Uses existing `lookupPriceEntry(normalised)` which does exact match first, then substring match — so "large onion" normalises to "onion" and finds existing "onion" entry correctly; "large onion" not found → normalises to "onion" → creates "onion"
- Created entries have `prices: []` — no price data, just a placeholder card
- `save()` is only called if at least one new entry was added (avoids spurious saves)
- No toast or UI notification — silent background operation

---

## Feature 2: Orphan Detection in Price Book View

### Definition

An ingredient is **orphaned** if no recipe in the current recipe list references it. Matching is generous (substring both ways) to avoid false orphans:

```
isOrphaned = true if for ALL recipe ingredients ri:
  NOT (ri.includes(pbIngredient)) AND NOT (pbIngredient.includes(ri))
```

### Implementation in `js/prices.js`

**Module-level variable:**
```js
let _showOrphansOnly = false;
```

**In `render()`**, before rendering cards, build the set of recipe ingredient names and an orphan-check function:

```js
const _recipeIngredients = (() => {
  const names = new Set();
  Data.getRecipes().forEach(r => {
    Recipes.parseIngredients(r.ingredients).forEach(i => {
      if (i.name) names.add(i.name.toLowerCase());
    });
  });
  return names;
})();

function _isOrphaned(ingredientName) {
  const lower = ingredientName.toLowerCase();
  for (const ri of _recipeIngredients) {
    if (ri.includes(lower) || lower.includes(ri)) return false;
  }
  return true;
}
```

**Orphan badge on cards:** When rendering each `pb-card`, check `_isOrphaned(card.ingredient)`. If true, append a badge inside `.pb-card-header` next to the ingredient name:
```html
<span class="pb-orphan-badge">no recipes</span>
```

**Filter when `_showOrphansOnly` is true:** in the filtered list computation, additionally filter by `_isOrphaned`.

**New function: `toggleOrphans()`:**
```js
function toggleOrphans() {
  _showOrphansOnly = !_showOrphansOnly;
  const btn = document.getElementById('pb-orphan-toggle');
  if (btn) btn.classList.toggle('active', _showOrphansOnly);
  render();
}
```

### HTML change (`index.html`)

The price book section header currently has a single `＋ Add` button. Change to use `.section-header-actions`:

```html
<div class="section-header">
  <h2>Price Book</h2>
  <div class="section-header-actions">
    <button class="btn-small" id="pb-orphan-toggle" onclick="PriceBook.toggleOrphans()">Orphans only</button>
    <button class="btn-small" onclick="PriceBook.openAddIngredientForm()">＋ Add</button>
  </div>
</div>
```

### CSS (`css/style.css`)

Append two rules:

```css
.pb-orphan-badge { font-size:0.7rem; background:#fef3c7; color:#92400e; border-radius:4px; padding:1px 6px; margin-left:6px; vertical-align:middle; }
.btn-small.active { background:var(--md-green); color:#fff; }
```

---

## Files Changed Summary

| File | Change |
|---|---|
| `js/data.js` | Add `STRIP_WORDS` constant + `ensurePriceBookEntries(parsedIngredients)` function; export it |
| `js/recipes.js` | After `Data.addRecipe(recipe)` in `saveModal()`, call `Data.ensurePriceBookEntries(parseIngredients(recipe.ingredients))` |
| `js/spoonacular.js` | After `Data.addRecipe(recipe)`, call `Data.ensurePriceBookEntries(Recipes.parseIngredients(recipe.ingredients))` |
| `js/prices.js` | Add `_showOrphansOnly` var, orphan set + check in `render()`, orphan badge on cards, orphan filter, `toggleOrphans()` function; export `toggleOrphans` |
| `index.html` | Price book header: wrap buttons in `.section-header-actions`, add orphan toggle button |
| `css/style.css` | Append `.pb-orphan-badge` and `.btn-small.active` rules |
