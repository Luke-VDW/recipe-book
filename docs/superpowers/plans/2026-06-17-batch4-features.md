# Batch 4 Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add serving-aware shopping list scaling, a treats tab per week, and a revised planner UI with inner tabs (Meals / Treats / Summary).

**Architecture:** All changes are in the existing IIFE modules — no new files, no build step. `planner.js` owns the planner UI and shopping list generation; `data.js` gains one new method (`setTreats`); `shopping.js` gets a small rendering update. The planner reverts from the Batch 3 multi-week desktop layout to a single-week view on all screen sizes, and gains inner-week tab navigation.

**Tech Stack:** Vanilla HTML/CSS/JS, no framework, no bundler. LocalStorage for persistence. `innerHTML` for all rendering.

---

## Codebase context (read before starting any task)

The app is a single-page PWA with six IIFE modules loaded via `<script>` tags. Each module returns a public API object. All state lives in `Data._db`, persisted to `localStorage` via `Data.save()` on every mutation.

Key API used across tasks:
- `Data.getPlan()` → `{ week1..week4: { monday..sunday: { breakfast, lunch, dinner }, treats: [{recipeId, batches}] } }`
- `Data.getRecipes()` → array of recipe objects with `.id`, `.name`, `.servings`, `.ingredients`
- `Data.getRecipeById(id)` → recipe or null
- `Data.setMealSlot(week, day, meal, recipeId)` → saves one slot
- `Data.setShoppingList(items)` → replaces the full shopping list
- `Recipes.parseIngredients(text)` → `[{qty, unit, name}]`
- `App.toast(msg, type?)` — shows toast
- `App.closeModal()` — hides `#modal-overlay`
- `App.nav(view, btnEl)` — navigates to a view

The existing `#modal-overlay` / `#modal-content` pattern is used for modals throughout. The `#planner-grid` div is the content area for the planner view.

---

## File map

| File | Changes |
|------|---------|
| `js/planner.js` | Remove Batch 3 desktop code; add `_currentTab`, `showTab`, inner-tab rendering, `_renderMeals`, `_renderTreats`, `_renderSummary`, treat CRUD functions; rewrite `generateShoppingList` |
| `js/data.js` | Add `setTreats(week, treats)` |
| `js/shopping.js` | Update source sub-line to render `context` field |
| `css/style.css` | Remove Batch 3 desktop planner CSS; add inner-tab, treat-row, summary-placeholder styles |
| `index.html` | Add inner-tab bar HTML in planner section |

---

## Task 1: Revert to single-week planner + inner tab infrastructure

**Files:**
- Modify: `js/planner.js`
- Modify: `index.html`
- Modify: `css/style.css`

**Scene:** `planner.js` currently has `_isDesktop()`, `_renderAll()`, and `generateForWeek()` from Batch 3 that render all 4 weeks on desktop. This task removes those and introduces inner-week tabs (Meals / Treats / Summary).

- [ ] **Step 1: Replace `js/planner.js` with the single-week + inner-tab version**

Write the complete new `js/planner.js`:

