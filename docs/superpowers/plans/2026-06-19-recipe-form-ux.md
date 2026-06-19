# Sub-project D: Recipe Form UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the semicolon-textarea ingredient input and free-text method textarea in the recipe add/edit modal with structured row-based inputs (ingredient rows with qty/unit/name, draggable method step rows), and extend the ingredient parser to handle container-unit strings like "1can".

**Architecture:** All changes are in `js/recipes.js` (helpers + `_showModal` + `saveModal`) and `css/style.css`. Storage format is unchanged — ingredients remain a semicolon string, method remains a newline string — so no data migration is needed. Existing recipes parse correctly on edit because `parseIngredients()` already handles the stored format.

**Tech Stack:** Vanilla JS IIFE module, `innerHTML` rendering, native HTML5 drag events (`draggable`, `dragstart`, `dragover`, `drop`), CSS variables.

---

### Task 1: Extend ingredient parser for container units (Spoonacular "1can" fix)

**Files:**
- Modify: `js/recipes.js` (lines 12–56)

**Context:** `parseIngredients()` uses a `UNITS` array and `UNIT_RE` regex to match unit tokens in ingredient strings. Spoonacular produces strings like `"1can tomatoes"` or `"2cans beans"` — these fall through all patterns because `can`/`cans` are not in `UNITS`. Fix is purely additive.

- [ ] **Step 1: Add container units to UNITS array**

  Find in `js/recipes.js`:
  ```js
  const UNITS = [
    'tablespoons','tablespoon','teaspoons','teaspoon',
    'tsps','tbsps','tsp','tbsp',
    'cups','cup','kg','g','ml','l',
    'lbs','lb','oz',
    'cloves','clove','pinch','pinches',
    'pieces','piece','slices','slice',
  ];
  ```

  Change to:
  ```js
  const UNITS = [
    'tablespoons','tablespoon','teaspoons','teaspoon',
    'tsps','tbsps','tsp','tbsp',
    'cups','cup','kg','g','ml','l',
    'lbs','lb','oz',
    'cloves','clove','pinch','pinches',
    'pieces','piece','slices','slice',
    'cans','can','jars','jar','bottles','bottle','bags','bag','packets','packet',
  ];
  ```

- [ ] **Step 2: Add normaliseUnit mappings for plurals**

  Find in `js/recipes.js`:
  ```js
  function normaliseUnit(u) {
    const map = {
      tablespoons:'tbsp', tablespoon:'tbsp', tbsps:'tbsp',
      teaspoons:'tsp', teaspoon:'tsp', tsps:'tsp',
      cups:'cup', cloves:'clove', pieces:'piece',
      slices:'slice', pinches:'pinch', lbs:'lb',
    };
    return map[u.toLowerCase()] || u.toLowerCase();
  }
  ```

  Change to:
  ```js
  function normaliseUnit(u) {
    const map = {
      tablespoons:'tbsp', tablespoon:'tbsp', tbsps:'tbsp',
      teaspoons:'tsp', teaspoon:'tsp', tsps:'tsp',
      cups:'cup', cloves:'clove', pieces:'piece',
      slices:'slice', pinches:'pinch', lbs:'lb',
      cans:'can', jars:'jar', bottles:'bottle', bags:'bag', packets:'packet',
    };
    return map[u.toLowerCase()] || u.toLowerCase();
  }
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add js/recipes.js
  git commit -m "fix(recipes): extend parser for container units — can, jar, bottle, bag, packet"
  ```

---

### Task 2: Ingredient rows — helpers, modal UI, save logic

**Files:**
- Modify: `js/recipes.js`

**Context:** We replace the `rf-ing` textarea with a `<div id="rf-ing-list">` container populated by `_renderIngRows()`. The `_ingRowHtml()` helper generates each row's HTML. `_addIngRow()` and `_removeIngRow()` are called from `onclick` attributes in the modal so they must be exported. `saveModal()` reads rows from the DOM instead of a textarea. `_esc()` already exists in this module (added in Sub-project C).

The module-level `ING_UNITS` constant is placed near the top of the IIFE, just after the existing `UNIT_RE` line.

