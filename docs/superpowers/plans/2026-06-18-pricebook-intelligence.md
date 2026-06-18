# Sub-project D: Price Book Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-create price book placeholder entries when a recipe is added, and show which price book entries are orphaned (not referenced by any recipe) so stale entries can be cleaned up.

**Architecture:** Four tasks — data API first, then recipe/spoonacular hooks, then the prices.js orphan UI, then HTML+CSS wiring. No new files needed. `ensurePriceBookEntries` lives in `data.js` and is called from `recipes.js` and `spoonacular.js`. Orphan detection is computed at render time in `prices.js` using `Recipes.parseIngredients` (available globally since `recipes.js` loads first).

**Tech Stack:** Vanilla JS IIFE modules, localStorage, `innerHTML` rendering, CSS flexbox.

---

### Task 1: `ensurePriceBookEntries` in `js/data.js`

**Files:**
- Modify: `js/data.js`

**Context:** This function takes an array of parsed ingredient objects `[{name, qty, unit}]`, normalises each name by stripping common descriptors, checks for an existing price book entry via `lookupPriceEntry` (which already does exact + substring matching), and creates a placeholder entry if none found.

- [ ] **Step 1: Add `STRIP_WORDS` constant and `ensurePriceBookEntries` function**

  Find this comment and function in `js/data.js`:
  ```js
  // ── Price Book CRUD ──────────────────
  function getPriceBook() { return _db.priceBook || []; }
  ```

  Insert the constant and new function before the `// ── Price Book CRUD` comment:
  ```js
  const STRIP_WORDS = /\b(large|small|medium|big|fresh|frozen|dried|diced|chopped|minced|sliced|ground|grated|boneless|skinless|lean|extra|finely|roughly|thinly|thick)\b/gi;

  function ensurePriceBookEntries(parsedIngredients) {
    if (!_db.priceBook) _db.priceBook = [];
    let added = false;
    (parsedIngredients || []).forEach(item => {
      if (!item.name) return;
      const normalised = item.name.replace(STRIP_WORDS, '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (!normalised) return;
      if (lookupPriceEntry(normalised)) return;
      _db.priceBook.push({ ingredient: normalised, prices: [] });
      added = true;
    });
    if (added) save();
  }

  // ── Price Book CRUD ──────────────────
  function getPriceBook() { return _db.priceBook || []; }
  ```

- [ ] **Step 2: Export `ensurePriceBookEntries` from the return statement**

  Current return (lines 572–578):
  ```js
  return {
    load, save, getRecipes, getPlan, getPantry, getShoppingList,
    addRecipe, updateRecipe, deleteRecipe, getRecipeById,
    setMealSlot, setShoppingList, setTreats, setRecipeCalories, toggleShoppingItem,
    isDriveConnected, connectDrive, disconnectDrive, syncDrive,
    exportJSON, importJSON, handleImportFile, clearAll,
    loadStarterData, loadStarterPrices, getClientId, setClientId,
    getPriceBook, setPriceEntry, removePriceEntry, removeIngredient,
    lookupPriceEntry, lookupPrice,
    setPantryItem, removePantryItem, clearPantryPerishables, getPantryItem,
    getSpendLog, logSpend, clearSpendLog,
    DAYS, MEALS,
  };
  ```

  Change to:
  ```js
  return {
    load, save, getRecipes, getPlan, getPantry, getShoppingList,
    addRecipe, updateRecipe, deleteRecipe, getRecipeById,
    setMealSlot, setShoppingList, setTreats, setRecipeCalories, toggleShoppingItem,
    isDriveConnected, connectDrive, disconnectDrive, syncDrive,
    exportJSON, importJSON, handleImportFile, clearAll,
    loadStarterData, loadStarterPrices, getClientId, setClientId,
    getPriceBook, setPriceEntry, removePriceEntry, removeIngredient,
    lookupPriceEntry, lookupPrice, ensurePriceBookEntries,
    setPantryItem, removePantryItem, clearPantryPerishables, getPantryItem,
    getSpendLog, logSpend, clearSpendLog,
    DAYS, MEALS,
  };
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add js/data.js
  git commit -m "feat(data): add ensurePriceBookEntries — auto-create price book placeholders"
  ```

