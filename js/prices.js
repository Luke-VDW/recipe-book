/* ══════════════════════════════════════
   prices.js — Price Book management view
   ══════════════════════════════════════ */

const PriceBook = (() => {
  let _filter = '';

  const UNITS = ['g','100g','kg','ml','100ml','l','item','tsp','tbsp'];

  function render() {
    const entries = Data.getPriceBook();
    const el = document.getElementById('pricebook-list');
    if (!el) return;
    const filterLower = _filter.toLowerCase();
    const filtered = filterLower
      ? entries.filter(e => e.ingredient.toLowerCase().includes(filterLower))
      : entries;

    if (filtered.length === 0) {
      el.innerHTML = `<div class="empty-state"><span class="emoji">💰</span>${
        filterLower ? 'No matches.' : 'No prices yet. Tap ＋ Add to get started.'
      }</div>`;
      return;
    }

    el.innerHTML = filtered.map(entry => {
      const realIdx = entries.indexOf(entry);
      const retailer = entry.retailer
        ? `<span class="pb-retailer">${_esc(entry.retailer)}</span>` : '';
      return `
      <div class="pb-row">
        <div class="pb-row-main">
          <span class="pb-ingredient">${_esc(entry.ingredient)}</span>
          <span class="pb-price">R ${entry.pricePerUnit.toFixed(2)}/${entry.unit}</span>
          ${retailer}
        </div>
        <div class="pb-row-actions">
          <button class="btn-mini" onclick="PriceBook.openEditForm(${realIdx})">Edit</button>
          <button class="btn-mini btn-danger-mini" onclick="PriceBook.remove(${realIdx})">✕</button>
        </div>
      </div>`;
    }).join('');
  }

  function filter() {
    _filter = (document.getElementById('pb-search')?.value || '').trim();
    render();
  }

  function openAddForm() {
    _openForm(null, null);
  }

  function openEditForm(idx) {
    const entry = Data.getPriceBook()[idx];
    if (entry) _openForm(entry, idx);
  }

  function _openForm(entry, idx) {
    const e = entry || {};
    const unitOpts = UNITS.map(u =>
      `<option value="${u}" ${(e.unit || 'kg') === u ? 'selected' : ''}>${u}</option>`
    ).join('');
    document.getElementById('modal-content').innerHTML = `
    <h3>${entry ? 'Edit Price' : 'Add Price'}</h3>
    <div class="form-group">
      <label>Ingredient</label>
      <input id="pb-form-ing" type="text" value="${_esc(e.ingredient || '')}"
        placeholder="e.g. beef mince" ${entry ? '' : 'autofocus'} />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Price (R)</label>
        <input id="pb-form-price" type="number" step="0.01" min="0"
          value="${e.pricePerUnit != null ? e.pricePerUnit : ''}" placeholder="0.00" />
      </div>
      <div class="form-group">
        <label>Per</label>
        <select id="pb-form-unit">${unitOpts}</select>
      </div>
    </div>
    <div class="form-group">
      <label>Retailer (optional)</label>
      <input id="pb-form-retailer" type="text" value="${_esc(e.retailer || '')}"
        placeholder="e.g. Checkers" maxlength="30" />
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn-primary" onclick="PriceBook.saveForm(${idx !== null ? idx : 'null'})">Save</button>
    </div>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
  }

  function saveForm(idx) {
    const ingredient = (document.getElementById('pb-form-ing')?.value || '').trim().toLowerCase();
    const price = parseFloat(document.getElementById('pb-form-price')?.value);
    const unit = document.getElementById('pb-form-unit')?.value || 'item';
    const retailer = (document.getElementById('pb-form-retailer')?.value || '').trim();
    if (!ingredient) { App.toast('Enter an ingredient name', 'warn'); return; }
    if (isNaN(price) || price < 0) { App.toast('Enter a valid price', 'warn'); return; }
    Data.setPriceEntry({
      ingredient,
      unit,
      pricePerUnit: price,
      retailer,
      updatedDate: new Date().toISOString().slice(0, 10),
    });
    App.closeModal();
    render();
    App.toast('Price saved ✓');
  }

  function remove(idx) {
    if (!confirm('Remove this price entry?')) return;
    Data.removePriceEntry(idx);
    render();
    App.toast('Removed');
  }

  function _esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { render, filter, openAddForm, openEditForm, saveForm, remove };
})();