```js
/* ══════════════════════════════════════
   planner.js — 4-week meal planner
   ══════════════════════════════════════ */

const Planner = (() => {

  let _currentWeek = 1;
  let _currentTab  = 'meals'; // 'meals' | 'treats' | 'summary'
  let _recipeFilter = '';
  let _filterTimer = null;

  const DAY_LABELS = {
    monday:'Monday', tuesday:'Tuesday', wednesday:'Wednesday',
    thursday:'Thursday', friday:'Friday', saturday:'Saturday', sunday:'Sunday',
  };
  const MEAL_LABELS = { breakfast:'Breakfast', lunch:'Lunch', dinner:'Dinner' };

  function _buildDayHtml(week, day, dayData, filteredRecipes) {
    const slots = Data.MEALS.map(meal => {
      const selected = dayData[meal] || '';
      const savedRecipe = selected ? Data.getRecipeById(selected) : null;
      const slotRecipes = (savedRecipe && !filteredRecipes.find(r => r.id === selected))
        ? [savedRecipe, ...filteredRecipes]
        : filteredRecipes;
      return `
      <div class="meal-slot">
        <span class="meal-label">${MEAL_LABELS[meal]}</span>
        <select onchange="Planner.setSlot(${week},'${day}','${meal}',this.value)">
          <option value="" ${!selected ? 'selected' : ''}>— none —</option>
          ${slotRecipes.map(r =>
            `<option value="${r.id}" ${selected === r.id ? 'selected' : ''}>${r.name}</option>`
          ).join('')}
        </select>
      </div>`;
    }).join('');
    return `
    <div class="planner-day">
      <div class="planner-day-header">${DAY_LABELS[day]}</div>
      ${slots}
    </div>`;
  }

  function render() {
    document.querySelectorAll('.inner-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.tab === _currentTab)
    );
    const plannerView = document.getElementById('view-planner');
    if (plannerView) plannerView.classList.toggle('meals-active', _currentTab === 'meals');
    const genBtn = document.getElementById('btn-generate-shopping');
    if (genBtn) genBtn.textContent = `🛒 Generate Week ${_currentWeek} List`;
    if (_currentTab === 'meals')   _renderMeals();
    if (_currentTab === 'treats')  _renderTreats();
    if (_currentTab === 'summary') _renderSummary();
  }

  function showWeek(week, tabEl) {
    _currentWeek = week;
    _currentTab = 'meals';
    if (tabEl) {
      document.querySelectorAll('.week-tab').forEach(t => t.classList.remove('active'));
      tabEl.classList.add('active');
    }
    render();
  }

  function showTab(tab) {
    _currentTab = tab;
    render();
  }

  function _renderMeals() {
    const plan = Data.getPlan();
    const wk   = plan['week' + _currentWeek] || {};
    const filterLower = _recipeFilter.toLowerCase();
    const recipes = Data.getRecipes().filter(r =>
      !filterLower || r.name.toLowerCase().includes(filterLower)
    );
    const el = document.getElementById('planner-grid');
    if (!el) return;
    el.innerHTML = Data.DAYS.map(day =>
      _buildDayHtml(_currentWeek, day, wk[day] || {}, recipes)
    ).join('');
  }

  function _renderTreats() {
    const el = document.getElementById('planner-grid');
    if (!el) return;
    // Implemented fully in Task 2 — stub for now
    el.innerHTML = `<div class="empty-state"><span class="emoji">🍰</span>No treats this week. Tap ＋ to add one.</div>
    <button class="btn-secondary treat-add-btn" onclick="Planner.openAddTreatModal()">＋ Add treat</button>`;
  }

  function _renderSummary() {
    const el = document.getElementById('planner-grid');
    if (!el) return;
    el.innerHTML = `
    <div class="summary-placeholder">
      <span class="emoji">📊</span>
      <p>Calorie &amp; cost summary</p>
      <p class="text-muted">Coming soon</p>
    </div>`;
  }

  function filterRecipes() {
    clearTimeout(_filterTimer);
    _filterTimer = setTimeout(() => {
      _recipeFilter = (document.getElementById('planner-recipe-filter')?.value || '').trim();
      render();
    }, 250);
  }

  function setSlot(week, day, meal, recipeId) {
    Data.setMealSlot(week, day, meal, recipeId);
  }

  function openAddTreatModal() {
    // Implemented in Task 2
    App.toast('Treats coming in next step', 'warn');
  }

  function generateShoppingList() {
    const plan   = Data.getPlan();
    const wk     = plan['week' + _currentWeek] || {};

    const usedIds = new Set();
    Data.DAYS.forEach(d => {
      Data.MEALS.forEach(m => {
        const id = (wk[d] || {})[m];
        if (id) usedIds.add(id);
      });
    });

    if (usedIds.size === 0) {
      App.toast('No meals planned for this week.', 'warn');
      return;
    }

    const agg = {};
    usedIds.forEach(id => {
      const r = Data.getRecipeById(id);
      if (!r) return;
      const ings = Recipes.parseIngredients(r.ingredients);
      ings.forEach(i => {
        const key = `${i.name.toLowerCase()}|${i.unit}`;
        if (!agg[key]) agg[key] = { name: i.name, unit: i.unit, qty: 0, sources: [] };
        agg[key].qty += parseFloat(i.qty) || 0;
        agg[key].sources.push({ recipe: r.name, qty: parseFloat(i.qty) || 0, unit: i.unit });
      });
    });

    const items = Object.values(agg).map(i => ({
      name: i.name, unit: i.unit,
      qty: i.qty > 0 ? i.qty : '',
      sources: i.sources, checked: false,
    }));

    if (items.length === 0) {
      App.toast('Meals planned but no ingredients found — add ingredients to your recipes.', 'warn');
      return;
    }
    Data.setShoppingList(items);
    App.toast(`Shopping list generated (${items.length} items) ✓`);
    App.nav('shopping', document.querySelector('[data-view="shopping"]'));
    Shopping.render();
  }

  return { render, showWeek, showTab, setSlot, generateShoppingList, filterRecipes, openAddTreatModal };
})();
```

