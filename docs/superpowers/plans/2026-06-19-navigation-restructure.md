# Sub-project G: Navigation Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Import nav tab with a Pantry tab; move import access to a FAB menu on the Recipes screen; add search clear (×) buttons to all four search bars.

**Architecture:** Changes split across two tasks: (1) `index.html` restructure — nav, FAB menu, pantry view "Price Book" link, Settings cleanup, search clear buttons; (2) `js/app.js` — new `toggleFabMenu`/`closeFabMenu`, updated `nav()` to handle pantry tab and FAB close; (3) `css/style.css` — FAB menu and clear button styles. No module API changes.

**Tech Stack:** Vanilla HTML/JS, CSS variables. No build step. Verify by opening `http://localhost:8000` in browser.

---

### Task 1: `index.html` — nav, FAB menu, pantry enhancements, settings cleanup, search clear buttons

**Files:**
- Modify: `index.html`

**Context:** The FAB (line 49) is inside `#view-recipes`. The bottom nav (lines 193-213) has 5 buttons. Settings (lines 107-148) has sections for Price Book and Pantry that will be removed. The pantry view (lines 166-179) gets a "Price Book →" button. All four search bars (recipe line 29, import line 98, pb line 159, pantry line 174) get clear buttons.

- [ ] **Step 1: Replace FAB with FAB + menu**

  Find in `index.html`:
  ```html
        <button class="fab" onclick="Recipes.openAddModal()">＋</button>
  ```

  Change to:
  ```html
        <div id="fab-menu" class="fab-menu hidden">
          <button class="fab-menu-item" onclick="App.closeFabMenu(); Recipes.openAddModal()">＋ Add manually</button>
          <button class="fab-menu-item" onclick="App.closeFabMenu(); App.nav('import', null)">🔍 Import recipe</button>
        </div>
        <button class="fab" onclick="App.toggleFabMenu()">＋</button>
  ```

- [ ] **Step 2: Replace Import nav tab with Pantry tab**

  Find in `index.html`:
  ```html
    <button class="nav-btn" data-view="import" onclick="App.nav('import',this)">
      <span class="nav-icon">🔍</span>
      <span class="nav-label">Import</span>
    </button>
  ```

  Change to:
  ```html
    <button class="nav-btn" data-view="pantry" onclick="App.nav('pantry',this)">
      <span class="nav-icon">🧺</span>
      <span class="nav-label">Pantry</span>
    </button>
  ```

- [ ] **Step 3: Add "Price Book →" button inside pantry view**

  Find in `index.html`:
  ```html
      <div id="pantry-list"></div>
      <button class="pantry-add-btn" onclick="Pantry.openAddForm()">＋ Add item</button>
  ```

  Change to:
  ```html
      <button class="btn-secondary" style="margin-bottom:8px;width:100%" onclick="App.pushView('pricebook','Price Book'); PriceBook.render()">📋 Price Book →</button>
      <div id="pantry-list"></div>
      <button class="pantry-add-btn" onclick="Pantry.openAddForm()">＋ Add item</button>
  ```

- [ ] **Step 4: Remove Pantry and Price Book sections from Settings**

  Find in `index.html`:
  ```html
      <div class="settings-group">
        <h3>Price Book</h3>
        <p class="hint">Store prices for ingredients to estimate weekly shopping costs.</p>
        <button class="btn-secondary" onclick="App.pushView('pricebook','Price Book'); PriceBook.render()">Manage Price Book →</button>
      </div>
      <div class="settings-group">
        <h3>Pantry</h3>
        <p class="hint">Track what you have at home. Shopping list shows stock levels automatically.</p>
        <button class="btn-secondary" onclick="App.pushView('pantry','Pantry'); Pantry.render()">Manage Pantry →</button>
      </div>
  ```

  Delete those two `<div class="settings-group">` blocks entirely (replace with empty string).

