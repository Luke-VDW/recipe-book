# Calorie Estimation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add on-demand calorie data to recipes (via Spoonacular) and display per-slot kcal in the planner, per-treat kcal in the treats tab, and a full day-by-day calorie summary in the Summary tab.

**Architecture:** One new field (`kcalTotal`) on the recipe object; one new `Data` method; new functions in `recipes.js` for the form UI and Spoonacular call; `planner.js` updates for slot labels, treats tab, and summary tab. No new files.

**Tech Stack:** Vanilla HTML/CSS/JS. Spoonacular `/recipes/parseIngredients` API (key already stored in `localStorage.spoonacularKey`).

---

## Codebase context

- All modules are IIFEs loaded via `<script>` tags. `Data`, `Recipes`, `Planner`, `App` are globals.
- `Data.getRecipeById(id)` → recipe object or null.
- `Data.updateRecipe(r)` → replaces recipe object by id in `_db.recipes` and calls `save()`.
- `App.toast(msg, type?)` — type is `'warn'` or `'error'` for non-green.
- `App.closeModal()` — hides `#modal-overlay`.
- Spoonacular key: `localStorage.getItem('spoonacularKey')`.
- Recipe object shape (relevant fields): `{ id, name, servings, ingredients, kcalTotal }` — `kcalTotal` is new.

---

## File map

| File | Changes |
|------|---------|
| `js/data.js` | Add `setRecipeCalories(id, kcal)` method and export it |
| `js/recipes.js` | Add calories row to `_showModal`; add `_updateKcalDisplay`, `editCalories`, `cancelEditCalories`, `saveCalories`, `calculateCalories`; update `saveModal` to preserve `kcalTotal`; add kcal to detail view |
| `js/planner.js` | Update `_buildDayHtml` for slot kcal label; update `_renderTreats` for treat kcal; replace `_renderSummary` with full weekly breakdown |
| `css/style.css` | Add `.btn-mini`, `.btn-mini-primary`, `.kcal-display`, `.kcal-edit-row`, `.kcal-value`, `.kcal-unknown`, `.slot-kcal`, `.meal-slot-right`, `.treat-kcal`, `.summary-*` styles |

---

## Task 1: Data layer — `setRecipeCalories`

**Files:**
- Modify: `js/data.js`

- [ ] **Step 1: Add `setRecipeCalories` to `js/data.js`**

Read `js/data.js`. Find the `setTreats` function (lines ~95–100):

```js
  function setTreats(week, treats) {
    const wk = 'week' + week;
    _db.mealPlan[wk] = _db.mealPlan[wk] || {};
    _db.mealPlan[wk].treats = treats;
    save();
  }
```

Add immediately after it:

```js
  function setRecipeCalories(id, kcal) {
    const idx = _db.recipes.findIndex(r => r.id === id);
    if (idx >= 0) {
      _db.recipes[idx].kcalTotal = kcal;
      save();
    }
  }
```

- [ ] **Step 2: Export `setRecipeCalories` from the `Data` IIFE**

Find the return statement (line ~336):

```js
  return {
    load, save, getRecipes, getPlan, getPantry, getShoppingList,
    addRecipe, updateRecipe, deleteRecipe, getRecipeById,
    setMealSlot, setShoppingList, setTreats, toggleShoppingItem,
```

Replace with:

```js
  return {
    load, save, getRecipes, getPlan, getPantry, getShoppingList,
    addRecipe, updateRecipe, deleteRecipe, getRecipeById,
    setMealSlot, setShoppingList, setTreats, setRecipeCalories, toggleShoppingItem,
```

- [ ] **Step 3: Commit**

```bash
git add js/data.js
git commit -m "feat: add setRecipeCalories to data layer"
```

---

## Task 2: Recipe form — calories row + Spoonacular calculation

**Files:**
- Modify: `js/recipes.js`
- Modify: `css/style.css`

**Scene:** `_showModal(r)` builds the recipe add/edit form as an HTML string. This task adds a Calories row below the Source URL field, with Calculate/Recalculate/Edit/Enter-manually buttons. The `saveModal()` function must also be updated to preserve `kcalTotal`.