---

### Task 2: Hook recipe save and Spoonacular import

**Files:**
- Modify: `js/recipes.js` (line ~358)
- Modify: `js/spoonacular.js` (line ~147)

**Context:** Two call sites where `Data.addRecipe()` is called. Both need a follow-up call to sync the new recipe's ingredients into the price book. In `recipes.js` we're inside the `Recipes` IIFE so `parseIngredients` is called directly (no prefix). In `spoonacular.js` we're outside, so `Recipes.parseIngredients` is needed.

- [ ] **Step 1: Add hook in `js/recipes.js`**

  Find this block (around line 357–361):
  ```js
    } else {
      const saved = Data.addRecipe(recipe);
      App.toast('Recipe added ✓');
      openDetail(saved.id);
    }
  ```

  Change to:
  ```js
    } else {
      const saved = Data.addRecipe(recipe);
      Data.ensurePriceBookEntries(parseIngredients(recipe.ingredients));
      App.toast('Recipe added ✓');
      openDetail(saved.id);
    }
  ```

- [ ] **Step 2: Add hook in `js/spoonacular.js`**

  Find this block (around line 147–149):
  ```js
      Data.addRecipe(recipe);
      Recipes.render();
      App.toast(`"${d.title}" imported ✓`);
  ```

  Change to:
  ```js
      Data.addRecipe(recipe);
      Data.ensurePriceBookEntries(Recipes.parseIngredients(recipe.ingredients));
      Recipes.render();
      App.toast(`"${d.title}" imported ✓`);
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add js/recipes.js js/spoonacular.js
  git commit -m "feat(recipes,spoonacular): sync new recipe ingredients to price book"
  ```

---

### Task 3: Orphan detection and toggle in `js/prices.js`

**Files:**
- Modify: `js/prices.js`

**Context:** `prices.js` loads after `recipes.js`, so `Recipes.parseIngredients` is available. The orphan check is computed fresh on every `render()` call. A module-level `_showOrphansOnly` flag enables the filter toggle. `_esc` is already defined inside the PriceBook IIFE.

- [ ] **Step 1: Add `_showOrphansOnly` module-level variable**

  The current module-level variables are (lines 6–8):
  ```js
    let _filter = '';
    let _modalIngredientName = '';
    let _modalPriceIdx = null;
  ```

  Change to:
  ```js
    let _filter = '';
    let _showOrphansOnly = false;
    let _modalIngredientName = '';
    let _modalPriceIdx = null;
  ```

- [ ] **Step 2: Add orphan set and helper inside `render()` after `if (!el) return;`**

  Find in `render()`:
  ```js
    const el = document.getElementById('pricebook-list');
    if (!el) return;
    const filterLower = _filter.toLowerCase();
  ```

  Change to:
  ```js
    const el = document.getElementById('pricebook-list');
    if (!el) return;

    const _recipeIngredientNames = new Set();
    Data.getRecipes().forEach(r => {
      Recipes.parseIngredients(r.ingredients).forEach(i => {
        if (i.name) _recipeIngredientNames.add(i.name.toLowerCase());
      });
    });
    const isOrphaned = ingredientName => {
      const lower = ingredientName.toLowerCase();
      for (const ri of _recipeIngredientNames) {
        if (ri.includes(lower) || lower.includes(ri)) return false;
      }
      return true;
    };

    const filterLower = _filter.toLowerCase();
  ```

- [ ] **Step 3: Apply orphan filter after the existing `filtered` declaration**

  Find in `render()`:
  ```js
    const filtered = filterLower
      ? entries.filter(e => e.ingredient.toLowerCase().includes(filterLower))
      : entries;
  ```

  Change to:
  ```js
    let filtered = filterLower
      ? entries.filter(e => e.ingredient.toLowerCase().includes(filterLower))
      : entries.slice();
    if (_showOrphansOnly) filtered = filtered.filter(e => isOrphaned(e.ingredient));
  ```

