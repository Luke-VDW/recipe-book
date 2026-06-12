# Batch 3 Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add servings multiplier, shopping list source breakdown, "Add to Plan" button on recipe detail, and desktop 4-week stacked planner with recipe filter.

**Architecture:** All changes are in the existing vanilla JS IIFE modules — no new files, no bundler, no framework. Each module exposes new functions via its `return` statement. CSS additions target the existing `style.css` file. No schema migration needed; `sources` is additive on shopping list items.

**Tech Stack:** Vanilla HTML/CSS/JS PWA, localStorage, no test suite — use manual browser verification after each task.

---

## File Map

| File | Changes |
|------|---------|
| `js/recipes.js` | Add state vars; `_renderIngredients()`; update `openDetail()`; add `setServings()`, `openAddToPlanModal()`, `confirmAddToPlan()` |
| `js/planner.js` | Add `_recipeFilter` state; update `render()` + `showWeek()`; add `_renderAll()`, `filterRecipes()`; update `generateShoppingList()` to emit `sources` |
| `js/shopping.js` | Update `render()` to display source sub-line |
| `css/style.css` | Add `.servings-stepper`, `.stepper-btn`, `.shop-item-main`, `.shop-item-source`, `.planner-week-*`, `.planner-filter-bar` |
| `index.html` | Add `#planner-recipe-filter` input between `.week-tabs` and `#planner-grid` |

---

## Task 1: Servings Multiplier + Add to Plan Button (`js/recipes.js`)

**Files:**
- Modify: `js/recipes.js`

Both features touch `openDetail()`, so they are implemented together.

- [ ] **Step 1: Add module-level state variables**

At the very top of the `Recipes` IIFE body (after `const Recipes = (() => {`), before the `UNITS` constant, add:

```js
let _activeId    = null;
let _baseServings = 1;
let _targetServings = 1;
let _planTargetId = null;
```

- [ ] **Step 2: Add `_renderIngredients` helper function**

Insert this function before `openDetail`:

```js
function _renderIngredients(ings, multiplier) {
  if (!ings.length) return '<p class="hint" style="padding:10px">No ingredients listed.</p>';
  return `<ul class="ingredient-list">${ings.map(i => {
    const scaledQty = (parseFloat(i.qty) || 0) * (multiplier || 1);
    return `<li>
      <span class="ing-qty">${i.qty ? fmtQty(scaledQty) : ''}</span>
      <span class="ing-unit">${i.unit}</span>
      <span>${i.name}</span>
    </li>`;
  }).join('')}</ul>`;
}
```

- [ ] **Step 3: Replace `openDetail` with the updated version**

Replace the entire `openDetail` function (lines 106–151) with:

```js
function openDetail(id) {
  _activeId = id;
  const r = Data.getRecipeById(id);
  if (!r) return;
  _baseServings   = r.servings || 1;
  _targetServings = r.servings || 1;

  const ings  = parseIngredients(r.ingredients);
  const steps = (r.method || '').split('\n').filter(s => s.trim());

  const stepsHtml = steps.length
    ? `<ol class="step-list">${steps.map((s, i) => {
        const text = s.replace(/^\d+\.\s*/, '');
        return `<li><span class="step-num">${i+1}.</span><span>${text}</span></li>`;
      }).join('')}</ol>`
    : '<p class="hint" style="padding:10px">No directions listed.</p>';

  const tags = (r.tags || '').split(',').map(t=>t.trim()).filter(Boolean)
    .map(t => `<span class="tag">${t}</span>`).join('');

  document.getElementById('detail-content').innerHTML = `
    <h2 class="detail-name">${r.name}</h2>
    <div class="detail-meta">
      ${r.category ? `<span>📂 ${r.category}</span>` : ''}
      ${r.servings ? `<span class="servings-stepper">👥
        <button class="stepper-btn" onclick="Recipes.setServings(-1)">−</button>
        <span id="detail-servings-label">${r.servings} servings</span>
        <button class="stepper-btn" onclick="Recipes.setServings(1)">+</button>
      </span>` : ''}
      ${r.prepMins ? `<span>⏱ ${r.prepMins}m prep</span>` : ''}
      ${r.cookMins ? `<span>🔥 ${r.cookMins}m cook</span>` : ''}
    </div>
    ${tags ? `<div class="detail-tags">${tags}</div>` : ''}
    <div class="detail-actions">
      <button class="btn-secondary" onclick="Timer.open()">⏱ Timer</button>
      <button class="btn-secondary" onclick="Recipes.openAddToPlanModal('${r.id}')">📅 Add to Plan</button>
      <button class="btn-secondary" onclick="Recipes.openEditModal('${r.id}')">✏️ Edit</button>
      <button class="btn-danger" onclick="Recipes.confirmDelete('${r.id}')">🗑 Delete</button>
    </div>
    <div class="section-label">🥕 INGREDIENTS</div>
    <div id="detail-ingredients">${_renderIngredients(ings, 1)}</div>
    <div class="section-label">👨‍🍳 DIRECTIONS</div>
    ${stepsHtml}
    ${r.source ? `<p class="detail-source">Source: <a href="${r.source}" target="_blank">${r.source}</a></p>` : ''}
  `;

  App.pushView('detail', r.name);
}
```

