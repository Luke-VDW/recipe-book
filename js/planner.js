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
    App.toast('Treats coming soon', 'warn');
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
