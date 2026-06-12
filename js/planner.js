/* ══════════════════════════════════════
   planner.js — 4-week meal planner
   ══════════════════════════════════════ */

const Planner = (() => {

  let _currentWeek = 1;
  let _recipeFilter = '';

  const DAY_LABELS = {
    monday:'Monday', tuesday:'Tuesday', wednesday:'Wednesday',
    thursday:'Thursday', friday:'Friday', saturday:'Saturday', sunday:'Sunday',
  };
  const MEAL_LABELS = { breakfast:'Breakfast', lunch:'Lunch', dinner:'Dinner' };

  function render() {
    if (window.matchMedia('(min-width: 900px)').matches) {
      _renderAll();
    } else {
      showWeek(_currentWeek);
    }
  }

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

  function filterRecipes() {
    _recipeFilter = (document.getElementById('planner-recipe-filter')?.value || '').trim();
    render();
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

  return { render, showWeek, setSlot, generateShoppingList, filterRecipes };
})();