- [ ] **Step 1: Add five new functions to `js/recipes.js` — paste before the `return` statement**

Read `js/recipes.js`. Find the `return` statement at the very end of the IIFE (line ~342):

```js
  return { render, filter, openDetail, openAddModal, openEditModal, saveModal, confirmDelete, parseIngredients, setServings, openAddToPlanModal, confirmAddToPlan };
```

Insert the following five new functions immediately before that `return` statement:

```js
  function _updateKcalDisplay(kcal, servings) {
    const el = document.getElementById('kcal-display');
    if (!el) return;
    if (kcal) {
      const perServing = Math.round(kcal / (servings || 1));
      el.innerHTML = `
        <span class="kcal-value">${kcal} kcal · ${perServing}/serving</span>
        <button type="button" class="btn-mini" onclick="Recipes.editCalories()">Edit</button>
        <button type="button" id="btn-calc-kcal" class="btn-mini" onclick="Recipes.calculateCalories()">Recalculate</button>`;
    } else {
      el.innerHTML = `
        <span class="kcal-value kcal-unknown">—</span>
        <button type="button" class="btn-mini" onclick="Recipes.editCalories()">Enter manually</button>
        <button type="button" id="btn-calc-kcal" class="btn-mini btn-mini-primary" onclick="Recipes.calculateCalories()">Calculate</button>`;
    }
  }

  function editCalories() {
    const currentVal = document.getElementById('rf-kcal')?.value;
    const editInput  = document.getElementById('rf-kcal-edit');
    if (editInput && currentVal) editInput.value = currentVal;
    const display = document.getElementById('kcal-display');
    const editRow = document.getElementById('kcal-edit-row');
    if (display) display.style.display = 'none';
    if (editRow) editRow.style.display = 'flex';
    if (editInput) editInput.focus();
  }

  function cancelEditCalories() {
    const display = document.getElementById('kcal-display');
    const editRow = document.getElementById('kcal-edit-row');
    if (display) display.style.display = 'flex';
    if (editRow) editRow.style.display = 'none';
  }

  function saveCalories() {
    const raw = parseInt(document.getElementById('rf-kcal-edit')?.value);
    if (isNaN(raw) || raw < 0) { App.toast('Enter a valid calorie amount.', 'warn'); return; }
    const hiddenInput = document.getElementById('rf-kcal');
    if (hiddenInput) hiddenInput.value = raw;
    const servings = parseInt(document.getElementById('rf-srv')?.value) || 1;
    _updateKcalDisplay(raw, servings);
    cancelEditCalories();
  }

  async function calculateCalories() {
    const ingredientsText = (document.getElementById('rf-ing')?.value || '').trim();
    if (!ingredientsText) { App.toast('Add ingredients first.', 'warn'); return; }
    const apiKey = localStorage.getItem('spoonacularKey');
    if (!apiKey) { App.toast('No Spoonacular key — go to Settings to add one.', 'warn'); return; }

    const btn = document.getElementById('btn-calc-kcal');
    const origLabel = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Calculating…'; }

    try {
      const ingredientList = ingredientsText.split(';').map(s => s.trim()).filter(Boolean).join('\n');
      const formData = new FormData();
      formData.append('ingredientList', ingredientList);
      formData.append('servings', '1');
      formData.append('includeNutrition', 'true');

      const res = await fetch(
        `https://api.spoonacular.com/recipes/parseIngredients?apiKey=${encodeURIComponent(apiKey)}`,
        { method: 'POST', body: formData }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const parsed = await res.json();

      let totalKcal = 0;
      parsed.forEach(ing => {
        const cal = (ing.nutrition?.nutrients || []).find(n => n.name === 'Calories');
        if (cal) totalKcal += cal.amount;
      });
      totalKcal = Math.round(totalKcal);

      const hiddenInput = document.getElementById('rf-kcal');
      if (hiddenInput) hiddenInput.value = totalKcal;
      const servings = parseInt(document.getElementById('rf-srv')?.value) || 1;
      _updateKcalDisplay(totalKcal, servings);
      App.toast(`Calories calculated: ${totalKcal} kcal ✓`);
    } catch (err) {
      console.error('Calorie calculation error:', err);
      App.toast('Calorie calculation failed — check your Spoonacular key.', 'warn');
    } finally {
      if (btn) { btn.disabled = false; if (origLabel) btn.textContent = origLabel; }
    }
  }
