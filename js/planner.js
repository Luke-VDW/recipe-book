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

  function render() {
    document.querySelectorAll('.inner-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.tab === _currentTab)
    );
    const plannerView = document.getElementById('view-planner');
    if (plannerView) plannerView.classList.toggle('meals-active', _currentTab === 'meals');
    if (plannerView) plannerView.classList.toggle('filter-active', _currentTab === 'meals' || _currentTab === 'treats');
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
    const plan = Data.getPlan();
    const wk     = plan['week' + _currentWeek] || {};
    const treats = wk.treats || [];

    const filterLower = _recipeFilter.toLowerCase();
    const rows = treats.map((t, i) => {
      const r = Data.getRecipeById(t.recipeId);
      if (!r) return '';
      if (filterLower && !r.name.toLowerCase().includes(filterLower)) return '';
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
    }).filter(Boolean).join('');

    const emptyHtml = rows === ''
      ? `<div class="empty-state"><span class="emoji">🍰</span>No treats this week. Tap ＋ to add one.</div>`
      : '';

    el.innerHTML = `
    <div class="treats-list">${emptyHtml}${rows}</div>
    <button class="btn-secondary treat-add-btn" onclick="Planner.openAddTreatModal()">＋ Add treat</button>`;
  }

  function _renderSummary() {
    const el = document.getElementById('planner-grid');
    if (!el) return;
    const plan = Data.getPlan();
    const wk     = plan['week' + _currentWeek] || {};
    const treats = wk.treats || [];

    let hasMissingKcal = false;

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

  return { render, showWeek, showTab, setSlot, generateShoppingList, filterRecipes,
           openAddTreatModal, confirmAddTreat, removeTreat, updateTreatBatches };
})();