- [ ] **Step 1: Add `ING_UNITS` constant and `_ingCount` variable after `UNIT_RE`**

  Find in `js/recipes.js`:
  ```js
  const UNIT_RE = UNITS.join('|');
  ```

  Change to:
  ```js
  const UNIT_RE = UNITS.join('|');

  const ING_UNITS = ['g','100g','kg','ml','100ml','l','item','tsp','tbsp','clove','bunch','head','can','jar','bottle','bag','packet','loaf','dozen'];

  let _ingCount = 0;
  ```

- [ ] **Step 2: Add `_ingRowHtml`, `_renderIngRows`, `_addIngRow`, `_removeIngRow` helpers**

  Find in `js/recipes.js`:
  ```js
  function fmtQty(q) {
  ```

  Insert before `fmtQty`:
  ```js
  function _ingRowHtml(n, qty, unit, name) {
    const unitOpts = ING_UNITS.map(u =>
      `<option value="${u}"${u === (unit || 'item') ? ' selected' : ''}>${u}</option>`
    ).join('');
    return `<div class="ing-row" id="ing-row-${n}">
      <input type="number" id="ing-qty-${n}" class="ing-qty-input" min="0" step="0.01"
        value="${qty != null && qty !== '' ? qty : ''}" placeholder="qty" />
      <select id="ing-unit-${n}" class="ing-unit-select">${unitOpts}</select>
      <input type="text" id="ing-name-${n}" class="ing-name-input"
        value="${_esc(name || '')}" placeholder="ingredient name" />
      <button type="button" class="btn-row-remove" onclick="Recipes._removeIngRow(${n})">✕</button>
    </div>`;
  }

  function _renderIngRows(ingredientsStr) {
    _ingCount = 0;
    const ings = parseIngredients(ingredientsStr || '');
    if (ings.length === 0) {
      _addIngRow('', 'item', '');
    } else {
      ings.forEach(ing => _addIngRow(ing.qty, ing.unit, ing.name));
    }
  }

  function _addIngRow(qty, unit, name) {
    const list = document.getElementById('rf-ing-list');
    if (!list) return;
    const n = _ingCount++;
    list.insertAdjacentHTML('beforeend', _ingRowHtml(n, qty, unit, name));
  }

  function _removeIngRow(n) {
    const row = document.getElementById('ing-row-' + n);
    if (row) row.remove();
  }

  ```

- [ ] **Step 3: Replace ingredients textarea in `_showModal` with row container**

  Find in `js/recipes.js`:
  ```js
        <div class="form-group">
          <label>Ingredients (semicolon-separated)</label>
          <textarea id="rf-ing" rows="4" placeholder="500g beef mince; 1 onion; 2 cloves garlic">${r.ingredients || ''}</textarea>
        </div>
  ```

  Change to:
  ```js
        <div class="form-group">
          <label>Ingredients</label>
          <div id="rf-ing-list"></div>
          <button type="button" class="btn-small" style="margin-top:4px" onclick="Recipes._addIngRow()">＋ Add ingredient</button>
        </div>
  ```

- [ ] **Step 4: Add `_renderIngRows` call after innerHTML in `_showModal`**

  Find in `js/recipes.js`:
  ```js
    document.getElementById('modal-overlay').classList.remove('hidden');
  }

  function saveModal(existingId) {
  ```

  Change to:
  ```js
    _renderIngRows(r.ingredients);
    document.getElementById('modal-overlay').classList.remove('hidden');
  }

  function saveModal(existingId) {
  ```

- [ ] **Step 5: Replace ingredient reading in `saveModal`**

  Find in `js/recipes.js`:
  ```js
        ingredients: document.getElementById('rf-ing').value.trim(),
  ```

  Change to:
  ```js
        ingredients: (() => {
          const parts = [];
          document.querySelectorAll('#rf-ing-list .ing-row').forEach(row => {
            const n = row.id.replace('ing-row-', '');
            const ingName = (document.getElementById('ing-name-' + n)?.value || '').trim();
            const ingQty  = (document.getElementById('ing-qty-' + n)?.value || '').trim();
            const ingUnit = document.getElementById('ing-unit-' + n)?.value || '';
            if (!ingName) return;
            if (ingQty) {
              parts.push(ingUnit ? `${ingQty} ${ingUnit} ${ingName}` : `${ingQty} ${ingName}`);
            } else {
              parts.push(ingName);
            }
          });
          return parts.join('; ');
        })(),
  ```

