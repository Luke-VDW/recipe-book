# Ingredient Autocomplete — Implementation Plan

> Design: `docs/superpowers/specs/2026-06-27-ingredient-autocomplete-design.md`

**Goal:** As the user types an ingredient name in the recipe add/edit modal,
show a dropdown of existing ingredient-book names to pick from; free text is
always allowed when there's no match.

**Architecture:** All changes are in `js/recipes.js`. A native `<datalist>`
(`id="ing-name-options"`), populated from `Data.getPriceBook()`, is rendered
once inside the ingredients form-group. Every ingredient-name input references
it via `list="ing-name-options"`. Storage format is unchanged — no migration.

**Tech Stack:** Vanilla JS IIFE module, `innerHTML` rendering, native HTML5
`<datalist>`.

---

### Task 1: Build the datalist and wire it to ingredient name inputs

**Files:**
- Modify: `js/recipes.js`

- [ ] **Step 1: Add `_ingDatalistHtml()` helper**

  Find in `js/recipes.js`:
  ```js
  function _ingRowHtml(n, qty, unit, name) {
  ```

  Insert before `_ingRowHtml`:
  ```js
  function _ingDatalistHtml() {
    const seen = new Set();
    const names = [];
    (typeof Data !== 'undefined' ? Data.getPriceBook() : []).forEach(c => {
      const name = (c.ingredient || '').trim();
      const key = name.toLowerCase();
      if (!name || seen.has(key)) return;
      seen.add(key);
      names.push(name);
    });
    names.sort((a, b) => a.localeCompare(b));
    return `<datalist id="ing-name-options">${
      names.map(n => `<option value="${_esc(n)}"></option>`).join('')
    }</datalist>`;
  }
  ```

- [ ] **Step 2: Point the name input at the datalist**

  Find in `js/recipes.js`:
  ```js
      <input type="text" id="ing-name-${n}" class="ing-name-input"
        value="${_esc(name || '')}" placeholder="ingredient name" />
  ```

  Change to:
  ```js
      <input type="text" id="ing-name-${n}" class="ing-name-input"
        list="ing-name-options" autocomplete="off"
        value="${_esc(name || '')}" placeholder="ingredient name" />
  ```

- [ ] **Step 3: Render the datalist once in the modal**

  Find in `js/recipes.js`:
  ```js
      <div class="form-group">
        <label>Ingredients</label>
        <div id="rf-ing-list"></div>
        <button type="button" class="btn-small" style="margin-top:4px" onclick="Recipes._addIngRow()">＋ Add ingredient</button>
      </div>
  ```

  Change to:
  ```js
      <div class="form-group">
        <label>Ingredients</label>
        <div id="rf-ing-list"></div>
        ${_ingDatalistHtml()}
        <button type="button" class="btn-small" style="margin-top:4px" onclick="Recipes._addIngRow()">＋ Add ingredient</button>
      </div>
  ```

- [ ] **Step 4: Manual verification**

  Serve the app (`python -m http.server 8000`), open a recipe to edit (or add a
  new one), and type in an ingredient name field. Confirm:
  - suggestions from the ingredient book appear and filter as you type;
  - selecting one fills the input with the exact stored name;
  - typing a brand-new name still works and saves normally;
  - newly added rows (＋ Add ingredient) also show suggestions.

- [ ] **Step 5: Commit**

  ```bash
  git add js/recipes.js
  git commit -m "feat(recipes): autocomplete ingredient names from the ingredient book"
  ```
