/* ══════════════════════════════════════
   pantry.js — Pantry inventory view
   ══════════════════════════════════════ */

const Pantry = (() => {
  let _filter = '';
  let _editingName = null;

  const UNITS = ['g','100g','kg','ml','100ml','l','item','tsp','tbsp','clove','bunch','head','can','packet','loaf','dozen'];
  const GRAM_EQUIV_UNITS = ['can','packet','loaf','bunch','head'];

  function onUnitChange(selectEl) {
    const val = typeof selectEl === 'string' ? selectEl : selectEl.value;
    const show = GRAM_EQUIV_UNITS.includes(val);
    const group = document.getElementById('pantry-gram-equiv-group');
    const unitLabel = document.getElementById('pantry-gram-equiv-unit');
    if (group) group.style.display = show ? '' : 'none';
    if (unitLabel) unitLabel.textContent = val;
    if (!show) {
      const geInput = document.getElementById('pantry-form-gramequiv');
      if (geInput) geInput.value = '';
    }
  }

  function render() {
    const allItems = Data.getPantry();
    const el = document.getElementById('pantry-list');
    if (!el) return;
    const filterLower = _filter.toLowerCase();
    const filtered = filterLower
      ? allItems.filter(p => p.ingredient.toLowerCase().includes(filterLower))
      : allItems;

    if (filtered.length === 0) {
      el.innerHTML = `<div class="empty-state"><span class="emoji">🥫</span>${
        filterLower ? 'No matches.' : 'Pantry is empty. Add items or log a purchase.'
      }</div>`;
      return;
    }

    el.innerHTML = filtered.map(item => {
      const realIdx = allItems.indexOf(item);
      const perishableHtml = item.perishable
        ? `<span class="pantry-perishable-badge">perishable</span>` : '';
      return `
        <div class="pantry-card">
          <div class="pantry-card-header">
            <div class="pantry-card-left">
              <span class="pantry-card-name">${_esc(item.ingredient)}</span>
              <span class="pantry-card-qty">${_fmtQty(item.qty)} ${_esc(item.unit)}</span>
              ${perishableHtml}
              ${_fmtBatches(item)}
            </div>
            <div class="pantry-card-actions">
              <button class="btn-mini" onclick="Pantry.openEditForm(${realIdx})">Edit</button>
              <button class="btn-mini btn-danger-mini" onclick="Pantry.remove(${realIdx})">✕</button>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  function filter() {
    _filter = (document.getElementById('pantry-search')?.value || '').trim();
    render();
  }

  function openAddForm() {
    _editingName = null;
    const unitOpts = UNITS.map(u =>
      `<option value="${u}" ${u === 'item' ? 'selected' : ''}>${u}</option>`
    ).join('');
    document.getElementById('modal-content').innerHTML = `
      <h3>Add to Pantry</h3>
      <div class="form-group">
        <label>Ingredient</label>
        <input id="pantry-form-ing" type="text" placeholder="e.g. onion" autofocus />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Qty</label>
          <input id="pantry-form-qty" type="number" step="0.1" min="0" placeholder="0" />
        </div>
        <div class="form-group">
          <label>Unit</label>
          <select id="pantry-form-unit" onchange="Pantry.onUnitChange(this)">${unitOpts}</select>
        </div>
      </div>
      <div class="form-group" id="pantry-gram-equiv-group" style="display:none">
        <label>1 <span id="pantry-gram-equiv-unit">unit</span> ≈ <input id="pantry-form-gramequiv" type="number" step="1" min="0" placeholder="e.g. 400" style="width:70px" /> g (optional)</label>
      </div>
      <div class="form-group">
        <label><input type="checkbox" id="pantry-form-perishable" /> Perishable (auto-reset weekly)</label>
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn-primary" onclick="Pantry.saveNew()">Add to Pantry</button>
      </div>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
  }

  function saveNew() {
    const ingredient = (document.getElementById('pantry-form-ing')?.value || '').trim().toLowerCase();
    const qty = parseFloat(document.getElementById('pantry-form-qty')?.value) || 0;
    const unit = document.getElementById('pantry-form-unit')?.value || 'item';
    const perishable = document.getElementById('pantry-form-perishable')?.checked || false;
    const gramEquiv = document.getElementById('pantry-form-gramequiv')?.value || '';
    if (!ingredient) { App.toast('Enter an ingredient name', 'warn'); return; }
    if (qty < 0) { App.toast('Qty cannot be negative', 'warn'); return; }
    Data.setPantryItem(ingredient, { qty, unit, perishable, gramEquiv });
    App.closeModal();
    render();
    App.toast('Added to pantry ✓');
  }

  function openEditForm(idx) {
    const allItems = Data.getPantry();
    const item = allItems[idx];
    if (!item) return;
    _editingName = item.ingredient;
    const showGramEquiv = GRAM_EQUIV_UNITS.includes(item.unit);
    const unitOpts = UNITS.map(u =>
      `<option value="${u}" ${item.unit === u ? 'selected' : ''}>${u}</option>`
    ).join('');
    document.getElementById('modal-content').innerHTML = `
      <h3>Edit — <span style="text-transform:capitalize">${_esc(item.ingredient)}</span></h3>
      <div class="form-row">
        <div class="form-group">
          <label>Qty</label>
          <input id="pantry-form-qty" type="number" step="0.1" min="0" value="${item.qty}" autofocus />
        </div>
        <div class="form-group">
          <label>Unit</label>
          <select id="pantry-form-unit" onchange="Pantry.onUnitChange(this)">${unitOpts}</select>
        </div>
      </div>
      <div class="form-group" id="pantry-gram-equiv-group" style="display:${showGramEquiv ? '' : 'none'}">
        <label>1 <span id="pantry-gram-equiv-unit">${_esc(item.unit)}</span> ≈ <input id="pantry-form-gramequiv" type="number" step="1" min="0" value="${item.gramEquiv || ''}" placeholder="e.g. 400" style="width:70px" /> g (optional)</label>
      </div>
      <div class="form-group">
        <label><input type="checkbox" id="pantry-form-perishable" ${item.perishable ? 'checked' : ''} /> Perishable</label>
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn-primary" onclick="Pantry.save()">Save</button>
      </div>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
  }

  function save() {
    if (!_editingName) { App.toast('No item selected', 'warn'); return; }
    const qty = parseFloat(document.getElementById('pantry-form-qty')?.value) || 0;
    const unit = document.getElementById('pantry-form-unit')?.value || 'item';
    const perishable = document.getElementById('pantry-form-perishable')?.checked || false;
    const gramEquiv = document.getElementById('pantry-form-gramequiv')?.value || '';
    if (qty < 0) { App.toast('Qty cannot be negative', 'warn'); return; }
    Data.setPantryItem(_editingName, { qty, unit, perishable, gramEquiv });
    App.closeModal();
    render();
    App.toast('Pantry updated ✓');
  }

  function remove(idx) {
    const allItems = Data.getPantry();
    const item = allItems[idx];
    if (!item) return;
    if (!confirm('Remove this item from pantry?')) return;
    Data.removePantryItem(item.ingredient);
    render();
    App.toast('Removed');
  }

  function resetPerishables() {
    const pantry = Data.getPantry();
    const count = pantry.filter(p => p.perishable).length;
    if (count === 0) { App.toast('No perishable items in pantry', 'warn'); return; }
    if (!confirm(`Reset ${count} perishable item${count !== 1 ? 's' : ''} to 0?`)) return;
    Data.clearPantryPerishables();
    render();
    App.toast('Perishables reset ✓');
  }

  function _fmtQty(q) {
    if (q === undefined || q === null) return '0';
    const n = parseFloat(q);
    if (isNaN(n)) return '0';
    return n % 1 === 0 ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
  }

  function _fmtBatchDate(dateStr) {
    if (!dateStr) return 'undated';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const now = new Date();
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const dayStr = d.getDate() + ' ' + months[d.getMonth()];
    return d.getFullYear() !== now.getFullYear() ? dayStr + ' ' + d.getFullYear() : dayStr;
  }

  function _fmtBatches(item) {
    const batches = (item.batches || []).filter(b => (parseFloat(b.qty) || 0) > 0);
    if (batches.length === 0) return '';
    const fifo = Data.getFIFO();
    const sorted = [...batches].sort((a, b) => (a.date || '') < (b.date || '') ? -1 : 1);
    const rows = sorted.map(b =>
      `<div class="pantry-batch-row">${_fmtQty(b.qty)} ${_esc(item.unit)} · ${_fmtBatchDate(b.date)}</div>`
    ).join('');
    const badge = (batches.length > 1 && fifo)
      ? `<span class="pantry-fifo-badge">FIFO</span>` : '';
    return `<div class="pantry-batch-list">${rows}${badge}</div>`;
  }

  function _esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { render, filter, openAddForm, saveNew, openEditForm, save, remove, resetPerishables, onUnitChange };
})();