- [ ] **Step 2: Add inner-tab bar to `index.html`**

Find this block in `index.html`:
```html
      <div class="week-tabs">
        <button class="week-tab active" onclick="Planner.showWeek(1,this)">Week 1</button>
        <button class="week-tab" onclick="Planner.showWeek(2,this)">Week 2</button>
        <button class="week-tab" onclick="Planner.showWeek(3,this)">Week 3</button>
        <button class="week-tab" onclick="Planner.showWeek(4,this)">Week 4</button>
      </div>
      <div class="planner-filter-bar">
```

Replace with:
```html
      <div class="week-tabs">
        <button class="week-tab active" onclick="Planner.showWeek(1,this)">Week 1</button>
        <button class="week-tab" onclick="Planner.showWeek(2,this)">Week 2</button>
        <button class="week-tab" onclick="Planner.showWeek(3,this)">Week 3</button>
        <button class="week-tab" onclick="Planner.showWeek(4,this)">Week 4</button>
      </div>
      <div class="inner-tabs">
        <button class="inner-tab active" data-tab="meals"   onclick="Planner.showTab('meals')">Meals</button>
        <button class="inner-tab"        data-tab="treats"  onclick="Planner.showTab('treats')">Treats</button>
        <button class="inner-tab"        data-tab="summary" onclick="Planner.showTab('summary')">Summary</button>
      </div>
      <div class="planner-filter-bar">
```

- [ ] **Step 3: Update `css/style.css` — remove Batch 3 desktop planner rules, add new styles**

In `css/style.css`, inside the `@media (min-width: 900px)` block, find and **remove** this entire comment+rules block (lines 473–502):

```css
  /* Planner — all 4 weeks stacked vertically on desktop */
  #planner-grid { display: block; }
  .planner-week-section { margin-bottom: 2rem; }
  .planner-week-header {
    font-size: .8rem; font-weight: 700; letter-spacing: .06em;
    text-transform: uppercase; color: var(--dk-green);
    padding: 6px 0 4px; border-bottom: 2px solid var(--lt-green); margin-bottom: 8px;
  }
  .planner-week-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 10px;
  }
  .planner-week-grid .planner-day { margin-bottom: 0; overflow: visible; }
  /* Rounded corners when overflow:visible removes clip */
  .planner-week-grid .planner-day-header { border-radius: var(--radius) var(--radius) 0 0; }
  .planner-week-grid .meal-slot:last-child { border-radius: 0 0 var(--radius) var(--radius); }
  .meal-label { font-size: .65rem; }
  .btn-mini-generate {
    float: right;
    font-size: 0.75rem;
    padding: 2px 8px;
    background: var(--lt-green);
    border: 1px solid var(--border);
    border-radius: 4px;
    cursor: pointer;
    line-height: 1.4;
    color: var(--dk-green);
  }
  .week-tabs { display: none; }
```

Then, **after** the `/* ── WEEK TABS ── */` block (around line 209, after `.week-tab` rules), add the following new CSS:

