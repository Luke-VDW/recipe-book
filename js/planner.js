/* ══════════════════════════════════════
   planner.js — 4-week meal planner
   ══════════════════════════════════════ */

const Planner = (() => {

  let _currentWeek = 1;
  let _recipeFilter = '';
  let _filterTimer = null;

  const DAY_LABELS = {
    monday:'Monday', tuesday:'Tuesday', wednesday:'Wednesday',
    thursday:'Thursday', friday:'Friday', saturday:'Saturday', sunday:'Sunday',
  };
  const MEAL_LABELS = { breakfast:'Breakfast', lunch:'Lunch', dinner:'Dinner' };

  // Fix 4 — extracted desktop breakpoint helper
  function _isDesktop() {
    return window.matchMedia('(min-width: 900px)').matches;
  }

  // Fix 3 — extracted shared day/slot rendering helper
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
    if (_isDesktop()) {
      _renderAll();
    } else {
      showWeek(_currentWeek);
    }
    // Fix 1 — desktop global button has no week number (per-section buttons are the desktop CTAs)
    const genBtn = document.getElementById('btn-generate-shopping');
    if (genBtn) {
      genBtn.textContent = _isDesktop()
        ? '🛒 Generate Shopping List'
        : `🛒 Generate Week ${_currentWeek} List`;
    }
  }

  function showWeek(week, tabEl) {
    _currentWeek = week;
    if (tabEl) {
      document.querySelectorAll('.week-tab').forEach(t => t.classList.remove('active'));
      tabEl.classList.add('active');
    }

    if (_isDesktop()) {
      const section = document.getElementById('planner-week-' + week);
      if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    const plan = Data.getPlan();
    const wk   = plan['week' + week] || {};
    // Fix 5 — hoist toLowerCase() call
    const filterLower = _recipeFilter.toLowerCase();
    const recipes = Data.getRecipes().filter(r =>
      !filterLower || r.name.toLowerCase().includes(filterLower)
    );

    const el = document.getElementById('planner-grid');
    if (!el) return;

    // Fix 3 — use shared helper
    el.innerHTML = Data.DAYS.map(day =>
      _buildDayHtml(week, day, wk[day] || {}, recipes)
    ).join('');
  }

  function _renderAll() {
    const plan = Data.getPlan();
    // Fix 5 — hoist toLowerCase() call
    const filterLower = _recipeFilter.toLowerCase();
    const recipes = Data.getRecipes().filter(r =>
      !filterLower || r.name.toLowerCase().includes(filterLower)
    );
    const el = document.getElementById('planner-grid');
    if (!el) return;

    el.innerHTML = [1, 2, 3, 4].map(week => {
      const wk = plan['week' + week] || {};
      // Fix 3 — use shared helper
      const daysHtml = Data.DAYS.map(day =>
        _buildDayHtml(week, day, wk[day] || {}, recipes)
      ).join('');
      // Fix 1 — per-week generate button in each week header
      return `
      <div class="planner-week-section" id="planner-week-${week}">
        <div class="planner-week-header">
          Week ${week}
          <button class="btn-mini-generate" onclick="Planner.generateForWeek(${week})">🛒</button>
        </div>
        <div class="planner-week-grid">${daysHtml}</div>
      </div>`;
    }).join('');
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

    const agg = {}; // key: "name|unit" → { name, unit, qty, sources }
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
      name: i.name,
      unit: i.unit,
      qty: i.qty > 0 ? i.qty : '',
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

  // Fix 1 — new function: set week then generate
  function generateForWeek(week) {
    _currentWeek = week;
    generateShoppingList();
  }

  let _resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(_resizeTimer);
    // Fix 2 — match filter debounce (250ms) to avoid stale render race
    _resizeTimer = setTimeout(() => {
      if (document.getElementById('view-planner')?.classList.contains('active')) {
        render();
      }
    }, 250);
  });

  return { render, showWeek, setSlot, generateShoppingList, generateForWeek, filterRecipes };
})();