```

- [ ] **Step 2: Update the `return` statement in `js/recipes.js` to export the new functions**

Find:
```js
  return { render, filter, openDetail, openAddModal, openEditModal, saveModal, confirmDelete, parseIngredients, setServings, openAddToPlanModal, confirmAddToPlan };
```

Replace with:
```js
  return { render, filter, openDetail, openAddModal, openEditModal, saveModal, confirmDelete,
           parseIngredients, setServings, openAddToPlanModal, confirmAddToPlan,
           editCalories, cancelEditCalories, saveCalories, calculateCalories };
```

- [ ] **Step 3: Add the calories row to `_showModal()` in `js/recipes.js`**

Find the Source URL form group and modal-actions in `_showModal()`:
```js
      <div class="form-group">
        <label>Source URL</label>
        <input id="rf-src" type="url" value="${r.source || ''}" placeholder="https://…" />
      </div>
      <div class="modal-actions">
```

Replace with:
```js
      <div class="form-group">
        <label>Source URL</label>
        <input id="rf-src" type="url" value="${r.source || ''}" placeholder="https://…" />
      </div>
      <div class="form-group">
        <label>Calories</label>
        <input type="hidden" id="rf-kcal" value="${r.kcalTotal || ''}" />
        <div id="kcal-display" class="kcal-display">
          ${r.kcalTotal
            ? `<span class="kcal-value">${r.kcalTotal} kcal · ${Math.round(r.kcalTotal / (r.servings || 1))} kcal/serving</span>
               <button type="button" class="btn-mini" onclick="Recipes.editCalories()">Edit</button>
               <button type="button" id="btn-calc-kcal" class="btn-mini" onclick="Recipes.calculateCalories()">Recalculate</button>`
            : `<span class="kcal-value kcal-unknown">—</span>
               <button type="button" class="btn-mini" onclick="Recipes.editCalories()">Enter manually</button>
               <button type="button" id="btn-calc-kcal" class="btn-mini btn-mini-primary" onclick="Recipes.calculateCalories()">Calculate</button>`
          }
        </div>
        <div id="kcal-edit-row" class="kcal-edit-row" style="display:none">
          <input type="number" id="rf-kcal-edit" min="0" placeholder="e.g. 1840" />
          <button type="button" class="btn-mini btn-mini-primary" onclick="Recipes.saveCalories()">Save</button>
          <button type="button" class="btn-mini" onclick="Recipes.cancelEditCalories()">Cancel</button>
        </div>
      </div>
      <div class="modal-actions">
```

- [ ] **Step 4: Update `saveModal()` in `js/recipes.js` to preserve `kcalTotal`**

Find the `recipe` object construction in `saveModal()`:
```js
    const recipe = {
      id: existingId || undefined,
      name,
      category: document.getElementById('rf-cat').value,
      servings: parseInt(document.getElementById('rf-srv').value) || 2,
      prepMins: parseInt(document.getElementById('rf-prep').value) || 0,
      cookMins: parseInt(document.getElementById('rf-cook').value) || 0,
      ingredients: document.getElementById('rf-ing').value.trim(),
      method: document.getElementById('rf-method').value.trim(),
      tags: document.getElementById('rf-tags').value.trim(),
      source: document.getElementById('rf-src').value.trim(),
    };
```

Replace with:
```js
    const kcalRaw = parseInt(document.getElementById('rf-kcal')?.value);
    const recipe = {
      id: existingId || undefined,
      name,
      category: document.getElementById('rf-cat').value,
      servings: parseInt(document.getElementById('rf-srv').value) || 2,
      prepMins: parseInt(document.getElementById('rf-prep').value) || 0,
      cookMins: parseInt(document.getElementById('rf-cook').value) || 0,
      ingredients: document.getElementById('rf-ing').value.trim(),
      method: document.getElementById('rf-method').value.trim(),
      tags: document.getElementById('rf-tags').value.trim(),
      source: document.getElementById('rf-src').value.trim(),
      kcalTotal: isNaN(kcalRaw) ? null : kcalRaw,
    };