```css
/* ── INNER TABS (Meals / Treats / Summary) ── */
.inner-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 12px;
  border-bottom: 2px solid var(--border);
}
.inner-tab {
  padding: 7px 16px;
  border: none;
  background: none;
  color: var(--text-muted);
  font-size: 0.85rem;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  font-weight: 500;
}
.inner-tab.active {
  color: var(--dk-green);
  border-bottom-color: var(--dk-green);
  font-weight: 700;
}

/* Hide meals-only controls when not on Meals tab */
#view-planner:not(.meals-active) .planner-filter-bar,
#view-planner:not(.meals-active) .planner-actions { display: none; }

/* ── SUMMARY PLACEHOLDER ── */
.summary-placeholder {
  text-align: center;
  padding: 48px 20px;
  color: var(--text-muted);
}
.summary-placeholder .emoji { font-size: 2rem; display: block; margin-bottom: 10px; }
.summary-placeholder .text-muted { font-size: 0.85rem; margin-top: 4px; }

/* ── TREAT ROW (stub styles, full styles in Task 2) ── */
.treat-add-btn { margin-top: 16px; width: 100%; }
```

- [ ] **Step 4: Verify in browser**

Open `http://localhost:8000` (run `python -m http.server 8000` from the pwa directory if not running). Hard-refresh (`Ctrl+Shift+R`).

Check:
- Planner shows Week 1 meal grid by default
- Inner tabs (Meals / Treats / Summary) appear below week tabs
- Clicking "Treats" shows the stub empty state + "＋ Add treat" button (toast "coming in next step" if clicked)
- Clicking "Summary" shows the placeholder card
- Clicking "Meals" returns to the meal grid
- The filter bar and Generate button are hidden on Treats/Summary tabs
- Switching weeks (Week 2, Week 3) resets to Meals tab
- Recipe filter still works on Meals tab
- Generate Shopping List still works

- [ ] **Step 5: Commit**

```bash
git add js/planner.js index.html css/style.css
git commit -m "feat: revert to single-week planner, add Meals/Treats/Summary inner tabs"
```

---

## Task 2: Treats data layer + treats tab UI

**Files:**
- Modify: `js/data.js`
- Modify: `js/planner.js`
- Modify: `css/style.css`

**Scene:** The treats tab currently shows a stub. This task implements the full treats UI: add/remove/adjust-batches, persisted to `Data`.

- [ ] **Step 1: Add `setTreats` to `js/data.js`**

In `js/data.js`, find the `setShoppingList` function:

```js
  function setShoppingList(items) {
    _db.shoppingList = items;
    save();
  }
```

Add `setTreats` immediately after it:

```js
  function setTreats(week, treats) {
    const wk = 'week' + week;
    _db.mealPlan[wk] = _db.mealPlan[wk] || {};
    _db.mealPlan[wk].treats = treats;
    save();
  }
```

Then add `setTreats` to the `return` object at the bottom of the `Data` IIFE. Find:

```js
    setMealSlot, setShoppingList, toggleShoppingItem,
```

Replace with:

```js
    setMealSlot, setShoppingList, setTreats, toggleShoppingItem,
```

- [ ] **Step 2: Implement `_renderTreats()` in `js/planner.js`**

Find the current stub `_renderTreats()`:

```js
  function _renderTreats() {
    const el = document.getElementById('planner-grid');
    if (!el) return;
    // Implemented fully in Task 2 — stub for now
    el.innerHTML = `<div class="empty-state"><span class="emoji">🍰</span>No treats this week. Tap ＋ to add one.</div>
    <button class="btn-secondary treat-add-btn" onclick="Planner.openAddTreatModal()">＋ Add treat</button>`;
  }
```

Replace with the full implementation:

```js
  function _renderTreats() {
    const el = document.getElementById('planner-grid');
    if (!el) return;
    const plan = Data.getPlan();
    const wk     = plan['week' + _currentWeek] || {};
    const treats = wk.treats || [];

    const rows = treats.map((t, i) => {
      const r = Data.getRecipeById(t.recipeId);
      if (!r) return '';
      return `
      <div class="treat-row">
        <span class="treat-name">${r.name}</span>
        <div class="treat-batches">
          <button class="stepper-btn" onclick="Planner.updateTreatBatches(${i}, -1)">−</button>
          <span>${t.batches} batch${t.batches !== 1 ? 'es' : ''}</span>
          <button class="stepper-btn" onclick="Planner.updateTreatBatches(${i}, 1)">+</button>
        </div>
        <button class="treat-remove" onclick="Planner.removeTreat(${i})">×</button>
      </div>`;
    }).filter(Boolean).join('');

    const emptyHtml = treats.length === 0
      ? `<div class="empty-state"><span class="emoji">🍰</span>No treats this week. Tap ＋ to add one.</div>`
      : '';

    el.innerHTML = `
    <div class="treats-list">${emptyHtml}${rows}</div>
    <button class="btn-secondary treat-add-btn" onclick="Planner.openAddTreatModal()">＋ Add treat</button>`;
  }
```

- [ ] **Step 3: Replace `openAddTreatModal()` stub with full implementation in `js/planner.js`**

Find:

```js
  function openAddTreatModal() {
    // Implemented in Task 2
    App.toast('Treats coming in next step', 'warn');
  }
```

Replace with:

```js
  function openAddTreatModal() {
    const recipes = Data.getRecipes().slice().sort((a, b) => a.name.localeCompare(b.name));
    if (recipes.length === 0) {
      App.toast('No recipes yet — add some recipes first.', 'warn');
      return;
    }
    document.getElementById('modal-content').innerHTML = `
    <h3>Add Treat — Week ${_currentWeek}</h3>
    <div class="form-group">
      <label>Recipe</label>
      <select id="treat-recipe-select">
        ${recipes.map(r => `<option value="${r.id}">${r.name}</option>`).join('')}
      </select>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn-primary" onclick="Planner.confirmAddTreat()">Add Treat</button>
    </div>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
  }

  function confirmAddTreat() {
    const recipeId = document.getElementById('treat-recipe-select')?.value;
    if (!recipeId) return;
    const plan   = Data.getPlan();
    const wk     = plan['week' + _currentWeek] || {};
    const treats = [...(wk.treats || []), { recipeId, batches: 1 }];
    Data.setTreats(_currentWeek, treats);
    App.closeModal();
    render();
  }

  function removeTreat(idx) {
    const plan   = Data.getPlan();
    const wk     = plan['week' + _currentWeek] || {};
    const treats = (wk.treats || []).filter((_, i) => i !== idx);
    Data.setTreats(_currentWeek, treats);
    render();
  }

  function updateTreatBatches(idx, delta) {
    const plan   = Data.getPlan();
    const wk     = plan['week' + _currentWeek] || {};
    const treats = [...(wk.treats || [])];
    if (!treats[idx]) return;
    treats[idx] = { ...treats[idx], batches: Math.max(1, (treats[idx].batches || 1) + delta) };
    Data.setTreats(_currentWeek, treats);
    render();
  }
```

- [ ] **Step 4: Update the `return` object in `js/planner.js` to export the new functions**

Find:

```js
  return { render, showWeek, showTab, setSlot, generateShoppingList, filterRecipes, openAddTreatModal };
```

Replace with:

```js
  return { render, showWeek, showTab, setSlot, generateShoppingList, filterRecipes,
           openAddTreatModal, confirmAddTreat, removeTreat, updateTreatBatches };