- [ ] **Step 4: Update the empty state message to handle orphan filter**

  Find in `render()`:
  ```js
    if (filtered.length === 0) {
      el.innerHTML = `<div class="empty-state"><span class="emoji">💰</span>${
        filterLower ? 'No matches.' : 'No prices yet. Tap ＋ Add to get started.'
      }</div>
      <button class="pb-add-ingredient-btn" onclick="PriceBook.openAddIngredientForm()">＋ Add ingredient</button>`;
      return;
    }
  ```

  Change to:
  ```js
    if (filtered.length === 0) {
      el.innerHTML = `<div class="empty-state"><span class="emoji">💰</span>${
        filterLower || _showOrphansOnly ? 'No matches.' : 'No prices yet. Tap ＋ Add to get started.'
      }</div>
      <button class="pb-add-ingredient-btn" onclick="PriceBook.openAddIngredientForm()">＋ Add ingredient</button>`;
      return;
    }
  ```

- [ ] **Step 5: Add orphan badge to each card**

  Find in the `filtered.map(card => {` block:
  ```js
      const realIdx = entries.indexOf(card);
      const priceRows = card.prices.map((p, pIdx) => {
  ```

  Change to:
  ```js
      const realIdx = entries.indexOf(card);
      const orphanBadge = isOrphaned(card.ingredient)
        ? `<span class="pb-orphan-badge">no recipes</span>` : '';
      const priceRows = card.prices.map((p, pIdx) => {
  ```

  Then find where the ingredient name is rendered in the card header:
  ```js
          <span class="pb-card-name">${_esc(card.ingredient)}</span>
  ```

  Change to:
  ```js
          <span class="pb-card-name">${_esc(card.ingredient)}${orphanBadge}</span>
  ```

- [ ] **Step 6: Add `toggleOrphans()` function**

  Add after the existing `filter()` function:
  ```js
  function toggleOrphans() {
    _showOrphansOnly = !_showOrphansOnly;
    const btn = document.getElementById('pb-orphan-toggle');
    if (btn) btn.classList.toggle('active', _showOrphansOnly);
    render();
  }
  ```

- [ ] **Step 7: Export `toggleOrphans` from the return statement**

  Current return (line 223):
  ```js
    return { render, filter, openAddIngredientForm, saveNewIngredient, openAddPriceForm, openEditPriceForm, savePrice, removePrice, removeIngredient };
  ```

  Change to:
  ```js
    return { render, filter, toggleOrphans, openAddIngredientForm, saveNewIngredient, openAddPriceForm, openEditPriceForm, savePrice, removePrice, removeIngredient };
  ```

- [ ] **Step 8: Commit**

  ```bash
  git add js/prices.js
  git commit -m "feat(prices): orphan detection — badge on unused entries, toggle filter"
  ```

---

### Task 4: HTML and CSS wiring

**Files:**
- Modify: `index.html`
- Modify: `css/style.css`

- [ ] **Step 1: Update price book header in `index.html`**

  Find (around line 151–155):
  ```html
      <!-- PRICE BOOK -->
      <section id="view-pricebook" class="view">
        <div class="section-header">
          <h2>Price Book</h2>
          <button class="btn-small" onclick="PriceBook.openAddIngredientForm()">＋ Add</button>
        </div>
  ```

  Change to:
  ```html
      <!-- PRICE BOOK -->
      <section id="view-pricebook" class="view">
        <div class="section-header">
          <h2>Price Book</h2>
          <div class="section-header-actions">
            <button class="btn-small" id="pb-orphan-toggle" onclick="PriceBook.toggleOrphans()">Orphans only</button>
            <button class="btn-small" onclick="PriceBook.openAddIngredientForm()">＋ Add</button>
          </div>
        </div>
  ```

- [ ] **Step 2: Append CSS rules to `css/style.css`**

  Append at the end of the file:
  ```css

  /* ── Price Book orphan badge ───────────────────────────── */
  .pb-orphan-badge { font-size:0.7rem; background:#fef3c7; color:#92400e; border-radius:4px; padding:1px 6px; margin-left:6px; vertical-align:middle; }
  .btn-small.active { background:var(--md-green); color:#fff; }
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add index.html css/style.css
  git commit -m "feat(html,css): price book orphan toggle button and badge styles"
  ```