- [ ] **Step 6: Export `_addIngRow` and `_removeIngRow`**

  Find in `js/recipes.js`:
  ```js
    return { render, filter, openDetail, openAddModal, openEditModal, saveModal, confirmDelete,
             parseIngredients, setServings, openAddToPlanModal, confirmAddToPlan,
             editCalories, cancelEditCalories, saveCalories, calculateCalories,
             openCookConfirm, _cookRefresh, _cookAddExtra, confirmCook };
  ```

  Change to:
  ```js
    return { render, filter, openDetail, openAddModal, openEditModal, saveModal, confirmDelete,
             parseIngredients, setServings, openAddToPlanModal, confirmAddToPlan,
             editCalories, cancelEditCalories, saveCalories, calculateCalories,
             openCookConfirm, _cookRefresh, _cookAddExtra, confirmCook,
             _addIngRow, _removeIngRow };
  ```

- [ ] **Step 7: Commit**

  ```bash
  git add js/recipes.js
  git commit -m "feat(recipes): structured ingredient rows in add/edit modal"
  ```

---

### Task 3: Method step rows — helpers, drag reorder, modal UI, save logic

**Files:**
- Modify: `js/recipes.js`

**Context:** We replace the `rf-method` textarea with a `<div id="rf-step-list">` container. Each step row is `draggable="true"` with native HTML5 drag events. Module-level `_stepCount` and `_draggedStepId` track state. `_addStepRow`, `_removeStepRow`, `_stepDragStart`, `_stepDragOver`, `_stepDrop` must be exported (called from `onclick`/`ondragstart` etc. in HTML). Step numbers are not stored — they are stripped on load and re-applied on display.

- [ ] **Step 1: Add `_stepCount` and `_draggedStepId` variables after `_ingCount`**

  Find in `js/recipes.js`:
  ```js
  let _ingCount = 0;
  ```

  Change to:
  ```js
  let _ingCount = 0;
  let _stepCount = 0;
  let _draggedStepId = null;
  ```

- [ ] **Step 2: Add `_stepRowHtml`, `_renderStepRows`, `_addStepRow`, `_removeStepRow`, drag handlers**

  Find in `js/recipes.js`:
  ```js
  function _ingRowHtml(n, qty, unit, name) {
  ```

  Insert before `_ingRowHtml`:
  ```js
  function _stepRowHtml(n, text) {
    return `<div class="step-row" id="step-row-${n}" draggable="true"
        ondragstart="Recipes._stepDragStart(event,${n})"
        ondragover="Recipes._stepDragOver(event)"
        ondrop="Recipes._stepDrop(event,${n})">
      <span class="step-drag-handle" title="Drag to reorder">⠿</span>
      <input type="text" id="step-text-${n}" class="step-text-input"
        value="${_esc(text || '')}" placeholder="Describe this step…" />
      <button type="button" class="btn-row-remove" onclick="Recipes._removeStepRow(${n})">✕</button>
    </div>`;
  }

  function _renderStepRows(methodStr) {
    _stepCount = 0;
    const steps = (methodStr || '').split('\n')
      .map(s => s.replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean);
    if (steps.length === 0) {
      _addStepRow('');
    } else {
      steps.forEach(s => _addStepRow(s));
    }
  }

  function _addStepRow(text) {
    const list = document.getElementById('rf-step-list');
    if (!list) return;
    const n = _stepCount++;
    list.insertAdjacentHTML('beforeend', _stepRowHtml(n, text || ''));
  }

  function _removeStepRow(n) {
    const row = document.getElementById('step-row-' + n);
    if (row) row.remove();
  }

  function _stepDragStart(e, n) {
    _draggedStepId = n;
    e.dataTransfer.effectAllowed = 'move';
  }

  function _stepDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function _stepDrop(e, n) {
    e.preventDefault();
    if (_draggedStepId === null || _draggedStepId === n) return;
    const dragged = document.getElementById('step-row-' + _draggedStepId);
    const target  = document.getElementById('step-row-' + n);
    if (!dragged || !target) return;
    target.parentNode.insertBefore(dragged, target);
    _draggedStepId = null;
  }

  ```

- [ ] **Step 3: Replace method textarea in `_showModal` with step row container**

  Find in `js/recipes.js`:
  ```js
        <div class="form-group">
          <label>Method (one step per line)</label>
          <textarea id="rf-method" rows="5" placeholder="1. Heat pan…&#10;2. Add onion…">${r.method || ''}</textarea>
        </div>
  ```

  Change to:
  ```js
        <div class="form-group">
          <label>Method</label>
          <div id="rf-step-list"></div>
          <button type="button" class="btn-small" style="margin-top:4px" onclick="Recipes._addStepRow()">＋ Add step</button>
        </div>
  ```