```

- [ ] **Step 5: Add treat row CSS to `css/style.css`**

Find the stub treat styles added in Task 1:

```css
/* ── TREAT ROW (stub styles, full styles in Task 2) ── */
.treat-add-btn { margin-top: 16px; width: 100%; }
```

Replace with the full treat styles:

```css
/* ── TREAT ROW ── */
.treats-list { margin-bottom: 4px; }
.treat-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}
.treat-name { flex: 1; font-weight: 500; font-size: 0.95rem; }
.treat-batches {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.88rem;
  color: var(--text-muted);
}
.treat-remove {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 1.2rem;
  cursor: pointer;
  padding: 2px 6px;
  line-height: 1;
}
.treat-remove:hover { color: var(--danger); }
.treat-add-btn { margin-top: 16px; width: 100%; }
```

- [ ] **Step 6: Verify in browser**

Hard-refresh. Go to Planner → Treats tab:
- "No treats" empty state shows
- "＋ Add treat" opens modal with recipe picker
- Selecting a recipe and confirming adds it to the list with "1 batch"
- `[−]` / `[+]` steppers change the batch count (minimum stays at 1)
- `×` button removes the treat
- Treats persist when switching weeks and back
- Adding multiple treats to the same week works

- [ ] **Step 7: Commit**

```bash
git add js/planner.js js/data.js css/style.css
git commit -m "feat: treats tab — add/remove/adjust batch count per week"
```

---

## Task 3: Serving-aware shopping list + treats in shopping list

**Files:**
- Modify: `js/planner.js`

**Scene:** `generateShoppingList()` currently treats each unique recipe once with no scaling. This rewrites it to: (a) count how many slots each recipe fills, scale ingredients accordingly, and include a `context` field; (b) also process treats with their batch multiplier.

- [ ] **Step 1: Replace `generateShoppingList()` in `js/planner.js`**

Find the existing `generateShoppingList` function (everything from `function generateShoppingList()` through its closing `}`). Replace with:

```js
  function generateShoppingList() {
    const plan = Data.getPlan();
    const wk   = plan['week' + _currentWeek] || {};
    const treats = wk.treats || [];

    // Count how many meal slots each recipe fills this week
    const slotCounts = {}; // recipeId → number of slots
    Data.DAYS.forEach(d => {
      Data.MEALS.forEach(m => {
        const id = (wk[d] || {})[m];
        if (id) slotCounts[id] = (slotCounts[id] || 0) + 1;
      });
    });

    if (Object.keys(slotCounts).length === 0 && treats.length === 0) {
      App.toast('No meals or treats planned for this week.', 'warn');
      return;
    }

    const agg = {}; // key: "name|unit" → { name, unit, qty, sources }

    // Meal slots — scale by (slots / base servings)
    Object.entries(slotCounts).forEach(([id, slotCount]) => {
      const r = Data.getRecipeById(id);
      if (!r) return;
      const baseServings = r.servings || 1;
      const multiplier   = slotCount / baseServings;
      Recipes.parseIngredients(r.ingredients).forEach(i => {
        const key = `${i.name.toLowerCase()}|${i.unit}`;
        if (!agg[key]) agg[key] = { name: i.name, unit: i.unit, qty: 0, sources: [] };
        const scaledQty = (parseFloat(i.qty) || 0) * multiplier;
        agg[key].qty += scaledQty;
        agg[key].sources.push({
          recipe:  r.name,
          qty:     scaledQty,
          unit:    i.unit,
          context: `${slotCount} of ${baseServings}-serving recipe`,
        });
      });
    });

    // Treats — scale by batch count
    treats.forEach(treat => {
      const r = Data.getRecipeById(treat.recipeId);
      if (!r) return;
      const batches = treat.batches || 1;
      Recipes.parseIngredients(r.ingredients).forEach(i => {
        const key = `${i.name.toLowerCase()}|${i.unit}`;
        if (!agg[key]) agg[key] = { name: i.name, unit: i.unit, qty: 0, sources: [] };
        const scaledQty = (parseFloat(i.qty) || 0) * batches;
        agg[key].qty += scaledQty;
        agg[key].sources.push({
          recipe:  r.name,
          qty:     scaledQty,
          unit:    i.unit,
          context: `${batches} batch${batches !== 1 ? 'es' : ''}`,
        });
      });
    });

    const items = Object.values(agg).map(i => ({
      name:    i.name,
      unit:    i.unit,
      qty:     i.qty > 0 ? i.qty : '',
      sources: i.sources,
      checked: false,
    }));

    if (items.length === 0) {
      App.toast('Meals planned but no ingredients found — add ingredients to your recipes.', 'warn');
      return;
    }
    Data.setShoppingList(items);
    App.toast(`Shopping list generated (${items.length} items) ✓`);
    App.nav('shopping', document.querySelector('[data-view="shopping"]'));
    Shopping.render();
  }
