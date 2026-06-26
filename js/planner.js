/* ══════════════════════════════════════
   planner.js — 4-week meal planner
   ══════════════════════════════════════ */

const Planner = (() => {

  let _currentWeek = 1;
  let _currentTab  = 'meals'; // 'meals' | 'treats' | 'summary'
  let _recipeFilter = '';
  let _filterTimer = null;
  let _pendingSlots = {}; // key: "week-day-meal" → count of pending empty selects

  function _slotKey(w, d, m) { return w + '-' + d + '-' + m; }

  const DAY_LABELS = {
    monday:'Monday', tuesday:'Tuesday', wednesday:'Wednesday',
    thursday:'Thursday', friday:'Friday', saturday:'Saturday', sunday:'Sunday',
  };
  const MEAL_LABELS = { breakfast:'Breakfast', lunch:'Lunch', dinner:'Dinner' };

  function _normSlot(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val.filter(Boolean);
    return [val];
  }

  function _buildDayHtml(week, day, dayData, filteredRecipes) {
    const slots = Data.MEALS.map(meal => {
      const filledIds = _normSlot(dayData[meal]);
      const key = _slotKey(week, day, meal);
      const pendingCount = _pendingSlots[key] || 0;

      // displayEntries = all filled recipe IDs + N pending empty strings
      const displayEntries = [...filledIds];
      for (let p = 0; p < pendingCount; p++) displayEntries.push('');
      if (displayEntries.length === 0) displayEntries.push(''); // always ≥1

      const entryHtml = displayEntries.map((selectedId, idx) => {
        const savedRecipe = selectedId ? Data.getRecipeById(selectedId) : null;
        const slotRecipes = (savedRecipe && !filteredRecipes.find(r => r.id === selectedId))
          ? [savedRecipe, ...filteredRecipes]
          : filteredRecipes;

        const removeBtn = displayEntries.length > 1
          ? `<button class="meal-entry-remove" onclick="Planner.removeMealRecipe(${week},'${day}','${meal}',${idx})" title="Remove">✕</button>`
          : '';

        const isLast = idx === displayEntries.length - 1;
        const canAdd = isLast && !!selectedId && displayEntries.length < 4;
        const kcalText = savedRecipe
          ? (savedRecipe.kcalTotal != null
              ? Math.round(savedRecipe.kcalTotal / (savedRecipe.servings || 1)) + ' kcal'
              : '— kcal')
          : '';
        const addBtn = canAdd
          ? `<button class="meal-add-btn" onclick="Planner.addMealRecipe(${week},'${day}','${meal}')" title="Add another">＋</button>`
          : '';
        const footerHtml = (kcalText || addBtn)
          ? `<div class="meal-slot-footer"><span class="slot-kcal">${kcalText}</span>${addBtn}</div>`
          : '';

        return `<div class="meal-slot-entry">
          <div class="meal-slot-entry-row">
            <select onchange="Planner.setSlot(${week},'${day}','${meal}',${idx},this.value)">
              <option value="" ${!selectedId ? 'selected' : ''}>— none —</option>
              ${slotRecipes.map(r =>
                `<option value="${r.id}" ${selectedId === r.id ? 'selected' : ''}>${r.name}</option>`
              ).join('')}
            </select>
            ${removeBtn}
          </div>
          ${footerHtml}
        </div>`;
      }).join('');

      return `
      <div class="meal-slot">
        <span class="meal-label">${MEAL_LABELS[meal]}</span>
        <div class="meal-slot-right">${entryHtml}</div>
      </div>`;
    }).join('');
    return `
    <div class="planner-day">
      <div class="planner-day-header">${DAY_LABELS[day]}</div>
      ${slots}
    </div>`;
  }

  function _calcRecipeCost(recipe) {
    const ingredients = Recipes.parseIngredients(recipe.ingredients);
    if (!ingredients.length) return { cost: 0, partial: true };
    let total = 0;
    let partial = false;
    for (const ing of ingredients) {
      const cost = Data.lookupPrice(ing.name, ing.qty, ing.unit);
      if (cost === null) partial = true;
      else total += cost;
    }
    return { cost: Math.round((total / (recipe.servings || 1)) * 100) / 100, partial };
  }

  function _renderCostSection(wk, treats) {
    let hasMissingPrice = false;

    const dayRows = Data.DAYS.map(day => {
      const dayData = wk[day] || {};
      let dayTotal = 0;
      let dayPartial = false;
      const parts = [];
      Data.MEALS.forEach(meal => {
        const ids = _normSlot(dayData[meal]);
        if (ids.length === 0) return;
        let slotCost = 0;
        let slotPartial = false;
        ids.forEach(id => {
          if (!id) return;
          const r = Data.getRecipeById(id);
          if (!r) return;
          const { cost, partial } = _calcRecipeCost(r);
          if (partial) { hasMissingPrice = true; slotPartial = true; }
          slotCost += cost;
        });
        const abbrev = meal[0].toUpperCase();
        if (slotPartial) dayPartial = true;
        dayTotal += slotCost;
        parts.push(`${abbrev}:${slotPartial ? '~' : ''}R${slotCost.toFixed(0)}`);
      });
      return { label: DAY_LABELS[day], parts, dayTotal, dayPartial };
    });

    const mealsTotal = dayRows.reduce((sum, d) => sum + d.dayTotal, 0);

    let treatsTotal = 0;
    const treatRows = treats.map(t => {
      const r = Data.getRecipeById(t.recipeId);
      if (!r) return null;
      const { cost, partial } = _calcRecipeCost(r);
      const total = cost * (t.batches || 1);
      treatsTotal += total;
      if (partial) hasMissingPrice = true;
      return { name: r.name, batches: t.batches || 1, cost: total, partial };
    }).filter(Boolean);

    const weekTotal = mealsTotal + treatsTotal;
    const hasContent = dayRows.some(d => d.parts.length > 0) || treatRows.length > 0;
    if (!hasContent) return '';

    const dayRowsHtml = dayRows.map(d => `
      <tr>
        <td class="summary-day">${d.label}</td>
        <td class="summary-meals">${d.parts.join(' · ') || '<span style="color:var(--text-muted)">—</span>'}</td>
        <td class="summary-day-total">${d.dayTotal > 0 ? (d.dayPartial ? '~' : '') + 'R ' + d.dayTotal.toFixed(2) : (d.parts.length ? '—' : '')}</td>
      </tr>`).join('');

    const treatSectionHtml = treatRows.length ? `
      <tr class="summary-section-header"><td colspan="3">Treats</td></tr>
      ${treatRows.map(t => `
      <tr>
        <td colspan="2" class="summary-treat-name">${t.name} ×${t.batches} ${t.batches !== 1 ? 'batches' : 'batch'}</td>
        <td class="summary-day-total">${t.partial ? '~' : ''}R ${t.cost.toFixed(2)}</td>
      </tr>`).join('')}
      <tr class="summary-subtotal">
        <td colspan="2">Treats total</td>
        <td class="summary-day-total">${treatsTotal > 0 ? 'R ' + treatsTotal.toFixed(2) : '—'}</td>
      </tr>` : '';

    const footnote = hasMissingPrice
      ? `<p class="summary-footnote">~ Some ingredients unpriced — open Price Book to add missing prices.</p>` : '';

    return `
      <div class="summary-header">Week ${_currentWeek} — Estimated Cost</div>
      <table class="summary-table">
        <tbody>
          ${dayRowsHtml}
          <tr class="summary-subtotal">
            <td colspan="2">Meals total</td>
            <td class="summary-day-total">${mealsTotal > 0 ? 'R ' + mealsTotal.toFixed(2) : '—'}</td>
          </tr>
          ${treatSectionHtml}
          <tr class="summary-grand-total">
            <td colspan="2">Week total</td>
            <td class="summary-day-total">${weekTotal > 0 ? 'R ' + weekTotal.toFixed(2) : '—'}</td>
          </tr>
        </tbody>
      </table>
      ${footnote}`;
  }

  function render() {
    document.querySelectorAll('.inner-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.tab === _currentTab)
    );
    const plannerView = document.getElementById('view-planner');
    if (plannerView) plannerView.classList.toggle('meals-active', _currentTab === 'meals');
    if (plannerView) plannerView.classList.toggle('filter-active', _currentTab === 'meals' || _currentTab === 'treats');
    if (_currentTab === 'meals')   _renderMeals();
    if (_currentTab === 'treats')  _renderTreats();
    if (_currentTab === 'summary') _renderSummary();
  }

  function showWeek(week, tabEl) {
    _currentWeek = week;
    _currentTab = 'meals';
    _pendingSlots = {};
    if (tabEl) {
      document.querySelectorAll('.week-tab').forEach(t => t.classList.remove('active'));
      tabEl.classList.add('active');
    }
    render();
  }

  function showTab(tab) {
    _currentTab = tab;
    // Update search placeholder and clear results when switching tabs
    const filterInput = document.getElementById('planner-recipe-filter');
    if (filterInput) {
      filterInput.placeholder = tab === 'treats' ? 'Search recipes to add…' : 'Filter recipes…';
      filterInput.value = '';
    }
    _recipeFilter = '';
    const resultsEl = document.getElementById('treat-search-results');
    if (resultsEl) { resultsEl.innerHTML = ''; resultsEl.classList.add('hidden'); }
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

    const rows = treats.map((t, i) => {
      const r = Data.getRecipeById(t.recipeId);
      if (!r) return '';
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
        const ids = _normSlot(dayData[meal]);
        if (ids.length === 0) return;
        let slotKcal = 0;
        let slotMissing = false;
        ids.forEach(id => {
          if (!id) return;
          const r = Data.getRecipeById(id);
          if (!r) return;
          if (r.kcalTotal == null) { hasMissingKcal = true; slotMissing = true; }
          else slotKcal += Math.round(r.kcalTotal / (r.servings || 1));
        });
        const abbrev = meal[0].toUpperCase();
        if (slotMissing) parts.push(`${abbrev}:—*`);
        else { dayTotal += slotKcal; parts.push(`${abbrev}:${slotKcal}`); }
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
      ${footnote}
      ${_renderCostSection(wk, treats)}`;
  }

  function filterRecipes() {
    clearTimeout(_filterTimer);
    _filterTimer = setTimeout(() => {
      const query = (document.getElementById('planner-recipe-filter')?.value || '').trim();
      if (_currentTab === 'treats') {
        _renderTreatSearchResults(query);
      } else {
        _recipeFilter = query;
        render();
      }
    }, 200);
  }

  function _esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _renderTreatSearchResults(query) {
    const resultsEl = document.getElementById('treat-search-results');
    if (!resultsEl) return;
    if (!query) {
      resultsEl.innerHTML = '';
      resultsEl.classList.add('hidden');
      return;
    }
    const lower = query.toLowerCase();
    const matches = Data.getRecipes()
      .filter(r => r.name.toLowerCase().includes(lower))
      .slice(0, 8);
    if (matches.length === 0) {
      resultsEl.innerHTML = `<div class="treat-search-empty">No recipes match "${_esc(query)}"</div>`;
      resultsEl.classList.remove('hidden');
      return;
    }
    resultsEl.innerHTML = matches.map(r =>
      `<div class="treat-search-result" onclick="Planner.addTreatDirect('${_esc(r.id)}')">
        <span class="treat-search-name">${_esc(r.name)}</span>
        ${r.category ? `<span class="treat-search-cat">${_esc(r.category)}</span>` : ''}
      </div>`
    ).join('');
    resultsEl.classList.remove('hidden');
  }

  function addTreatDirect(recipeId) {
    const plan   = Data.getPlan();
    const wk     = plan['week' + _currentWeek] || {};
    const treats = [...(wk.treats || [])];
    const existing = treats.findIndex(t => t.recipeId === recipeId);
    if (existing >= 0) {
      treats[existing] = { ...treats[existing], batches: (treats[existing].batches || 1) + 1 };
    } else {
      treats.push({ recipeId, batches: 1 });
    }
    Data.setTreats(_currentWeek, treats);
    // Clear search
    const filterInput = document.getElementById('planner-recipe-filter');
    if (filterInput) filterInput.value = '';
    const resultsEl = document.getElementById('treat-search-results');
    if (resultsEl) { resultsEl.innerHTML = ''; resultsEl.classList.add('hidden'); }
    render();
    const r = Data.getRecipeById(recipeId);
    App.toast((r ? r.name : 'Treat') + ' added ✓');
  }

  function setSlot(week, day, meal, idx, recipeId) {
    const plan = Data.getPlan();
    const filledIds = _normSlot(((plan['week' + week] || {})[day] || {})[meal]);
    const wasPending = idx >= filledIds.length;
    if (recipeId) {
      Data.setMealSlot(week, day, meal, idx, recipeId);
      if (wasPending) {
        const key = _slotKey(week, day, meal);
        _pendingSlots[key] = Math.max(0, (_pendingSlots[key] || 0) - 1);
      }
    } else if (!wasPending) {
      Data.setMealSlot(week, day, meal, idx, '');
    }
    _renderMeals();
  }

  function addMealRecipe(week, day, meal) {
    const key = _slotKey(week, day, meal);
    _pendingSlots[key] = (_pendingSlots[key] || 0) + 1;
    _renderMeals();
  }

  function removeMealRecipe(week, day, meal, idx) {
    const plan = Data.getPlan();
    const filledIds = _normSlot(((plan['week' + week] || {})[day] || {})[meal]);
    if (idx < filledIds.length) {
      Data.removeMealSlot(week, day, meal, idx);
    } else {
      const key = _slotKey(week, day, meal);
      _pendingSlots[key] = Math.max(0, (_pendingSlots[key] || 0) - 1);
    }
    _renderMeals();
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
        _normSlot((wk[d] || {})[m]).forEach(id => {
          if (id) slotCounts[id] = (slotCounts[id] || 0) + 1;
        });
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

  return { render, showWeek, showTab, setSlot, addMealRecipe, removeMealRecipe,
           generateShoppingList, filterRecipes,
           openAddTreatModal, confirmAddTreat, removeTreat, updateTreatBatches, addTreatDirect };
})();
