/* ══════════════════════════════════════
   prices.js — Ingredient Book view
   ══════════════════════════════════════ */

const PriceBook = (() => {
  let _filter = '';
  let _showOrphansOnly = false;
  let _modalIngredientName = '';
  let _modalPriceIdx = null;

  const UNITS = ['g','100g','kg','ml','100ml','l','item','tsp','tbsp','clove','bunch','head','can','packet','loaf','dozen'];
  const GRAM_EQUIV_UNITS = ['can','packet','loaf','bunch','head'];

  function onUnitChange(selectEl) {
    const val = typeof selectEl === 'string' ? selectEl : selectEl.value;
    const show = GRAM_EQUIV_UNITS.includes(val);
    const group = document.getElementById('pb-gram-equiv-group');
    const unitLabel = document.getElementById('pb-gram-equiv-unit');
    if (group) group.style.display = show ? '' : 'none';
    if (unitLabel) unitLabel.textContent = val;
    if (!show) {
      const geInput = document.getElementById('pb-form-gramequiv');
      if (geInput) geInput.value = '';
    }
  }

  function render() {
    const entries = Data.getPriceBook();
    const el = document.getElementById('pricebook-list');
    if (!el) return;

    const _recipeIngredientNames = new Set();
    Data.getRecipes().forEach(r => {
      Recipes.parseIngredients(r.ingredients).forEach(i => {
        if (i.name) _recipeIngredientNames.add(i.name.toLowerCase());
      });
    });
    const isOrphaned = ingredientName => {
      const lower = ingredientName.toLowerCase();
      for (const ri of _recipeIngredientNames) {
        if (ri.includes(lower) || lower.includes(ri)) return false;
      }
      return true;
    };

    const filterLower = _filter.toLowerCase();
    let filtered = filterLower
      ? entries.filter(e => e.ingredient.toLowerCase().includes(filterLower))
      : entries.slice();
    if (_showOrphansOnly) filtered = filtered.filter(e => isOrphaned(e.ingredient));

    if (filtered.length === 0) {
      el.innerHTML = `<div class="empty-state"><span class="emoji">📋</span>${
        filterLower || _showOrphansOnly ? 'No matches.' : 'No ingredients yet. Tap ＋ Add to get started.'
      }</div>
      <button class="pb-add-ingredient-btn" onclick="PriceBook.openAddIngredientForm()">＋ Add ingredient</button>`;
      return;
    }

    el.innerHTML = filtered.map(card => {
      const realIdx = entries.indexOf(card);
      const orphanBadge = isOrphaned(card.ingredient)
        ? `<span class="pb-orphan-badge">no recipes</span>` : '';
      const priceRows = card.prices.map((p, pIdx) => {
        const retailerHtml = p.retailer
          ? `<span class="pb-retailer-tag">${_esc(p.retailer)}</span>` : '';
        return `
          <div class="pb-price-row">
            <div class="pb-price-row-info">
              <span class="pb-price-val">R ${p.pricePerUnit.toFixed(2)}/${p.unit}</span>
              ${retailerHtml}
              <span class="pb-price-date">${_fmtDate(p.updatedDate)}</span>
            </div>
            <div class="pb-price-row-actions">
              <button class="btn-mini" onclick="PriceBook.openEditPriceForm(${realIdx}, ${pIdx})">Edit</button>
              <button class="btn-mini btn-danger-mini" onclick="PriceBook.removePrice(${realIdx}, ${pIdx})">✕</button>
            </div>
          </div>`;
      }).join('');
      return `
        <div class="pb-card">
          <div class="pb-card-header">
            <span class="pb-card-name">${_esc(card.ingredient)}${orphanBadge}</span>
            <div class="pb-card-actions">
              <button class="btn-mini" onclick="PriceBook.openAddPriceForm(${realIdx})">＋ Add price</button>
              <button class="btn-mini btn-danger-mini" onclick="PriceBook.removeIngredient(${realIdx})">✕ Remove</button>
            </div>
          </div>
          <div class="pb-price-rows">${priceRows}</div>
        </div>`;
    }).join('') + `<button class="pb-add-ingredient-btn" onclick="PriceBook.openAddIngredientForm()">＋ Add ingredient</button>`;
  }

  function filter() {
    _filter = (document.getElementById('pb-search')?.value || '').trim();
    render();
  }

  function toggleOrphans() {
    _showOrphansOnly = !_showOrphansOnly;
    const btn = document.getElementById('pb-orphan-toggle');
    if (btn) btn.classList.toggle('active', _showOrphansOnly);
    render();
  }

  function openAddIngredientForm() {
    _modalIngredientName = '';
    _modalPriceIdx = null;
    const unitOpts = UNITS.map(u =>
      `<option value="${u}" ${u === 'item' ? 'selected' : ''}>${u}</option>`
    ).join('');
    document.getElementById('modal-content').innerHTML = `
      <h3>Add Ingredient</h3>
      <div class="form-group">
        <label>Ingredient</label>
        <input id="pb-form-ing" type="text" placeholder="e.g. beef mince" autofocus />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Price R (optional)</label>
          <input id="pb-form-price" type="number" step="0.01" min="0" placeholder="leave blank" />
        </div>
        <div class="form-group">
          <label>Per</label>
          <select id="pb-form-unit">${unitOpts}</select>
        </div>
      </div>
      <div class="form-group">
        <label>Retailer (optional)</label>
        <input id="pb-form-retailer" type="text" placeholder="e.g. Checkers" maxlength="30" />
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn-primary" onclick="PriceBook.saveNewIngredient()">Save</button>
      </div>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
  }

  function saveNewIngredient() {
    const ingredient = (document.getElementById('pb-form-ing')?.value || '').trim().toLowerCase();
    const priceRaw = document.getElementById('pb-form-price')?.value;
    const price = priceRaw !== '' ? parseFloat(priceRaw) : null;
    const unit = document.getElementById('pb-form-unit')?.value || 'item';
    const retailer = (document.getElementById('pb-form-retailer')?.value || '').trim();
    if (!ingredient) { App.toast('Enter an ingredient name', 'warn'); return; }
    if (price !== null && (isNaN(price) || price < 0)) { App.toast('Enter a valid price', 'warn'); return; }
    if (price !== null) {
      Data.setPriceEntry(ingredient, { unit, pricePerUnit: price, retailer });
    } else {
      Data.addIngredientEntry(ingredient);
    }
    App.closeModal();
    render();
    App.toast('Ingredient added ✓');
  }

  function openAddPriceForm(ingredientIdx) {
    const entries = Data.getPriceBook();
    const card = entries[ingredientIdx];
    if (!card) return;
    _modalIngredientName = card.ingredient;
    _modalPriceIdx = null;
    const unitOpts = UNITS.map(u =>
      `<option value="${u}" ${u === 'item' ? 'selected' : ''}>${u}</option>`
    ).join('');
    document.getElementById('modal-content').innerHTML = `
      <h3>Add Price — <span style="text-transform:capitalize">${_esc(card.ingredient)}</span></h3>
      <div class="form-row">
        <div class="form-group">
          <label>Price (R)</label>
          <input id="pb-form-price" type="number" step="0.01" min="0" placeholder="0.00" autofocus />
        </div>
        <div class="form-group">
          <label>Per</label>
          <select id="pb-form-unit" onchange="PriceBook.onUnitChange(this)">${unitOpts}</select>
        </div>
      </div>
      <div class="form-group" id="pb-gram-equiv-group" style="display:none">
        <label>1 <span id="pb-gram-equiv-unit">unit</span> ≈ <input id="pb-form-gramequiv" type="number" step="1" min="0" placeholder="e.g. 400" style="width:70px" /> g (optional)</label>
      </div>
      <div class="form-group">
        <label>Retailer (optional)</label>
        <input id="pb-form-retailer" type="text" placeholder="e.g. Checkers" maxlength="30" />
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn-primary" onclick="PriceBook.savePrice()">Save</button>
      </div>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
  }

  function openEditPriceForm(ingredientIdx, priceIdx) {
    const entries = Data.getPriceBook();
    const card = entries[ingredientIdx];
    if (!card) return;
    const p = card.prices[priceIdx];
    if (!p) return;
    _modalIngredientName = card.ingredient;
    _modalPriceIdx = priceIdx;
    const showGramEquiv = GRAM_EQUIV_UNITS.includes(p.unit);
    const unitOpts = UNITS.map(u =>
      `<option value="${u}" ${p.unit === u ? 'selected' : ''}>${u}</option>`
    ).join('');
    document.getElementById('modal-content').innerHTML = `
      <h3>Edit Price — <span style="text-transform:capitalize">${_esc(card.ingredient)}</span></h3>
      <div class="form-row">
        <div class="form-group">
          <label>Price (R)</label>
          <input id="pb-form-price" type="number" step="0.01" min="0"
            value="${p.pricePerUnit}" autofocus />
        </div>
        <div class="form-group">
          <label>Per</label>
          <select id="pb-form-unit" onchange="PriceBook.onUnitChange(this)">${unitOpts}</select>
        </div>
      </div>
      <div class="form-group" id="pb-gram-equiv-group" style="display:${showGramEquiv ? '' : 'none'}">
        <label>1 <span id="pb-gram-equiv-unit">${_esc(p.unit)}</span> ≈ <input id="pb-form-gramequiv" type="number" step="1" min="0" value="${p.gramEquiv || ''}" placeholder="e.g. 400" style="width:70px" /> g (optional)</label>
      </div>
      <div class="form-group">
        <label>Retailer (optional)</label>
        <input id="pb-form-retailer" type="text" value="${_esc(p.retailer || '')}" maxlength="30" />
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn-primary" onclick="PriceBook.savePrice()">Save</button>
      </div>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
  }

  function savePrice() {
    if (!_modalIngredientName) { App.toast('No ingredient selected', 'warn'); return; }
    const price = parseFloat(document.getElementById('pb-form-price')?.value);
    const unit = document.getElementById('pb-form-unit')?.value || 'item';
    const retailer = (document.getElementById('pb-form-retailer')?.value || '').trim();
    const gramEquiv = document.getElementById('pb-form-gramequiv')?.value || '';
    if (isNaN(price) || price < 0) { App.toast('Enter a valid price', 'warn'); return; }
    if (_modalPriceIdx !== null) {
      Data.removePriceEntry(_modalIngredientName, _modalPriceIdx);
    }
    Data.setPriceEntry(_modalIngredientName, { unit, pricePerUnit: price, retailer, gramEquiv });
    App.closeModal();
    render();
    App.toast('Price saved ✓');
  }

  function removePrice(ingredientIdx, priceIdx) {
    if (!confirm('Remove this price row?')) return;
    const entries = Data.getPriceBook();
    const card = entries[ingredientIdx];
    if (!card) return;
    Data.removePriceEntry(card.ingredient, priceIdx);
    render();
    App.toast('Removed');
  }

  function removeIngredient(ingredientIdx) {
    if (!confirm('Remove this ingredient and all its prices?')) return;
    Data.removeIngredient(ingredientIdx);
    render();
    App.toast('Removed');
  }

  function _fmtDate(dateStr) {
    if (!dateStr) return '';
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    return months[parseInt(parts[1], 10) - 1] + ' ' + parseInt(parts[2], 10);
  }

  function _esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { render, filter, toggleOrphans, openAddIngredientForm, saveNewIngredient, openAddPriceForm, openEditPriceForm, savePrice, removePrice, removeIngredient, onUnitChange };
})();