```

- [ ] **Step 2: Verify in browser**

Scenario A — serving scaling:
1. Plan "Classic Spaghetti Bolognese" (4 servings) for Monday dinner, Tuesday dinner, Wednesday dinner (3 slots).
2. Generate shopping list.
3. Check "beef mince": should be 375g (500g × 3/4). Source sub-line (may show just recipe name for now until Task 4): should reference Bolognese.

Scenario B — treats:
1. Go to Treats tab, add "Classic Spaghetti Bolognese" (using a starter recipe to verify), 2 batches.
2. Generate shopping list.
3. Bolognese should appear in the aggregated list with its ingredients doubled.

Scenario C — combined:
1. Plan Bolognese 3 slots + Bolognese as a treat 1 batch.
2. Beef mince should be: (500g × 3/4) + (500g × 1) = 375g + 500g = 875g.

- [ ] **Step 3: Commit**

```bash
git add js/planner.js
git commit -m "feat: serving-aware shopping list with per-slot scaling and treat batches"
```

---

## Task 4: Source sub-line context display

**Files:**
- Modify: `js/shopping.js`

**Scene:** The `sources` array now has a `context` field (e.g. `"3 of 4-serving recipe"` or `"2 batches"`). The shopping list source sub-line currently ignores it. This task renders it.

- [ ] **Step 1: Update source sub-line rendering in `js/shopping.js`**

Find this block inside the `render()` function:

```js
        let sourceHtml = '';
        if (item.sources && item.sources.length > 1) {
          const sourceText = item.sources
            .map(s => `${s.recipe}${s.qty ? ' ' + fmtQty(s.qty) + (s.unit ? ' ' + s.unit : '') : ''}`)
            .join(' · ');
          sourceHtml = `<div class="shop-item-source">${sourceText}</div>`;
        }
```

Replace with:

```js
        let sourceHtml = '';
        const showSources = item.sources && item.sources.length > 0 &&
          (item.sources.length > 1 || (item.sources[0] && item.sources[0].context));
        if (showSources) {
          const sourceText = item.sources
            .map(s => {
              let text = s.recipe;
              if (s.qty) text += ' ' + fmtQty(s.qty) + (s.unit ? ' ' + s.unit : '');
              if (s.context) text += ` (${s.context})`;
              return text;
            })
            .join(' · ');
          sourceHtml = `<div class="shop-item-source">${sourceText}</div>`;
        }
```

- [ ] **Step 2: Verify in browser**

1. Plan "Classic Spaghetti Bolognese" (4 servings) for 3 meal slots. Generate list.
2. Check "beef mince": source line should read `Bolognese 375g (3 of 4-serving recipe)`.
3. Add "Banana Oat Pancakes" (2 servings) as a treat for 2 batches. Re-generate.
4. Check "eggs": source line should show `Banana Oat Pancakes 4 (2 batches)` (2 eggs × 2 batches = 4).
5. If "beef mince" appears from both meal slots and a treat, it should show two entries separated by ` · `.

- [ ] **Step 3: Commit**

```bash
git add js/shopping.js
git commit -m "feat: show serving context and batch count in shopping list source lines"
```

---

## Final check

After all 4 tasks are done, do a full smoke test:

1. **Planner navigation**: week tabs switch weeks and reset to Meals tab; inner tabs switch within a week.
2. **Meal grid**: dropdowns work, filter bar filters, saved slots survive filter changes.
3. **Treats**: add multiple treats across different weeks; batch stepper minimum 1; remove works.
4. **Shopping list**: generate from a week with mixed meals and treats; quantities are scaled; source lines show context.
5. **Summary tab**: shows placeholder card.
6. **No regressions**: recipe list, detail view, add/edit recipe, Add to Plan modal, servings multiplier still work.
