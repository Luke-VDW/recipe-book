/* ══════════════════════════════════════
   recipes.js — Recipe list, viewer, CRUD
   ══════════════════════════════════════ */

const Recipes = (() => {

  let _activeId    = null;
  let _baseServings = 1;
  let _targetServings = 1;

  // ── Ingredient parser ────────────────
  const UNITS = [
    'tablespoons','tablespoon','teaspoons','teaspoon',
    'tsps','tbsps','tsp','tbsp',
    'cups','cup','kg','g','ml','l',
    'lbs','lb','oz',
    'cloves','clove','pinch','pinches',
    'pieces','piece','slices','slice',
  ];
  const UNIT_RE = UNITS.join('|');

  function parseIngredients(text) {
    if (!text) return [];
    return text.split(';').map(raw => {
      const s = raw.trim();
      if (!s) return null;

      // "500g beef mince" — qty glued to unit
      let m = s.match(new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_RE})\\.?\\s+(.+)$`, 'i'));
      if (m) return { qty: parseFloat(m[1].replace(',','.')), unit: normaliseUnit(m[2]), name: m[3].trim() };

      // "0.25tsp nutmeg" — no space
      m = s.match(new RegExp(`^(\\d+(?:[.,]\\d+)?)(${UNIT_RE})\\.?(.+)$`, 'i'));
      if (m) return { qty: parseFloat(m[1].replace(',','.')), unit: normaliseUnit(m[2]), name: m[3].trim() };

      // "2 cloves garlic" — qty space unit space name
      m = s.match(new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s+(${UNIT_RE})\\.?\\s+(.+)$`, 'i'));
      if (m) return { qty: parseFloat(m[1].replace(',','.')), unit: normaliseUnit(m[2]), name: m[3].trim() };

      // "3 eggs" — qty + name only
      m = s.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/);
      if (m) return { qty: parseFloat(m[1].replace(',','.')), unit: '', name: m[2].trim() };

      return { qty: '', unit: '', name: s };
    }).filter(Boolean);
  }

  function normaliseUnit(u) {
    const map = {
      tablespoons:'tbsp', tablespoon:'tbsp', tbsps:'tbsp',
      teaspoons:'tsp', teaspoon:'tsp', tsps:'tsp',
      cups:'cup', cloves:'clove', pieces:'piece',
      slices:'slice', pinches:'pinch', lbs:'lb',
    };
    return map[u.toLowerCase()] || u.toLowerCase();
  }

  function fmtQty(q) {
    if (!q && q !== 0) return '';
    const n = parseFloat(q);
    if (isNaN(n)) return String(q);
    // Nice fractions for common values
    const fracs = { 0.25:'¼', 0.5:'½', 0.75:'¾', 0.125:'⅛', 0.333:'⅓', 0.667:'⅔' };
    if (fracs[Math.round(n*1000)/1000]) return fracs[Math.round(n*1000)/1000];
    return n % 1 === 0 ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
  }

  // ── Render recipe list ───────────────
  function render() {
    filter();
  }

  function filter() {
    const q    = (document.getElementById('recipe-search')?.value || '').toLowerCase();
    const cat  = document.getElementById('recipe-cat-filter')?.value || '';
    const sort = document.getElementById('recipe-sort')?.value || 'default';
    const all  = Data.getRecipes();
    let filtered = all.filter(r => {
      const matchQ = !q || r.name.toLowerCase().includes(q)
        || (r.tags || '').toLowerCase().includes(q)
        || (r.ingredients || '').toLowerCase().includes(q);
      const matchC = !cat || r.category === cat;
      return matchQ && matchC;
    });

    if (sort === 'az') filtered = filtered.slice().sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'za') filtered = filtered.slice().sort((a, b) => b.name.localeCompare(a.name));

    const el = document.getElementById('recipe-list');
    if (!el) return;
    if (filtered.length === 0) {
      el.innerHTML = `<div class="empty-state"><span class="emoji">🍽️</span>${all.length === 0 ? 'No recipes yet. Tap + to add one or use Import.' : 'No recipes match your search.'}</div>`;
      return;
    }
    el.innerHTML = filtered.map(r => recipeCard(r)).join('');
  }

  function recipeCard(r) {
    const tags = (r.tags || '').split(',').map(t=>t.trim()).filter(Boolean)
      .map(t => `<span class="tag">${t}</span>`).join('');
    const prep = r.prepMins ? `${r.prepMins}m prep` : '';
    const cook = r.cookMins ? `${r.cookMins}m cook` : '';
    const srv  = r.servings ? `${r.servings} servings` : '';
    const meta = [r.category, prep, cook, srv].filter(Boolean).join(' · ');
    return `
      <div class="recipe-card" onclick="Recipes.openDetail('${r.id}')">
        <h3>${r.name}</h3>
        <div class="meta">${meta}</div>
        ${tags ? `<div class="tags">${tags}</div>` : ''}
      </div>`;
  }

  // ── Recipe detail view ───────────────
  function _renderIngredients(ings, multiplier) {
    if (!ings.length) return '<p class="hint" style="padding:10px">No ingredients listed.</p>';
    return `<ul class="ingredient-list">${ings.map(i => {
      const scaledQty = (parseFloat(i.qty) || 0) * (multiplier || 1);
      return `<li>
        <span class="ing-qty">${i.qty ? fmtQty(scaledQty) : ''}</span>
        <span class="ing-unit">${i.unit}</span>
        <span>${i.name}</span>
      </li>`;
    }).join('')}</ul>`;
  }

  function openDetail(id) {
    const r = Data.getRecipeById(id);
    if (!r) return;
    _activeId = id;
    _baseServings   = r.servings || 1;
    _targetServings = r.servings || 1;

    const ings  = parseIngredients(r.ingredients);
    const steps = (r.method || '').split('\n').filter(s => s.trim());

    const stepsHtml = steps.length
      ? `<ol class="step-list">${steps.map((s, i) => {
          const text = s.replace(/^\d+\.\s*/, '');
          return `<li><span class="step-num">${i+1}.</span><span>${text}</span></li>`;
        }).join('')}</ol>`
      : '<p class="hint" style="padding:10px">No directions listed.</p>';

    const tags = (r.tags || '').split(',').map(t=>t.trim()).filter(Boolean)
      .map(t => `<span class="tag">${t}</span>`).join('');

    document.getElementById('detail-content').innerHTML = `
      <h2 class="detail-name">${r.name}</h2>
      <div class="detail-meta">
        ${r.category ? `<span>📂 ${r.category}</span>` : ''}
        ${r.servings ? `<span class="servings-stepper">👥
          <button class="stepper-btn" onclick="Recipes.setServings(-1)">−</button>
          <span id="detail-servings-label">${r.servings} servings</span>
          <button class="stepper-btn" onclick="Recipes.setServings(1)">+</button>
        </span>` : ''}
        ${r.prepMins ? `<span>⏱ ${r.prepMins}m prep</span>` : ''}
        ${r.cookMins ? `<span>🔥 ${r.cookMins}m cook</span>` : ''}
        <span class="detail-kcal">${r.kcalTotal != null
          ? `${r.kcalTotal} kcal · ${Math.round(r.kcalTotal / (r.servings || 1))} kcal/serving`
          : '— kcal'}</span>
      </div>
      ${tags ? `<div class="detail-tags">${tags}</div>` : ''}
      <div class="detail-actions">
        <button class="btn-secondary" onclick="Timer.open()">⏱ Timer</button>
        <button class="btn-secondary" onclick="Recipes.openAddToPlanModal('${r.id}')">📅 Add to Plan</button>
        <button class="btn-secondary" onclick="Recipes.openEditModal('${r.id}')">✏️ Edit</button>
        <button class="btn-danger" onclick="Recipes.confirmDelete('${r.id}')">🗑 Delete</button>
      </div>
      <div class="section-label">🥕 INGREDIENTS</div>
      <div id="detail-ingredients">${_renderIngredients(ings, 1)}</div>
      <div class="section-label">👨‍🍳 DIRECTIONS</div>
      ${stepsHtml}
      ${r.source ? `<p class="detail-source">Source: <a href="${r.source}" target="_blank">${r.source}</a></p>` : ''}
    `;

    App.pushView('detail', r.name);
  }

  function setServings(delta) {
    if (!_activeId) return;
    _targetServings = Math.max(1, _targetServings + delta);
    const r = Data.getRecipeById(_activeId);
    if (!r) return;
    const multiplier = _targetServings / _baseServings;
    const label = document.getElementById('detail-servings-label');
    if (label) label.textContent = _targetServings + ' servings';
    const ingEl = document.getElementById('detail-ingredients');
    if (ingEl) ingEl.innerHTML = _renderIngredients(parseIngredients(r.ingredients), multiplier);
  }

  function openAddToPlanModal(id) {
    const r = Data.getRecipeById(id);
    if (!r) return;
    document.getElementById('modal-content').innerHTML = `
      <div class="modal-title">📅 Add to Plan</div>
      <p style="margin:0 0 12px;color:var(--text-muted);font-size:.9rem">"${r.name}"</p>
      <div class="form-group">
        <label>Week</label>
        <select id="atp-week">
          <option value="1">Week 1</option>
          <option value="2">Week 2</option>
          <option value="3">Week 3</option>
          <option value="4">Week 4</option>
        </select>
      </div>
      <div class="form-group">
        <label>Day</label>
        <select id="atp-day">
          ${Data.DAYS.map(d => `<option value="${d}">${d.charAt(0).toUpperCase() + d.slice(1)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Meal</label>
        <select id="atp-meal">
          <option value="breakfast">Breakfast</option>
          <option value="lunch">Lunch</option>
          <option value="dinner" selected>Dinner</option>
        </select>
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn-primary" onclick="Recipes.confirmAddToPlan()">Add to Plan</button>
      </div>
    `;
    document.getElementById('modal-overlay').classList.remove('hidden');
  }

  function confirmAddToPlan() {
    const week = parseInt(document.getElementById('atp-week').value);
    const day  = document.getElementById('atp-day').value;
    const meal = document.getElementById('atp-meal').value;
    Planner.setSlot(week, day, meal, _activeId);
    Planner.render();
    const dayLabel  = day.charAt(0).toUpperCase() + day.slice(1);
    const mealLabel = meal.charAt(0).toUpperCase() + meal.slice(1);
    App.closeModal();
    App.toast(`Added to Week ${week}, ${dayLabel} ${mealLabel} ✓`);
  }

  function confirmDelete(id) {
    const r = Data.getRecipeById(id);
    if (!r) return;
    if (!confirm(`Delete "${r.name}"? This cannot be undone.`)) return;
    Data.deleteRecipe(id);
    App.toast(`"${r.name}" deleted`);
    App.goBack();
    render();
  }

  // ── Add / Edit modal ─────────────────
  function openAddModal() {
    _showModal();
  }

  function openEditModal(id) {
    const r = Data.getRecipeById(id);
    _showModal(r);
  }

  function _showModal(r) {
    const isEdit = !!r;
    r = r || {};
    document.getElementById('modal-content').innerHTML = `
      <div class="modal-title">${isEdit ? '✏️ Edit Recipe' : '➕ Add Recipe'}</div>
      <div class="form-group">
        <label>Recipe Name *</label>
        <input id="rf-name" type="text" value="${r.name || ''}" placeholder="e.g. Chicken Stir Fry" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Category</label>
          <select id="rf-cat">
            ${['Breakfast','Lunch','Dinner','Snack','Dessert','Salad','Soup','Side'].map(c =>
              `<option ${r.category===c?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Servings</label>
          <input id="rf-srv" type="number" min="1" value="${r.servings || 2}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Prep (min)</label>
          <input id="rf-prep" type="number" min="0" value="${r.prepMins || ''}" />
        </div>
        <div class="form-group">
          <label>Cook (min)</label>
          <input id="rf-cook" type="number" min="0" value="${r.cookMins || ''}" />
        </div>
      </div>
      <div class="form-group">
        <label>Ingredients (semicolon-separated)</label>
        <textarea id="rf-ing" rows="4" placeholder="500g beef mince; 1 onion; 2 cloves garlic">${r.ingredients || ''}</textarea>
      </div>
      <div class="form-group">
        <label>Method (one step per line)</label>
        <textarea id="rf-method" rows="5" placeholder="1. Heat pan…&#10;2. Add onion…">${r.method || ''}</textarea>
      </div>
      <div class="form-group">
        <label>Tags (comma-separated)</label>
        <input id="rf-tags" type="text" value="${r.tags || ''}" placeholder="Quick, Italian, Vegetarian" />
      </div>
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
        <button class="btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn-primary" onclick="Recipes.saveModal('${r.id || ''}')">
          ${isEdit ? 'Save Changes' : 'Add Recipe'}
        </button>
      </div>
    `;
    document.getElementById('modal-overlay').classList.remove('hidden');
  }

  function saveModal(existingId) {
    const name = document.getElementById('rf-name').value.trim();
    if (!name) { alert('Please enter a recipe name.'); return; }
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
    if (existingId) {
      Data.updateRecipe(recipe);
      App.toast('Recipe updated ✓');
      openDetail(existingId);
    } else {
      const saved = Data.addRecipe(recipe);
      App.toast('Recipe added ✓');
      openDetail(saved.id);
    }
    App.closeModal();
    render();
  }

  function _updateKcalDisplay(kcal, servings) {
    const el = document.getElementById('kcal-display');
    if (!el) return;
    if (kcal != null) {
      const perServing = Math.round(kcal / (servings || 1));
      el.innerHTML = `
        <span class="kcal-value">${kcal} kcal · ${perServing} kcal/serving</span>
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
    if (editInput) editInput.value = currentVal || '';
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

    let result = null;
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
      result = Math.round(totalKcal);
      App.toast(`Calories calculated: ${result} kcal ✓`);
    } catch (err) {
      console.error('Calorie calculation error:', err);
      App.toast('Calorie calculation failed — check your Spoonacular key.', 'warn');
    } finally {
      if (btn) { btn.disabled = false; if (origLabel) btn.textContent = origLabel; }
    }

    if (result !== null) {
      const hiddenInput = document.getElementById('rf-kcal');
      if (hiddenInput) hiddenInput.value = result;
      const servings = parseInt(document.getElementById('rf-srv')?.value) || 1;
      _updateKcalDisplay(result, servings);
    }
  }

  return { render, filter, openDetail, openAddModal, openEditModal, saveModal, confirmDelete,
           parseIngredients, setServings, openAddToPlanModal, confirmAddToPlan,
           editCalories, cancelEditCalories, saveCalories, calculateCalories };
})();