```

- [ ] **Step 5: Add CSS for calories row and mini buttons to `css/style.css`**

Find the comment `/* ── TREAT ROW ── */` in `style.css`. Add the following block immediately before it:

```css
/* ── MINI BUTTONS (recipe form) ── */
.btn-mini {
  padding: 3px 10px; font-size: 0.78rem;
  border: 1px solid var(--border); background: var(--surface);
  border-radius: 4px; cursor: pointer; color: var(--text);
  white-space: nowrap;
}
.btn-mini-primary { background: var(--dk-green); color: #fff; border-color: var(--dk-green); }

/* ── CALORIE ROW (recipe form) ── */
.kcal-display, .kcal-edit-row {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 4px;
}
.kcal-value { font-size: 0.9rem; color: var(--text); }
.kcal-unknown { color: var(--text-muted); }
#rf-kcal-edit { width: 110px; padding: 4px 8px; border: 1.5px solid var(--border); border-radius: 8px; font-size: 0.9rem; }

```

- [ ] **Step 6: Verify in browser**

Open `http://localhost:8000`, hard-refresh. Open an existing recipe → Edit:
- A "Calories" row appears below Source URL, showing `—` with "Enter manually" and "Calculate" buttons
- Click "Enter manually" → inline input appears; type `1840`, click Save → shows "1840 kcal · 460/serving" (if servings=4)
- Click "Edit" → input pre-filled with `1840`
- Click "Cancel" → input hides, value shown again
- Click "Save Changes" → reopen recipe edit → value `1840` still present

If you have a Spoonacular key in Settings: click "Recalculate" → button shows "Calculating…" → updates with API result.

- [ ] **Step 7: Commit**

```bash
git add js/recipes.js css/style.css
git commit -m "feat: calories row in recipe form with manual entry and Spoonacular Calculate button"
```

---

## Task 3: Recipe detail view — kcal display

**Files:**
- Modify: `js/recipes.js`
- Modify: `css/style.css`

**Scene:** `openDetail()` renders the detail view. Add a kcal line to the `detail-meta` div.

- [ ] **Step 1: Add kcal to the detail meta in `openDetail()` in `js/recipes.js`**

Find this section inside `openDetail()`:
```js
        ${r.cookMins ? `<span>🔥 ${r.cookMins}m cook</span>` : ''}
      </div>
```

Replace with:
```js
        ${r.cookMins ? `<span>🔥 ${r.cookMins}m cook</span>` : ''}
        <span class="detail-kcal">${r.kcalTotal != null
          ? `${r.kcalTotal} kcal · ${Math.round(r.kcalTotal / (r.servings || 1))} kcal/serving`
          : '— kcal'}</span>
      </div>
```

- [ ] **Step 2: Add CSS for `.detail-kcal` in `css/style.css`**

Find `/* ── MINI BUTTONS (recipe form) ── */` (added in Task 2). Add immediately before it:

```css
/* ── RECIPE DETAIL ── */
.detail-kcal { font-size: 0.85rem; color: var(--text-muted); }

```

- [ ] **Step 3: Verify in browser**

Hard-refresh. Open a recipe that has `kcalTotal` set (edit it to set one first via Task 2):
- Detail view shows e.g. `1840 kcal · 460 kcal/serving` in the meta bar
- A recipe with no `kcalTotal` shows `— kcal`

- [ ] **Step 4: Commit**

```bash
git add js/recipes.js css/style.css
git commit -m "feat: show kcal total and per-serving in recipe detail view"
```

---

## Task 4: Planner meal slots — kcal label per slot

**Files:**
- Modify: `js/planner.js`
- Modify: `css/style.css`

**Scene:** `_buildDayHtml()` renders each day's meal slots. Each slot has a meal-label and a `<select>`. This task wraps the select in a column container and adds a kcal label below it.

- [ ] **Step 1: Update `_buildDayHtml()` in `js/planner.js`**

Find the entire `_buildDayHtml` function (lines 18–41). Replace the `return` inside the `slots` map (inside `Data.MEALS.map`) with this updated version:

```js
  function _buildDayHtml(week, day, dayData, filteredRecipes) {
    const slots = Data.MEALS.map(meal => {
      const selected = dayData[meal] || '';
      const savedRecipe = selected ? Data.getRecipeById(selected) : null;
      const slotRecipes = (savedRecipe && !filteredRecipes.find(r => r.id === selected))
        ? [savedRecipe, ...filteredRecipes]
        : filteredRecipes;
      const kcalHtml = savedRecipe
        ? `<div class="slot-kcal">${savedRecipe.kcalTotal != null ? Math.round(savedRecipe.kcalTotal / (savedRecipe.servings || 1)) + ' kcal' : '— kcal'}</div>`
        : '';
      return `
      <div class="meal-slot">
        <span class="meal-label">${MEAL_LABELS[meal]}</span>
        <div class="meal-slot-right">
          <select onchange="Planner.setSlot(${week},'${day}','${meal}',this.value)">
            <option value="" ${!selected ? 'selected' : ''}>— none —</option>
            ${slotRecipes.map(r =>
              `<option value="${r.id}" ${selected === r.id ? 'selected' : ''}>${r.name}</option>`
            ).join('')}
          </select>
          ${kcalHtml}
        </div>
      </div>`;
    }).join('');
    return `
    <div class="planner-day">
      <div class="planner-day-header">${DAY_LABELS[day]}</div>
      ${slots}
    </div>`;
  }
```

- [ ] **Step 2: Update CSS in `css/style.css` for `.meal-slot-right` and `.slot-kcal`**

Find:
```css
.meal-slot select {
  flex: 1; min-width: 0; border: 1.5px solid var(--border); border-radius: 8px;
  padding: 6px 8px; font-size: .85rem; background: var(--bg);
  color: var(--text); outline: none; max-width: 100%;
}
.meal-slot select:focus { border-color: var(--md-green); }
```

Replace with:
```css
.meal-slot-right { display: flex; flex-direction: column; flex: 1; gap: 2px; }
.meal-slot select {
  width: 100%; min-width: 0; border: 1.5px solid var(--border); border-radius: 8px;
  padding: 6px 8px; font-size: .85rem; background: var(--bg);
  color: var(--text); outline: none;
}
.meal-slot select:focus { border-color: var(--md-green); }
.slot-kcal { font-size: 0.72rem; color: var(--text-muted); }
```

- [ ] **Step 3: Verify in browser**

Hard-refresh. Go to Planner → Meals tab:
- Meal slots with a recipe selected show a small kcal label beneath the dropdown
- Slots without a recipe show no label
- Slots with a recipe that has no `kcalTotal` show `— kcal`
- The select still fills the full available width

- [ ] **Step 4: Commit**

```bash
git add js/planner.js css/style.css
git commit -m "feat: show kcal per serving in planner meal slots"
```

---

## Task 5: Treats tab — kcal per treat row

**Files:**
- Modify: `js/planner.js`
- Modify: `css/style.css`

**Scene:** `_renderTreats()` renders each treat row. Add a kcal label showing `kcalTotal * batches`.

- [ ] **Step 1: Update `_renderTreats()` in `js/planner.js`**

Find the treat row HTML inside `_renderTreats()`:
```js
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
```

Replace with:
```js
      const treatKcal = r.kcalTotal != null
        ? (r.kcalTotal * t.batches) + ' kcal'
        : '— kcal';
      return `
      <div class="treat-row">
        <span class="treat-name">${r.name}</span>
        <div class="treat-batches">
          <button class="stepper-btn" onclick="Planner.updateTreatBatches(${i}, -1)">−</button>
          <span>${t.batches} batch${t.batches !== 1 ? 'es' : ''}</span>
          <button class="stepper-btn" onclick="Planner.updateTreatBatches(${i}, 1)">+</button>
        </div>
        <span class="treat-kcal">${treatKcal}</span>
        <button class="treat-remove" onclick="Planner.removeTreat(${i})">×</button>
      </div>`;
```

- [ ] **Step 2: Add `.treat-kcal` CSS to `css/style.css`**

Find:
```css
.treat-remove {
```

Add immediately before it:
```css
.treat-kcal { font-size: 0.82rem; color: var(--text-muted); min-width: 70px; text-align: right; }
```

- [ ] **Step 3: Verify in browser**

Hard-refresh. Go to Planner → Treats tab. Add a treat:
- Treat row shows kcal (e.g. `1840 kcal` for 1 batch of a 1840 kcal recipe)
- Clicking `+` to increase batches shows updated kcal (e.g. `3680 kcal` for 2 batches)
- Treat with no `kcalTotal` shows `— kcal`

- [ ] **Step 4: Commit**

```bash
git add js/planner.js css/style.css
git commit -m "feat: show batch kcal in treats tab"
```

---

## Task 6: Summary tab — full weekly calorie breakdown

**Files:**
- Modify: `js/planner.js`
- Modify: `css/style.css`

**Scene:** `_renderSummary()` currently shows a placeholder. Replace it with a full breakdown: one row per day showing per-meal kcal (abbreviated B/L/D) and the day total, a meals subtotal, an optional treats section, and a week grand total. Remove the `.summary-placeholder` CSS block since it will no longer be used.

- [ ] **Step 1: Replace `_renderSummary()` in `js/planner.js`**

Find the entire current `_renderSummary()`:
```js
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
```

Replace with:
```js
  function _renderSummary() {
    const el = document.getElementById('planner-grid');
    if (!el) return;
    const plan = Data.getPlan();
    const wk     = plan['week' + _currentWeek] || {};
    const treats = wk.treats || [];

    let hasMissingKcal = false;

    // Build day rows
    const dayRows = Data.DAYS.map(day => {
      const dayData = wk[day] || {};
      let dayTotal = 0;
      const parts = [];
      Data.MEALS.forEach(meal => {
        const id = dayData[meal];
        if (!id) return;
        const r = Data.getRecipeById(id);
        if (!r) return;
        const abbrev = meal[0].toUpperCase();
        if (r.kcalTotal == null) {
          hasMissingKcal = true;
          parts.push(`${abbrev}:—*`);
        } else {
          const kcal = Math.round(r.kcalTotal / (r.servings || 1));
          dayTotal += kcal;
          parts.push(`${abbrev}:${kcal}`);
        }
      });
      return { label: DAY_LABELS[day], parts, dayTotal };
    });

    const mealsTotal = dayRows.reduce((sum, d) => sum + d.dayTotal, 0);

    // Treat rows
    let treatsTotal = 0;
    const treatRows = treats.map(t => {
      const r = Data.getRecipeById(t.recipeId);
      if (!r) return null;
      const batches = t.batches || 1;
      if (r.kcalTotal == null) {
        hasMissingKcal = true;
        return { name: r.name, batches, kcal: null };
      }
      const kcal = r.kcalTotal * batches;
      treatsTotal += kcal;
      return { name: r.name, batches, kcal };
    }).filter(Boolean);

    const weekTotal = mealsTotal + treatsTotal;
    const hasContent = dayRows.some(d => d.parts.length > 0) || treatRows.length > 0;

    if (!hasContent) {
      el.innerHTML = `<div class="empty-state"><span class="emoji">📊</span>No meals planned for this week.</div>`;
      return;
    }

    const dayRowsHtml = dayRows.map(d => `
      <tr>
        <td class="summary-day">${d.label}</td>
        <td class="summary-meals">${d.parts.join(' · ') || '<span style="color:var(--text-muted)">—</span>'}</td>
        <td class="summary-day-total">${d.dayTotal > 0 ? d.dayTotal + ' kcal' : (d.parts.length ? '—' : '')}</td>
      </tr>`).join('');

    const treatSectionHtml = treatRows.length ? `
      <tr class="summary-section-header"><td colspan="3">Treats</td></tr>
      ${treatRows.map(t => `
      <tr>
        <td colspan="2" class="summary-treat-name">${t.name} ×${t.batches} ${t.batches !== 1 ? 'batches' : 'batch'}</td>
        <td class="summary-day-total">${t.kcal != null ? t.kcal + ' kcal' : '—*'}</td>
      </tr>`).join('')}
      <tr class="summary-subtotal">
        <td colspan="2">Treats total</td>
        <td class="summary-day-total">${treatsTotal > 0 ? treatsTotal + ' kcal' : '—'}</td>
      </tr>` : '';

    const footnote = hasMissingKcal
      ? `<p class="summary-footnote">* Calorie data missing — open the recipe to calculate.</p>` : '';

    el.innerHTML = `
      <div class="summary-header">Week ${_currentWeek} — Calorie Summary</div>
      <table class="summary-table">
        <tbody>
          ${dayRowsHtml}
          <tr class="summary-subtotal">
            <td colspan="2">Meals total</td>
            <td class="summary-day-total">${mealsTotal > 0 ? mealsTotal + ' kcal' : '—'}</td>
          </tr>
          ${treatSectionHtml}
          <tr class="summary-grand-total">
            <td colspan="2">Week total</td>
            <td class="summary-day-total">${weekTotal > 0 ? weekTotal + ' kcal' : '—'}</td>
          </tr>
        </tbody>
      </table>
      ${footnote}`;
  }
```

- [ ] **Step 2: Replace `.summary-placeholder` CSS and add summary table CSS in `css/style.css`**

Find:
```css
.summary-placeholder {
  text-align: center;
  padding: 48px 20px;
  color: var(--text-muted);
}
.summary-placeholder .emoji { font-size: 2rem; display: block; margin-bottom: 10px; }
.summary-placeholder .text-muted { font-size: 0.85rem; margin-top: 4px; }
```

Replace with:
```css
/* ── CALORIE SUMMARY TABLE ── */
.summary-header {
  font-weight: 700; font-size: 0.95rem;
  margin-bottom: 12px; color: var(--dk-green);
}
.summary-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
.summary-table td { padding: 6px 4px; border-bottom: 1px solid var(--border); vertical-align: top; }
.summary-day { font-weight: 500; min-width: 90px; }
.summary-meals { color: var(--text-muted); font-size: 0.8rem; }
.summary-day-total { text-align: right; white-space: nowrap; }
.summary-section-header td {
  font-weight: 700; color: var(--dk-green);
  padding-top: 12px; border-bottom: 2px solid var(--lt-green);
}
.summary-treat-name { color: var(--text-muted); }
.summary-subtotal td { font-weight: 600; border-top: 2px solid var(--border); border-bottom: none; }
.summary-grand-total td {
  font-weight: 700; font-size: 1rem; color: var(--dk-green);
  border-top: 2px solid var(--dk-green); border-bottom: none;
}
.summary-footnote { font-size: 0.78rem; color: var(--text-muted); margin-top: 12px; }
```

- [ ] **Step 3: Verify in browser**

Hard-refresh. Plan some meals and go to Planner → Summary tab:

Scenario A — all recipes have kcal:
- All 7 days shown; days with meals show `B:320 · D:650` style breakdown + day total
- Empty days show blank or `—`
- Meals total row appears
- Week total at bottom

Scenario B — some recipes missing kcal:
- Days with missing kcal show `D:—*`
- Footnote "* Calorie data missing..." appears at bottom

Scenario C — treats present:
- Treats section appears after Meals total
- Each treat shows name, batch count, total kcal
- Treats total row shown
- Week total = meals + treats

Scenario D — no meals planned at all:
- Empty state shown ("No meals planned for this week.")

- [ ] **Step 4: Commit**

```bash
git add js/planner.js css/style.css
git commit -m "feat: full calorie summary in planner Summary tab (day breakdown + week total)"
```

---

## Final smoke test

After all 6 tasks:

1. Add/edit a recipe → Calories row shows with Calculate and Enter manually options
2. Click Calculate (with Spoonacular key) → value populated
3. Click Enter manually → type `2000`, save → shows `2000 kcal · 500/serving` (for 4 servings)
4. Save recipe → reopen edit → value `2000` still shown
5. Recipe detail shows `2000 kcal · 500 kcal/serving`
6. Plan that recipe for 3 meal slots → each slot shows `500 kcal` below the dropdown
7. Add it as a treat with 2 batches → treat row shows `4000 kcal`
8. Summary tab shows day breakdown, meals total, treats section, week grand total
9. A recipe with no `kcalTotal` shows `— kcal` everywhere and `*` in summary with footnote
