/* ══════════════════════════════════════
   planner.js — 4-week meal planner
   ══════════════════════════════════════ */

const Planner = (() => {

  let _currentWeek = 1;

  const DAY_LABELS = {
    monday:'Monday', tuesday:'Tuesday', wednesday:'Wednesday',
    thursday:'Thursday', friday:'Friday', saturday:'Saturday', sunday:'Sunday',
  };
  const MEAL_LABELS = { breakfast:'Breakfast', lunch:'Lunch', dinner:'Dinner' };

  function render() {
    showWeek(_currentWeek);
  }

  function showWeek(week, tabEl) {
    _currentWeek = week;
    // Update tab styles
    if (tabEl) {
      document.querySelectorAll('.week-tab').forEach(t => t.classList.remove('active'));
      tabEl.classList.add('active');
    }

    const plan = Data.getPlan();
    const wk   = plan['week' + week] || {};
    const recipes = Data.getRecipes();

    // Build options HTML once
    const recipeOptions = `<option value="">— none —</option>` +
      recipes.map(r => `<option value="${r.id}">${r.name}</option>`).join('');

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
              <option value="" ${!selected?'selected':''}>— none —</option>
              ${recipes.map(r =>
                `<option value="${r.id}" ${selected===r.id?'selected':''}>${r.name}</option>`
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

  function setSlot(week, day, meal, recipeId) {
    Data.setMealSlot(week, day, meal, recipeId);
  }

  function generateShoppingList() {
    const plan   = Data.getPlan();
    const wk     = plan['week' + _currentWeek] || {};
    const recipes = Data.getRecipes();

    // Collect all recipe IDs used this week (deduplicated)
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

    // Aggregate ingredients
    const agg = {}; // key: "name|unit" → { name, unit, qty, recipes }
    usedIds.forEach(id => {
      const r = Data.getRecipeById(id);
      if (!r) return;
      const ings = Recipes.parseIngredients(r.ingredients);
      ings.forEach(i => {
        const key = `${i.name.toLowerCase()}|${i.unit}`;
        if (!agg[key]) agg[key] = { name: i.name, unit: i.unit, qty: 0, recipes: [] };
        agg[key].qty += parseFloat(i.qty) || 0;
        agg[key].recipes.push(r.name);
      });
    });

    const items = Object.values(agg).map(i => ({
      name: i.name,
      unit: i.unit,
      qty: i.qty > 0 ? i.qty : '',
      recipes: [...new Set(i.recipes)].join(', '),
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

  return { render, showWeek, setSlot, generateShoppingList };
})();