- [ ] **Step 5: Add clear button to recipe search bar**

  Find in `index.html`:
  ```html
      <div class="search-bar">
        <input id="recipe-search" type="search" placeholder="Search recipes…" oninput="Recipes.filter()" />
  ```

  Change to:
  ```html
      <div class="search-bar">
        <input id="recipe-search" type="search" placeholder="Search recipes…" oninput="Recipes.filter()" />
        <button class="search-clear" onclick="document.getElementById('recipe-search').value='';Recipes.filter()" title="Clear">×</button>
  ```

- [ ] **Step 6: Add clear button to import search bar**

  Find in `index.html`:
  ```html
        <input id="import-search" type="search" placeholder="Search Spoonacular…" />
  ```

  Change to:
  ```html
        <input id="import-search" type="search" placeholder="Search Spoonacular…" />
        <button class="search-clear" onclick="document.getElementById('import-search').value=''" title="Clear">×</button>
  ```

- [ ] **Step 7: Add clear button to price book search bar**

  Find in `index.html`:
  ```html
        <input id="pb-search" type="search" placeholder="Search ingredients…"
          oninput="PriceBook.filter()" />
  ```

  Change to:
  ```html
        <input id="pb-search" type="search" placeholder="Search ingredients…"
          oninput="PriceBook.filter()" />
        <button class="search-clear" onclick="document.getElementById('pb-search').value='';PriceBook.filter()" title="Clear">×</button>
  ```

- [ ] **Step 8: Add clear button to pantry search bar**

  Find in `index.html`:
  ```html
        <input id="pantry-search" type="search" placeholder="Search pantry…" oninput="Pantry.filter()" />
  ```

  Change to:
  ```html
        <input id="pantry-search" type="search" placeholder="Search pantry…" oninput="Pantry.filter()" />
        <button class="search-clear" onclick="document.getElementById('pantry-search').value='';Pantry.filter()" title="Clear">×</button>
  ```

- [ ] **Step 9: Commit**

  ```bash
  git add index.html
  git commit -m "feat(nav): pantry tab, FAB menu for add/import, search clear buttons, settings cleanup"
  ```

---

### Task 2: `js/app.js` — FAB menu functions, pantry nav support

**Files:**
- Modify: `js/app.js`

**Context:** `App.nav(viewName, btnEl)` is the main tab switch function. It currently handles lazy renders for planner, shopping, settings, recipes. It does NOT handle pantry or import. The return statement (line 249) exports the public API. `_checkImportKey()` is a private function that shows the "Add Spoonacular key" notice in the import view.

- [ ] **Step 1: Add `toggleFabMenu` and `closeFabMenu` functions before the return statement**

  Find in `js/app.js`:
  ```js
    return { init, nav, pushView, goBack, closeModal, refresh, toast };
  ```

  Change to:
  ```js
    function toggleFabMenu() {
      const menu = document.getElementById('fab-menu');
      if (!menu) return;
      menu.classList.toggle('hidden');
    }

    function closeFabMenu() {
      const menu = document.getElementById('fab-menu');
      if (menu) menu.classList.add('hidden');
    }

    return { init, nav, pushView, goBack, closeModal, refresh, toast, toggleFabMenu, closeFabMenu };
  ```

- [ ] **Step 2: Add `closeFabMenu()` call at the top of `nav()`**

  Find in `js/app.js`:
  ```js
    function nav(viewName, btnEl) {
      // Update nav buttons
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  ```

  Change to:
  ```js
    function nav(viewName, btnEl) {
      closeFabMenu();
      // Update nav buttons
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  ```

- [ ] **Step 3: Add pantry lazy render and import key check in `nav()`**

  Find in `js/app.js`:
  ```js
      // Lazy renders
      if (viewName === 'planner')  Planner.render();
      if (viewName === 'shopping') Shopping.render();
      if (viewName === 'settings') { Settings.init(); _checkImportKey(); }
      if (viewName === 'recipes')  Recipes.render();
  ```

  Change to:
  ```js
      // Lazy renders
      if (viewName === 'planner')  Planner.render();
      if (viewName === 'shopping') Shopping.render();
      if (viewName === 'settings') { Settings.init(); _checkImportKey(); }
      if (viewName === 'recipes')  Recipes.render();
      if (viewName === 'pantry')   Pantry.render();
      if (viewName === 'import')   _checkImportKey();
  ```

