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
    'cans','can','jars','jar','bottles','bottle','bags','bag','packets','packet',
  ];
  const UNIT_RE = UNITS.join('|');

  const ING_UNITS = ['g','100g','kg','ml','100ml','l','item','tsp','tbsp','clove','bunch','head','can','jar','bottle','bag','packet','loaf','dozen'];

  let _ingCount = 0;
  let _stepCount = 0;

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
      cans:'can', jars:'jar', bottles:'bottle', bags:'bag', packets:'packet',
    };
    return map[u.toLowerCase()] || u.toLowerCase();
  }

  function _stepRowHtml(n, text) {
    return `<div class="step-row" id="step-row-${n}">
      <div class="step-move-btns">
        <button type="button" class="step-move-btn" onclick="Recipes._moveStep(${n},-1)" title="Move up">▲</button>
        <button type="button" class="step-move-btn" onclick="Recipes._moveStep(${n},1)" title="Move down">▼</button>
      </div>
      <textarea id="step-text-${n}" class="step-text-input" rows="2"
        placeholder="Describe this step…">${_esc(text || '')}</textarea>
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

  function _moveStep(n, direction) {
    const row = document.getElementById('step-row-' + n);
    if (!row) return;
    if (direction === -1) {
      const prev = row.previousElementSibling;
      if (prev) row.parentNode.insertBefore(row, prev);
    } else {
      const next = row.nextElementSibling;
      if (next) row.parentNode.insertBefore(next, row);
    }
  }

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

  function _ingRowHtml(n, qty, unit, name) {
    const unitOpts = ING_UNITS.map(u =>
      `<option value="${u}"${u === (unit || 'item') ? ' selected' : ''}>${u}</option>`
    ).join('');
    return `<div class="ing-row" id="ing-row-${n}">
      <input type="number" id="ing-qty-${n}" class="ing-qty-input" min="0" step="0.01"
        value="${qty != null && qty !== '' ? qty : ''}" placeholder="qty" />
      <select id="ing-unit-${n}" class="ing-unit-select">${unitOpts}</select>
      <input type="text" id="ing-name-${n}" class="ing-name-input"
        list="ing-name-options" autocomplete="off"
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

  function _esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  let _cookExtraCount = 0;

  function _convertFromBase(qty, baseUnit, targetUnit) {
    const t = (targetUnit || '').toLowerCase();
    if (t === 'kg' && baseUnit === 'g')  return { qty: qty / 1000, unit: 'kg' };
    if (t === 'l'  && baseUnit === 'ml') return { qty: qty / 1000, unit: 'l'  };
    return { qty, unit: baseUnit };
  }

  function _buildIngRows(r, servings) {
    const ings = parseIngredients(r.ingredients);
    const base = r.servings || 1;
    const mult = (parseFloat(servings) || 1) / base;
    if (!ings.length) return '<p style="color:var(--text-muted);font-size:0.88rem;padding:8px 0">No ingredients listed.</p>';

    return ings.map((ing, i) => {
      if (!ing.qty && ing.qty !== 0) {
        return `<div class="cook-ing-row cook-ing-untracked">
        <span class="cook-ing-name">${_esc(ing.name)}</span>
        <span class="cook-ing-status">no qty — skip</span>
      </div>`;
      }
      const scaledQty = (parseFloat(ing.qty) || 0) * mult;
      const p = Data.getPantryItem(ing.name);

      if (!p || p.qty <= 0) {
        return `<div class="cook-ing-row cook-ing-untracked">
        <span class="cook-ing-name">${_esc(ing.name)}</span>
        <span class="cook-ing-qty">${fmtQty(scaledQty)} ${_esc(ing.unit || '')}</span>
        <span class="cook-ing-status">not tracked</span>
      </div>`;
      }

      const [pBase, pBaseUnit] = Data.normalizeToBase(p.qty, p.unit, p.gramEquiv);
      const [dBase, dBaseUnit] = Data.normalizeToBase(scaledQty, ing.unit || '');

      if (pBaseUnit !== dBaseUnit) {
        return `<div class="cook-ing-row cook-ing-untracked">
        <span class="cook-ing-name">${_esc(ing.name)}</span>
        <span class="cook-ing-qty">${fmtQty(scaledQty)} ${_esc(ing.unit || '')}</span>
        <span class="cook-ing-status">unit mismatch</span>
      </div>`;
      }

      if (pBase >= dBase) {
        const remain = _convertFromBase(pBase - dBase, pBaseUnit, p.unit);
        return `<div class="cook-ing-row cook-ing-normal">
        <span class="cook-ing-name">${_esc(ing.name)}</span>
        <span class="cook-ing-qty">${fmtQty(scaledQty)} ${_esc(ing.unit || '')}</span>
        <span class="cook-ing-status">→ ${fmtQty(remain.qty)} ${_esc(remain.unit)} left</span>
      </div>`;
      }

      // Shortfall
      return `<div class="cook-ing-row cook-ing-shortfall">
      <span class="cook-ing-name">${_esc(ing.name)}</span>
      <span class="cook-ing-qty">${fmtQty(scaledQty)} ${_esc(ing.unit || '')} needed</span>
      <div class="cook-shortfall-row">
        <span class="cook-shortfall-warn">⚠ only ${fmtQty(p.qty)} ${_esc(p.unit)} tracked</span>
        <label class="cook-shortfall-label">Actual used:
          <input type="number" id="cook-actual-${i}" class="cook-actual-input"
            min="0" step="0.01" max="${p.qty}"
            value="${p.qty}"
            data-ing-name="${_esc(ing.name.toLowerCase().trim())}"
            data-pantry-unit="${_esc(p.unit)}"
            data-pantry-qty="${p.qty}" />
          ${_esc(p.unit)}
        </label>
      </div>
    </div>`;
    }).join('');
  }

  function _deductIngredient(name, scaledQty, unit, ingIdx) {
    const p = Data.getPantryItem(name);
    if (!p || p.qty <= 0) return;

    const [pBase, pBaseUnit] = Data.normalizeToBase(p.qty, p.unit, p.gramEquiv);
    const [dBase, dBaseUnit] = Data.normalizeToBase(scaledQty, unit || '');
    if (pBaseUnit !== dBaseUnit) return;

    if (pBase < dBase && ingIdx !== null) {
      const actualInput = document.getElementById('cook-actual-' + ingIdx);
      const actualUsed = actualInput ? (parseFloat(actualInput.value) || 0) : p.qty;
      if (Data.getFIFO()) {
        Data.deductPantryFIFO(name, actualUsed, p.unit);
      } else {
        Data.setPantryItem(name, { qty: Math.max(0, p.qty - actualUsed), unit: p.unit, gramEquiv: p.gramEquiv });
      }
    } else {
      const remain = _convertFromBase(Math.max(0, pBase - dBase), pBaseUnit, p.unit);
      if (Data.getFIFO()) {
        Data.deductPantryFIFO(name, scaledQty, unit);
      } else {
        Data.setPantryItem(name, { qty: remain.qty, unit: remain.unit, gramEquiv: p.gramEquiv });
      }
    }
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

  // ── Recipe cost estimate ─────────────
  function _calcRecipeCost(r) {
    const ings = parseIngredients(r.ingredients);
    if (!ings.length) return null;
    let total = 0, hasCost = false, hasGap = false;
    for (const ing of ings) {
      if (!ing.qty && ing.qty !== 0) { hasGap = true; continue; }
      const cost = Data.lookupPrice(ing.name, ing.qty, ing.unit);
      if (cost === null) hasGap = true;
      else { total += cost; hasCost = true; }
    }
    if (!hasCost) return null;
    const servings = r.servings || 1;
    return {
      total: Math.round(total * 100) / 100,
      partial: hasGap,
      perServing: Math.round((total / servings) * 100) / 100,
    };
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
    const cost = _calcRecipeCost(r);
    const costHtml = cost
      ? `<div class="recipe-card-cost">${cost.partial ? '~' : ''}R ${cost.perServing.toFixed(2)}/serving${cost.partial ? '<span class="recipe-cost-gap"> · some prices missing</span>' : ''}</div>`
      : '';
    return `
      <div class="recipe-card" onclick="Recipes.openDetail('${r.id}')">
        <h3>${r.name}</h3>
        <div class="meta">${meta}</div>
        ${tags ? `<div class="tags">${tags}</div>` : ''}
        ${costHtml}
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

    const cost = _calcRecipeCost(r);
    const costMeta = cost
      ? `<span class="detail-cost">${cost.partial ? '~' : ''}R ${cost.total.toFixed(2)} total · R ${cost.perServing.toFixed(2)}/serving${cost.partial ? ' ⚠' : ''}</span>`
      : '';

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
        ${costMeta}
      </div>
      ${tags ? `<div class="detail-tags">${tags}</div>` : ''}
      <div class="detail-actions">
        <button class="btn-secondary" onclick="Timer.open()">⏱ Timer</button>
        <button class="btn-secondary" onclick="Recipes.openAddToPlanModal('${r.id}')">📅 Add to Plan</button>
        <button class="btn-secondary" onclick="Recipes.openEditModal('${r.id}')">✏️ Edit</button>
        <button class="btn-danger" onclick="Recipes.confirmDelete('${r.id}')">🗑 Delete</button>
        <button class="btn-secondary" onclick="Recipes.openCookConfirm('${r.id}')">✅ Just cooked this</button>
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

  function openCookConfirm(id) {
    const r = Data.getRecipeById(id);
    if (!r) return;
    _cookExtraCount = 0;
    const servings = _targetServings || r.servings || 1;
    const unitOpts = ['g','100g','kg','ml','100ml','l','item','tsp','tbsp','clove','bunch','head','can','packet','loaf','dozen']
      .map(u => `<option value="${u}"${u === 'item' ? ' selected' : ''}>${u}</option>`).join('');
    document.getElementById('modal-content').innerHTML = `
      <h3>Confirm Cook — ${_esc(r.name)}</h3>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;flex-wrap:wrap">
        <label style="margin:0;font-size:0.9rem;white-space:nowrap">Servings cooked</label>
        <input type="number" id="cook-servings-input" min="1" step="1" value="${servings}"
          style="width:60px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:1rem"
          onchange="Recipes._cookRefresh('${_esc(id)}', this.value)" />
        <span style="font-size:0.82rem;color:var(--text-muted)">(recipe base: ${r.servings || 1})</span>
      </div>
      <div id="cook-ing-rows">${_buildIngRows(r, servings)}</div>
      <div class="cook-extras-title">Extra ingredients used</div>
      <div id="cook-extras-list"></div>
      <button class="btn-small" style="margin-top:4px" onclick="Recipes._cookAddExtra()">＋ Add extra</button>
      <div class="modal-actions" style="margin-top:16px">
        <button class="btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn-primary" onclick="Recipes.confirmCook('${_esc(id)}')">Confirm &amp; save</button>
      </div>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
  }

  function _cookRefresh(id, servings) {
    const r = Data.getRecipeById(id);
    if (!r) return;
    const el = document.getElementById('cook-ing-rows');
    if (el) el.innerHTML = _buildIngRows(r, parseFloat(servings) || 1);
  }

  function _cookAddExtra() {
    const list = document.getElementById('cook-extras-list');
    if (!list) return;
    const n = _cookExtraCount++;
    const unitOpts = ['g','100g','kg','ml','100ml','l','item','tsp','tbsp','clove','bunch','head','can','packet','loaf','dozen']
      .map(u => `<option value="${u}"${u === 'item' ? ' selected' : ''}>${u}</option>`).join('');
    const row = document.createElement('div');
    row.className = 'cook-extra-row';
    row.id = 'cook-extra-row-' + n;
    row.innerHTML = `
      <input type="text" id="cook-extra-name-${n}" placeholder="Ingredient name"
        style="flex:1;min-width:0;padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:0.85rem" />
      <input type="number" id="cook-extra-qty-${n}" placeholder="qty" min="0" step="0.01"
        style="width:60px;padding:4px 6px;border:1px solid var(--border);border-radius:6px;font-size:0.85rem" />
      <select id="cook-extra-unit-${n}"
        style="padding:4px 6px;border:1px solid var(--border);border-radius:6px;font-size:0.85rem">${unitOpts}</select>
      <button onclick="document.getElementById('cook-extra-row-${n}').remove()"
        style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:1.1rem;padding:2px 6px;line-height:1">✕</button>`;
    list.appendChild(row);
  }

  function confirmCook(id) {
    const r = Data.getRecipeById(id);
    if (!r) return;
    const servings = parseFloat(document.getElementById('cook-servings-input')?.value) || r.servings || 1;
    const base = r.servings || 1;
    const mult = servings / base;

    parseIngredients(r.ingredients).forEach((ing, i) => {
      if (!ing.qty && ing.qty !== 0) return;
      _deductIngredient(ing.name, (parseFloat(ing.qty) || 0) * mult, ing.unit || '', i);
    });

    const extrasList = document.getElementById('cook-extras-list');
    if (extrasList) {
      extrasList.querySelectorAll('.cook-extra-row').forEach(row => {
        const n = row.id.replace('cook-extra-row-', '');
        const name = (document.getElementById('cook-extra-name-' + n)?.value || '').trim().toLowerCase();
        const qty  = parseFloat(document.getElementById('cook-extra-qty-' + n)?.value) || 0;
        const unit = document.getElementById('cook-extra-unit-' + n)?.value || 'item';
        if (name && qty > 0) _deductIngredient(name, qty, unit, null);
      });
    }

    Data.logCook({
      date: new Date().toISOString().slice(0, 10),
      recipeId: id,
      recipeName: r.name,
      servings,
      baseServings: base,
    });

    App.closeModal();
    App.toast('Cooked ✓');
    App.refresh();
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
        <label>Ingredients</label>
        <div id="rf-ing-list"></div>
        ${_ingDatalistHtml()}
        <button type="button" class="btn-small" style="margin-top:4px" onclick="Recipes._addIngRow()">＋ Add ingredient</button>
      </div>
      <div class="form-group">
        <label>Method</label>
        <div id="rf-step-list"></div>
        <button type="button" class="btn-small" style="margin-top:4px" onclick="Recipes._addStepRow()">＋ Add step</button>
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
    _renderIngRows(r.ingredients);
    _renderStepRows(r.method);
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
      method: (() => {
        const parts = [];
        document.querySelectorAll('#rf-step-list .step-row').forEach(row => {
          const n = row.id.replace('step-row-', '');
          const text = (document.getElementById('step-text-' + n)?.value || '').trim();
          if (text) parts.push(text);
        });
        return parts.join('\n');
      })(),
      tags: document.getElementById('rf-tags').value.trim(),
      source: document.getElementById('rf-src').value.trim(),
      kcalTotal: isNaN(kcalRaw) ? null : kcalRaw,
    };
    if (existingId) {
      Data.updateRecipe(recipe);
      Data.ensurePriceBookEntries(parseIngredients(recipe.ingredients));
      App.toast('Recipe updated ✓');
      openDetail(existingId);
    } else {
      const saved = Data.addRecipe(recipe);
      Data.ensurePriceBookEntries(parseIngredients(recipe.ingredients));
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
    const apiKey = localStorage.getItem('rb_spoon_key');
    if (!apiKey) { App.toast('No Spoonacular key — go to Settings to add one.', 'warn'); return; }

    const btn = document.getElementById('btn-calc-kcal');
    const origLabel = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Calculating…'; }

    let result = null;
    try {
      const ingredientList = ingredientsText.split(';').map(s => s.trim()).filter(Boolean).join('\n');
      const params = new URLSearchParams();
      params.append('ingredientList', ingredientList);
      params.append('servings', '1');
      params.append('includeNutrition', 'true');

      const res = await fetch(
        `https://api.spoonacular.com/recipes/parseIngredients?apiKey=${encodeURIComponent(apiKey)}`,
        { method: 'POST', body: params }
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
           editCalories, cancelEditCalories, saveCalories, calculateCalories,
           openCookConfirm, _cookRefresh, _cookAddExtra, confirmCook,
           _addIngRow, _removeIngRow,
           _addStepRow, _removeStepRow, _moveStep };
})();