- [ ] **Step 4: Add `setServings` function**

Insert after `openDetail`:

```js
function setServings(delta) {
  if (!_activeId) return;
  _targetServings = Math.max(1, _targetServings + delta);
  const r = Data.getRecipeById(_activeId);
  if (!r) return;
  const multiplier = _targetServings / _baseServings;
  const label = document.getElementById('detail-servings-label');
  if (label) label.textContent = _targetServings + ' servings';
  const ingEl = document.getElementById('detail-ingredients');
  if (ingEl) ingEl.innerHTML = _renderIngredients(parseIngredients(r.ingredients), multiplier);
}
```

- [ ] **Step 5: Add `openAddToPlanModal` and `confirmAddToPlan` functions**

Insert after `setServings`:

```js
function openAddToPlanModal(id) {
  _planTargetId = id;
  const r = Data.getRecipeById(id);
  if (!r) return;
  document.getElementById('modal-content').innerHTML = `
    <div class="modal-title">📅 Add to Plan</div>
    <p style="margin:0 0 12px;color:var(--text-muted);font-size:.9rem">"${r.name}"</p>
    <div class="form-group">
      <label>Week</label>
      <select id="atp-week">
        <option value="1">Week 1</option>
        <option value="2">Week 2</option>
        <option value="3">Week 3</option>
        <option value="4">Week 4</option>
      </select>
    </div>
    <div class="form-group">
      <label>Day</label>
      <select id="atp-day">
        ${Data.DAYS.map(d => `<option value="${d}">${d.charAt(0).toUpperCase() + d.slice(1)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Meal</label>
      <select id="atp-meal">
        <option value="breakfast">Breakfast</option>
        <option value="lunch">Lunch</option>
        <option value="dinner" selected>Dinner</option>
      </select>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn-primary" onclick="Recipes.confirmAddToPlan()">Add to Plan</button>
    </div>
  `;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function confirmAddToPlan() {
  const week = parseInt(document.getElementById('atp-week').value);
  const day  = document.getElementById('atp-day').value;
  const meal = document.getElementById('atp-meal').value;
  Data.setMealSlot(week, day, meal, _planTargetId);
  const dayLabel  = day.charAt(0).toUpperCase() + day.slice(1);
  const mealLabel = meal.charAt(0).toUpperCase() + meal.slice(1);
  App.closeModal();
  App.toast(`Added to Week ${week}, ${dayLabel} ${mealLabel} ✓`);
}
```

- [ ] **Step 6: Update `return` statement**

Replace the existing `return` at the bottom of the IIFE:

```js
// OLD:
return { render, filter, openDetail, openAddModal, openEditModal, saveModal, confirmDelete, parseIngredients };

// NEW:
return { render, filter, openDetail, openAddModal, openEditModal, saveModal, confirmDelete, parseIngredients, setServings, openAddToPlanModal, confirmAddToPlan };
```

- [ ] **Step 7: Add CSS for stepper**

In `css/style.css`, find the `/* ── RECIPE DETAIL ── */` section and add after `.detail-actions { ... }`:

```css
.servings-stepper { display: inline-flex; align-items: center; gap: 4px; }
.stepper-btn {
  background: var(--lt-green); border: 1px solid var(--border);
  border-radius: 4px; width: 22px; height: 22px;
  font-size: .85rem; font-weight: 700; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--dk-green); line-height: 1; flex-shrink: 0;
}
.stepper-btn:active { background: var(--accent); color: #fff; }
```

- [ ] **Step 8: Verify manually**

Open the app in a browser (`python -m http.server 8000`), navigate to any recipe detail view. Verify:
- `[−] 2 servings [+]` stepper appears in the meta row
- Tapping `+` increases the serving count and scales ingredient quantities
- Tapping `−` decreases (stops at 1)
- `📅 Add to Plan` button is in the action bar
- Clicking it opens a modal with Week/Day/Meal dropdowns
- Selecting values and clicking "Add to Plan" shows a toast and closes the modal
- Opening the Planner confirms the slot was set

- [ ] **Step 9: Commit**

```bash
git add js/recipes.js css/style.css
git commit -m "feat: add servings multiplier and Add to Plan button on recipe detail"
```

---

## Task 2: Shopping List Source Breakdown (`js/planner.js` + `js/shopping.js` + `css/style.css`)

**Files:**
- Modify: `js/planner.js:66–115` (`generateShoppingList`)
- Modify: `js/shopping.js:39–78` (`render`)
- Modify: `css/style.css`

- [ ] **Step 1: Update `generateShoppingList` in `planner.js`**

Replace the entire `generateShoppingList` function with:

```js
function generateShoppingList() {
  const plan   = Data.getPlan();
  const wk     = plan['week' + _currentWeek] || {};
  const recipes = Data.getRecipes();

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

  const agg = {}; // key: "name|unit" → { name, unit, qty, recipes, sources }
  usedIds.forEach(id => {
    const r = Data.getRecipeById(id);
    if (!r) return;
    const ings = Recipes.parseIngredients(r.ingredients);
    ings.forEach(i => {
      const key = `${i.name.toLowerCase()}|${i.unit}`;
      if (!agg[key]) agg[key] = { name: i.name, unit: i.unit, qty: 0, recipes: [], sources: [] };
      agg[key].qty += parseFloat(i.qty) || 0;
      agg[key].recipes.push(r.name);
      agg[key].sources.push({ recipe: r.name, qty: parseFloat(i.qty) || 0, unit: i.unit });
    });
  });

  const items = Object.values(agg).map(i => ({
    name: i.name,
    unit: i.unit,
    qty: i.qty > 0 ? i.qty : '',
    recipes: [...new Set(i.recipes)].join(', '),
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

- [ ] **Step 2: Update `render` in `shopping.js`**

Replace the `render` function with:

```js
function render() {
  const items = Data.getShoppingList();
  const el = document.getElementById('shopping-list');
  if (!el) return;

  if (items.length === 0) {
    el.innerHTML = `<div class="empty-state"><span class="emoji">🛒</span>Your shopping list is empty.<br>Generate one from the Meal Planner.</div>`;
    return;
  }

  const groups = {};
  items.forEach((item, idx) => {
    const cat = guessCategory(item.name);
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push({ ...item, _idx: idx });
  });

  const catOrder = ['produce','meat','dairy','pasta & grains','pantry','frozen','drinks','other'];
  const orderedCats = catOrder.filter(c => groups[c]);

  el.innerHTML = orderedCats.map(cat => {
    const catItems = groups[cat];
    const rows = catItems.map(item => {
      const qty = fmtQty(item.qty);
      const label = qty ? `${qty}${item.unit ? ' ' + item.unit : ''} ${item.name}` : item.name;

      let sourceHtml = '';
      if (item.sources && item.sources.length > 1) {
        const sourceText = item.sources
          .map(s => `${s.recipe}${s.qty ? ' ' + fmtQty(s.qty) + (s.unit || '') : ''}`)
          .join(' · ');
        sourceHtml = `<div class="shop-item-source">${sourceText}</div>`;
      }

      return `
        <div class="shop-item ${item.checked ? 'checked' : ''}" id="shop-item-${item._idx}">
          <input type="checkbox" ${item.checked ? 'checked' : ''}
            onchange="Shopping.toggle(${item._idx})" />
          <div class="shop-item-main">
            <span class="shop-item-name">${label}</span>
            ${sourceHtml}
          </div>
        </div>`;
    }).join('');
    return `
      <div class="shop-category">
        <div class="shop-cat-label">${cat.toUpperCase()}</div>
        ${rows}
      </div>`;
  }).join('');
}
```

- [ ] **Step 3: Update shopping CSS in `style.css`**

Find `.shop-item-name { flex: 1; font-size: .95rem; }` and the rules nearby, and replace:

```css
/* OLD: */
.shop-item-name { flex: 1; font-size: .95rem; }
.shop-item-qty { font-size: .82rem; color: var(--dk-green); font-weight: 600; }

/* NEW: */
.shop-item-main { flex: 1; min-width: 0; }
.shop-item-name { font-size: .95rem; }
.shop-item-source { font-size: .72rem; color: var(--text-muted); margin-top: 2px; }
```

Note: `.shop-item-qty` (the old dot-bullet) is removed; the source breakdown replaces it.

- [ ] **Step 4: Verify manually**

Plan at least 2 meals on the same week that share an ingredient (e.g., two recipes both using onion). Generate the shopping list. Verify:
- The onion entry shows a sub-line: `RecipeA 1 · RecipeB 2`
- Items with only one contributing recipe show no sub-line
- Checking/unchecking items still works (line-through applies to the name)
- Old shopping list items (without `sources`) show no sub-line (graceful degradation)

- [ ] **Step 5: Commit**

```bash
git add js/planner.js js/shopping.js css/style.css
git commit -m "feat: show per-recipe source breakdown in shopping list"
```

---

## Task 3: Desktop 4-Week Stacked Planner + Recipe Filter (`js/planner.js` + `index.html` + `css/style.css`)

**Files:**
- Modify: `js/planner.js`
- Modify: `index.html:53–64`
- Modify: `css/style.css` (inside `@media (min-width: 900px)`)

- [ ] **Step 1: Add `_recipeFilter` state variable to `planner.js`**

At the top of the `Planner` IIFE body (after `const Planner = (() => {`), add alongside `_currentWeek`:

```js
let _currentWeek = 1;
let _recipeFilter = '';
```

- [ ] **Step 2: Replace `render` in `planner.js`**

Replace the current `render` function (lines 15–17):

```js
function render() {
  if (window.matchMedia('(min-width: 900px)').matches) {
    _renderAll();
  } else {
    showWeek(_currentWeek);
  }
}
```

- [ ] **Step 3: Replace `showWeek` in `planner.js`**

Replace the entire `showWeek` function with:

```js
function showWeek(week, tabEl) {
  _currentWeek = week;
  if (tabEl) {
    document.querySelectorAll('.week-tab').forEach(t => t.classList.remove('active'));
    tabEl.classList.add('active');
  }

  if (window.matchMedia('(min-width: 900px)').matches) {
    const section = document.getElementById('planner-week-' + week);
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  const plan = Data.getPlan();
  const wk   = plan['week' + week] || {};
  const recipes = Data.getRecipes().filter(r =>
    !_recipeFilter || r.name.toLowerCase().includes(_recipeFilter.toLowerCase())
  );

  const el = document.getElementById('planner-grid');
  if (!el) return;

  el.innerHTML = Data.DAYS.map(day => {
    const dayData = wk[day] || {};
    const slots = Data.MEALS.map(meal => {
      const selected = dayData[meal] || '';
      return `
        <div class="meal-slot">
          <span class="meal-label">${MEAL_LABELS[meal]}</span>
          <select onchange="Planner.setSlot(${week},'${day}','${meal}',this.value)">
            <option value="" ${!selected ? 'selected' : ''}>— none —</option>
            ${recipes.map(r =>
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
  }).join('');
}
```

- [ ] **Step 4: Add `_renderAll` function to `planner.js`**

Insert after `showWeek`:

```js
function _renderAll() {
  const plan = Data.getPlan();
  const recipes = Data.getRecipes().filter(r =>
    !_recipeFilter || r.name.toLowerCase().includes(_recipeFilter.toLowerCase())
  );
  const el = document.getElementById('planner-grid');
  if (!el) return;

  el.innerHTML = [1, 2, 3, 4].map(week => {
    const wk = plan['week' + week] || {};
    const daysHtml = Data.DAYS.map(day => {
      const dayData = wk[day] || {};
      const slots = Data.MEALS.map(meal => {
        const selected = dayData[meal] || '';
        return `
          <div class="meal-slot">
            <span class="meal-label">${MEAL_LABELS[meal]}</span>
            <select onchange="Planner.setSlot(${week},'${day}','${meal}',this.value)">
              <option value="" ${!selected ? 'selected' : ''}>— none —</option>
              ${recipes.map(r =>
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
    }).join('');
    return `
      <div class="planner-week-section" id="planner-week-${week}">
        <div class="planner-week-header">Week ${week}</div>
        <div class="planner-week-grid">${daysHtml}</div>
      </div>`;
  }).join('');
}
```

- [ ] **Step 5: Add `filterRecipes` function to `planner.js`**

Insert after `_renderAll`:

```js
function filterRecipes() {
  _recipeFilter = (document.getElementById('planner-recipe-filter')?.value || '').trim();
  render();
}
```

- [ ] **Step 6: Update `return` in `planner.js`**

```js
// OLD:
return { render, showWeek, setSlot, generateShoppingList };

// NEW:
return { render, showWeek, setSlot, generateShoppingList, filterRecipes };
```

- [ ] **Step 7: Add filter input to `index.html`**

In `index.html`, inside `<section id="view-planner" ...>`, add the filter bar between `.week-tabs` and `#planner-grid`:

```html
<!-- MEAL PLANNER -->
<section id="view-planner" class="view">
  <div class="week-tabs">
    <button class="week-tab active" onclick="Planner.showWeek(1,this)">Week 1</button>
    <button class="week-tab" onclick="Planner.showWeek(2,this)">Week 2</button>
    <button class="week-tab" onclick="Planner.showWeek(3,this)">Week 3</button>
    <button class="week-tab" onclick="Planner.showWeek(4,this)">Week 4</button>
  </div>
  <div class="planner-filter-bar">
    <input id="planner-recipe-filter" type="search" placeholder="Filter recipes…"
      oninput="Planner.filterRecipes()" />
  </div>
  <div id="planner-grid"></div>
  <div class="planner-actions">
    <button class="btn-secondary" onclick="Planner.generateShoppingList()">🛒 Generate Shopping List</button>
  </div>
</section>
```

- [ ] **Step 8: Update desktop planner CSS in `style.css`**

Inside the `@media (min-width: 900px)` block, replace the existing planner grid rules:

```css
/* OLD — replace all of this: */
  /* Planner grid — 7 days side-by-side */
  #planner-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 10px;
  }
  #planner-grid .planner-day { margin-bottom: 0; overflow: visible; }
  /* Give rounded corners to header\last-slot when overflow:visible removes clip */
  #planner-grid .planner-day-header { border-radius: var(--radius) var(--radius) 0 0; }
  #planner-grid .meal-slot:last-child { border-radius: 0 0 var(--radius) var(--radius); }
  .meal-label { font-size: .65rem; }

/* NEW — replace with: */
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
```

- [ ] **Step 9: Add filter bar CSS to `style.css`**

In the base styles (not inside any `@media` block), after `.planner-actions { ... }`:

```css
.planner-filter-bar { margin: 8px 0 10px; }
.planner-filter-bar input {
  width: 100%; padding: 8px 12px;
  border: 1.5px solid var(--border); border-radius: var(--radius);
  font-size: .9rem; background: var(--surface);
}
.planner-filter-bar input:focus { border-color: var(--md-green); outline: none; }
```

- [ ] **Step 10: Verify manually**

On desktop (browser window ≥ 900px):
- Navigate to Planner — all 4 weeks are visible, stacked vertically with "Week 1 / Week 2 / Week 3 / Week 4" headers
- Clicking a week tab scrolls to that section instead of switching view
- Type a recipe name in the filter bar — unmatched recipes are removed from all dropdowns
- Clearing the filter restores all recipes

On mobile (resize to < 900px or use DevTools):
- Only the active week is shown
- Week tabs still switch views
- Filter bar is visible and works

- [ ] **Step 11: Commit**

```bash
git add js/planner.js index.html css/style.css
git commit -m "feat: show all 4 weeks on desktop planner with recipe filter bar"
```

---

## Task 4: Push to GitHub

- [ ] **Step 1: Push**

```bash
git push origin main
```

- [ ] **Step 2: Verify deployment**

After ~60 seconds, open `https://luke-vdw.github.io/recipe-book/` and do a hard refresh (Ctrl+Shift+R). Verify all 4 features work on the live site:
- Servings stepper on recipe detail
- "Add to Plan" modal on recipe detail
- Shopping list source sub-lines after regenerating from planner
- Desktop 4-week stacked planner
- Filter bar on planner