- [ ] **Step 4: Add pantry to the topbar titles map in `nav()`**

  Find in `js/app.js`:
  ```js
      const titles = {
        recipes:'📖 Recipe Book', planner:'🗓 Meal Planner',
        shopping:'🛒 Shopping List', import:'🔍 Import Recipe',
        settings:'⚙️ Settings', detail:'',
      };
  ```

  Change to:
  ```js
      const titles = {
        recipes:'📖 Recipe Book', planner:'🗓 Meal Planner',
        shopping:'🛒 Shopping List', import:'🔍 Import Recipe',
        settings:'⚙️ Settings', detail:'', pantry:'🧺 Pantry',
      };
  ```

- [ ] **Step 5: Add pantry to the `goBack()` titles map**

  Find in `js/app.js`:
  ```js
        const titles = {
          recipes:'📖 Recipe Book', planner:'🗓 Meal Planner',
          shopping:'🛒 Shopping List', import:'🔍 Import Recipe', settings:'⚙️ Settings',
        };
  ```

  Change to:
  ```js
        const titles = {
          recipes:'📖 Recipe Book', planner:'🗓 Meal Planner',
          shopping:'🛒 Shopping List', import:'🔍 Import Recipe',
          settings:'⚙️ Settings', pantry:'🧺 Pantry',
        };
  ```

- [ ] **Step 6: Add outside-click handler to close the FAB menu in `init()`**

  Find in `js/app.js`:
  ```js
      // Handle browser back
      window.addEventListener('popstate', () => {
  ```

  Insert before it:
  ```js
      // Close FAB menu on outside click
      document.addEventListener('click', e => {
        const menu = document.getElementById('fab-menu');
        const fab = document.querySelector('.fab');
        if (menu && !menu.classList.contains('hidden') &&
            !menu.contains(e.target) && e.target !== fab) {
          menu.classList.add('hidden');
        }
      });

  ```

- [ ] **Step 7: Commit**

  ```bash
  git add js/app.js
  git commit -m "feat(app): FAB menu toggle, pantry tab support, import key check"
  ```

---

### Task 3: CSS — FAB menu and search clear button styles

**Files:**
- Modify: `css/style.css`

**Context:** The FAB uses `position: fixed`. The nav height CSS variable is `--nav-h`. The FAB menu should appear above the FAB, fixed to the bottom-right. The search clear button sits inside the `.search-bar` div as a sibling to the input.

- [ ] **Step 1: Append styles to `css/style.css`**

  Append at the very end of the file:
  ```css

  /* ── FAB menu (Sub-project G) ───────── */
  .fab-menu {
    position: fixed;
    bottom: calc(var(--nav-h) + 68px);
    right: 16px;
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,.18);
    overflow: hidden;
    z-index: 200;
    min-width: 180px;
  }
  .fab-menu-item {
    display: block;
    width: 100%;
    padding: 13px 18px;
    border: none;
    background: none;
    cursor: pointer;
    font-size: 0.95rem;
    text-align: left;
    color: inherit;
    white-space: nowrap;
  }
  .fab-menu-item:hover { background: var(--lt-green); }
  .fab-menu-item + .fab-menu-item { border-top: 1px solid var(--border); }

  /* ── Search clear button (Sub-project G) ── */
  .search-bar { position: relative; }
  .search-clear {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-muted);
    font-size: 1.1rem;
    line-height: 1;
    padding: 4px 6px;
  }
  .search-clear:hover { color: var(--dk-green); }
  ```

  Note: the `.search-bar { position: relative; }` rule needs to only apply where there is a clear button. If the search bar already has other positioned children this could conflict. If needed, add `position: relative` inline via `style="position:relative"` on each `.search-bar` div instead, and remove the CSS rule. Prefer the CSS rule unless it breaks something.

- [ ] **Step 2: Commit**

  ```bash
  git add css/style.css
  git commit -m "feat(css): FAB menu and search clear button styles"
  ```