- [ ] **Step 4: Add `_renderStepRows` call in `_showModal` (alongside the ingredient call)**

  Find in `js/recipes.js`:
  ```js
    _renderIngRows(r.ingredients);
    document.getElementById('modal-overlay').classList.remove('hidden');
  ```

  Change to:
  ```js
    _renderIngRows(r.ingredients);
    _renderStepRows(r.method);
    document.getElementById('modal-overlay').classList.remove('hidden');
  ```

- [ ] **Step 5: Replace method reading in `saveModal`**

  Find in `js/recipes.js`:
  ```js
        method: document.getElementById('rf-method').value.trim(),
  ```

  Change to:
  ```js
        method: (() => {
          const parts = [];
          document.querySelectorAll('#rf-step-list .step-row').forEach(row => {
            const n = row.id.replace('step-row-', '');
            const text = (document.getElementById('step-text-' + n)?.value || '').trim();
            if (text) parts.push(text);
          });
          return parts.join('\n');
        })(),
  ```

- [ ] **Step 6: Export new step functions**

  Find in `js/recipes.js`:
  ```js
    return { render, filter, openDetail, openAddModal, openEditModal, saveModal, confirmDelete,
             parseIngredients, setServings, openAddToPlanModal, confirmAddToPlan,
             editCalories, cancelEditCalories, saveCalories, calculateCalories,
             openCookConfirm, _cookRefresh, _cookAddExtra, confirmCook,
             _addIngRow, _removeIngRow };
  ```

  Change to:
  ```js
    return { render, filter, openDetail, openAddModal, openEditModal, saveModal, confirmDelete,
             parseIngredients, setServings, openAddToPlanModal, confirmAddToPlan,
             editCalories, cancelEditCalories, saveCalories, calculateCalories,
             openCookConfirm, _cookRefresh, _cookAddExtra, confirmCook,
             _addIngRow, _removeIngRow,
             _addStepRow, _removeStepRow, _stepDragStart, _stepDragOver, _stepDrop };
  ```

- [ ] **Step 7: Commit**

  ```bash
  git add js/recipes.js
  git commit -m "feat(recipes): structured method step rows with drag-to-reorder"
  ```

---

### Task 4: CSS — ingredient row and step row styles

**Files:**
- Modify: `css/style.css`

**Context:** Append at the end of the file after the Sub-project C block. Uses existing CSS variables (`--border`, `--card-bg`, `--text-muted`, `--md-green`).

- [ ] **Step 1: Append styles to `css/style.css`**

  Append at the very end of the file:
  ```css

  /* ── Recipe form row inputs (Sub-project D) ───────── */

  /* Shared row layout */
  .ing-row,
  .step-row { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }

  /* Ingredient row inputs */
  .ing-qty-input { width: 65px; padding: 5px 8px; border: 1px solid var(--border); border-radius: 8px; font-size: 0.9rem; background: var(--card-bg); color: inherit; }
  .ing-unit-select { padding: 5px 6px; border: 1px solid var(--border); border-radius: 8px; font-size: 0.85rem; background: var(--card-bg); color: inherit; }
  .ing-name-input { flex: 1; min-width: 0; padding: 5px 8px; border: 1px solid var(--border); border-radius: 8px; font-size: 0.9rem; background: var(--card-bg); color: inherit; }

  /* Step row inputs */
  .step-text-input { flex: 1; min-width: 0; padding: 5px 8px; border: 1px solid var(--border); border-radius: 8px; font-size: 0.9rem; background: var(--card-bg); color: inherit; }
  .step-drag-handle { cursor: grab; color: var(--text-muted); font-size: 1.1rem; padding: 0 2px; user-select: none; flex-shrink: 0; }
  .step-drag-handle:active { cursor: grabbing; }
  .step-row.drag-over { border-top: 2px solid var(--md-green); }

  /* Shared remove button */
  .btn-row-remove { background: none; border: none; cursor: pointer; color: var(--text-muted); font-size: 1rem; padding: 2px 6px; line-height: 1; flex-shrink: 0; }
  .btn-row-remove:hover { color: #c62828; }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add css/style.css
  git commit -m "feat(css): ingredient and method step row styles"
  ```
