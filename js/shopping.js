/* ══════════════════════════════════════
   shopping.js — Shopping list view
   ══════════════════════════════════════ */

const Shopping = (() => {

  // (no session state — per-item state lives on _db.shoppingList items directly)

  // Simple category guesser
  const CAT_MAP = {
    'produce':    ['onion','shallot','leek','spring onion','scallion','garlic','tomato','potato',
                   'sweet potato','yam','carrot','parsnip','turnip','beetroot','beet','pepper',
                   'capsicum','cucumber','spinach','kale','lettuce','bok choy','pak choi',
                   'mushroom','celery','zucchini','courgette','eggplant','aubergine','squash',
                   'pumpkin','broccoli','cauliflower','asparagus','pea','bean','corn','avocado',
                   'lemon','lime','banana','apple','orange','mango','pineapple','peach','pear',
                   'plum','grape','cherry','berry','basil','parsley','coriander','herb','ginger',
                   'chilli','chili','capsicum','fennel','radish','artichoke'],
    'meat':       ['beef','chicken','pork','lamb','veal','duck','turkey','mince','steak','bacon',
                   'sausage','salami','chorizo','ham','salmon','tuna','cod','snapper','bream',
                   'tilapia','trout','prawn','shrimp','crab','scallop','mussel','anchovy','fish'],
    'dairy':      ['milk','cream','butter','cheese','feta','yogurt','yoghurt','egg','cheddar',
                   'parmesan','mozzarella','ricotta','brie','gouda','gruyere','sour cream',
                   'creme fraiche','ghee','condensed milk','evaporated milk'],
    'spices & herbs': ['cumin','cayenne','paprika','smoked paprika','chili flake','red pepper flake',
                   'oregano','cinnamon','nutmeg','mace','turmeric','cardam','clove','thyme',
                   'rosemary','sage','tarragon','marjoram','bay leaf','chili powder','chilli powder',
                   'garlic powder','onion powder','allspice','mixed spice','pickling spice',
                   'mustard seed','mustard powder','saffron','star anise','fennel seed','caraway',
                   'coriander seed','ground coriander','curry powder','garam masala','tandoori',
                   'five spice','ras el hanout','za\'atar','sumac','harissa','dried herb',
                   'ground spice','spice blend','seasoning','black pepper','white pepper','peppercorn',
                   'vanilla pod','vanilla bean','dried chilli','chilli flake','smoked salt',
                   'celery salt','garlic salt'],
    'pantry':     ['oil','vinegar','sauce','paste','flour','sugar','salt','spice','stock','broth',
                   'tin','can','coconut','oats','rice','bread','biscuit','cracker','honey','syrup',
                   'jam','pickle','olive','capers','tahini','miso','soy sauce','fish sauce',
                   'oyster sauce','hoisin','worcestershire','hot sauce','sriracha','maple',
                   'baking powder','baking soda','yeast','cornstarch','cornflour','lentil',
                   'chickpea','kidney bean','black bean','dried fruit','raisin','sultana','nut',
                   'walnut','almond','cashew','pistachio','peanut','sesame'],
    'pasta & grains': ['pasta','spaghetti','penne','fettuccine','rigatoni','lasagne','noodle',
                   'rice noodle','quinoa','couscous','polenta','bulgur','barley','farro'],
    'frozen':     ['frozen'],
    'drinks':     ['water','juice','wine','beer','cider','spirits','coffee','tea','milk alternative',
                   'oat milk','almond milk','coconut milk','soy milk'],
  };

  function guessCategory(name) {
    const lower = name.toLowerCase();
    for (const [cat, keywords] of Object.entries(CAT_MAP)) {
      if (keywords.some(k => lower.includes(k))) return cat;
    }
    return 'other';
  }

  function fmtQty(q) {
    if (!q && q !== 0) return '';
    const n = parseFloat(q);
    if (isNaN(n)) return '';
    if (n === 0) return '';
    return n % 1 === 0 ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
  }

  function _esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  let _recipeFilter = null; // null = All; Set = selected recipe names

  function setRecipeFilter(name) {
    _recipeFilter = null; // reset to All
    render();
  }

  function toggleRecipeFilter(name) {
    if (!name) { _recipeFilter = null; render(); return; }
    if (!_recipeFilter) {
      _recipeFilter = new Set([name]);
    } else if (_recipeFilter.has(name)) {
      _recipeFilter.delete(name);
      if (_recipeFilter.size === 0) _recipeFilter = null;
    } else {
      _recipeFilter.add(name);
    }
    render();
  }

  let _confirmQtyOverrides = {};

  function _setConfirmQty(idx, value) {
    const qty = parseFloat(value);
    _confirmQtyOverrides[idx] = isNaN(qty) || qty < 0 ? null : qty;
  }

  function _buildRecipeFilterBar(items) {
    const names = new Set();
    items.forEach(item => {
      (item.sources || []).forEach(s => { if (s.recipe) names.add(s.recipe); });
    });
    if (names.size < 2) return '';
    const allActive = !_recipeFilter || _recipeFilter.size === 0;
    const allChip = `<button class="shop-recipe-chip${allActive ? ' active' : ''}" onclick="Shopping.setRecipeFilter(null)">All</button>`;
    const recipeChips = [...names].map(name => {
      const isActive = _recipeFilter && _recipeFilter.has(name);
      return `<button class="shop-recipe-chip${isActive ? ' active' : ''}" data-recipe="${_esc(name)}" onclick="Shopping.toggleRecipeFilter(this.dataset.recipe)">${_esc(name)}</button>`;
    }).join('');
    return `<div class="shop-recipe-filter">${allChip}${recipeChips}</div>`;
  }

  function _renderPriceDisplay(idx, item) {
    const card = Data.lookupPriceEntry(item.name);
    if (!card || !card.prices || card.prices.length === 0) {
      return `<div class="shop-price-display" id="shop-price-${idx}">
        <button class="shop-price-set" onclick="Shopping.editPrice(${idx})">+ Set price</button>
      </div>`;
    }
    const cost = Data.lookupPrice(item.name, item.qty, item.unit);
    const costHtml = cost != null && cost > 0
      ? `<span class="shop-price-cost">R ${cost.toFixed(2)}</span><span class="shop-price-sep">·</span>`
      : '';
    // Show "avg" when multiple prices exist, else show single price with retailer
    let perHtml;
    if (card.prices.length > 1) {
      // If all rows share the same unit, compute and display a true numeric average
      const uniqueUnits = [...new Set(card.prices.map(p => p.unit))];
      if (uniqueUnits.length === 1) {
        const avgPrice = card.prices.reduce((s, p) => s + p.pricePerUnit, 0) / card.prices.length;
        perHtml = `<span class="shop-price-per">avg R ${avgPrice.toFixed(2)}/${uniqueUnits[0]}</span>`;
      } else {
        perHtml = `<span class="shop-price-per">avg (${card.prices.length} prices)</span>`;
      }
    } else {
      const p = card.prices[0];
      const retailerHtml = p.retailer
        ? ` <span class="shop-price-retailer-tag">${_esc(p.retailer)}</span>` : '';
      perHtml = `<span class="shop-price-per">R ${p.pricePerUnit.toFixed(2)}/${p.unit}</span>${retailerHtml}`;
    }
    return `<div class="shop-price-display" id="shop-price-${idx}">
      ${costHtml}${perHtml}
      <button class="shop-price-edit-btn" onclick="Shopping.editPrice(${idx})" title="Edit price">✏</button>
    </div>`;
  }

  function _fmtPantryQty(q) { return fmtQty(q) || '0'; }

  function _hasPantryStock(item) {
    const p = Data.getPantryItem(item.name);
    return !!(p && p.qty > 0);
  }

  function _renderItem(item) {
    const qty = fmtQty(item.qty);
    const label = qty ? `${qty}${item.unit ? ' ' + item.unit : ''} ${item.name}` : item.name;

    const hasSources = item.sources && item.sources.length > 0 &&
      (item.sources.length > 1 || (item.sources[0] && item.sources[0].context));
    let sourcesHtml = '';
    if (hasSources) {
      const sourceRows = item.sources.map(s => {
        const ctxParts = [];
        if (s.qty) ctxParts.push(fmtQty(s.qty) + (s.unit ? ' ' + _esc(s.unit) : ''));
        if (s.context) ctxParts.push(_esc(s.context));
        return `<div class="shop-source-row">
          <span class="shop-source-recipe">${_esc(s.recipe)}</span>
          ${ctxParts.length ? `<span class="shop-source-ctx">${ctxParts.join(' · ')}</span>` : ''}
        </div>`;
      }).join('');
      sourcesHtml = `<div id="shop-sources-${item._idx}" class="shop-item-sources hidden">${sourceRows}</div>`;
    }

    const srcBtn = hasSources
      ? `<button id="shop-src-btn-${item._idx}" class="shop-src-toggle" onclick="Shopping.toggleSources(${item._idx})">View recipes ▾</button>`
      : '';

    if (item.pantryUsed) {
      const p = Data.getPantryItem(item.name);
      const pantryQtyHtml = p && p.qty > 0
        ? `<span class="shop-pantry-qty">· In pantry (${_fmtPantryQty(p.qty)} ${_esc(p.unit)})</span>`
        : '';
      return `
        <div class="shop-item pantry-used" id="shop-item-${item._idx}">
          <input type="checkbox" disabled />
          <div class="shop-item-main">
            <div class="shop-item-top">
              <span class="shop-item-name">${_esc(label)} 🏠</span>
              ${srcBtn}
            </div>
            <div class="shop-pantry-used-row">
              <button class="shop-undo-pantry" onclick="Shopping.markPantryUsed(${item._idx})">✕ undo pantry</button>
              ${pantryQtyHtml}
            </div>
            ${sourcesHtml}
          </div>
        </div>`;
    }

    let usePantryBtn = '';
    if (!item.checked && !item.pantryUsed) {
      const p = Data.getPantryItem(item.name);
      if (p && p.qty > 0) {
        const hintHtml = `<span class="shop-pantry-stock-hint">· ${_fmtPantryQty(p.qty)} ${_esc(p.unit)} in pantry</span>`;
        usePantryBtn = `<div class="shop-pantry-row"><button class="shop-use-pantry-btn" onclick="Shopping.markPantryUsed(${item._idx})">Use pantry ●</button>${hintHtml}</div>`;
      }
    }

    const actualInput = `<input type="number" class="shop-actual-input" id="shop-actual-${item._idx}"
      step="0.01" min="0"
      value="${item.actualPrice != null ? item.actualPrice : ''}"
      placeholder="actual R"
      onchange="Shopping.setActualPrice(${item._idx}, this.value)" />`;

    return `
      <div class="shop-item ${item.checked ? 'checked' : ''}" id="shop-item-${item._idx}">
        <input type="checkbox" ${item.checked ? 'checked' : ''}
          onchange="Shopping.toggle(${item._idx})" />
        <div class="shop-item-main">
          <div class="shop-item-top">
            <span class="shop-item-name">${_esc(label)}</span>
            ${srcBtn}
          </div>
          ${usePantryBtn}
          <div class="shop-price-row">
            ${_renderPriceDisplay(item._idx, item)}
            <div class="shop-actual-wrap">${actualInput}</div>
          </div>
          ${sourcesHtml}
        </div>
      </div>`;
  }

  function editPrice(idx) {
    const items = Data.getShoppingList();
    const item = items[idx];
    if (!item) return;
    const card = Data.lookupPriceEntry(item.name);
    const firstPrice = (card && card.prices && card.prices.length > 0) ? card.prices[0] : null;
    const units = ['g','100g','kg','ml','100ml','l','item','tsp','tbsp','clove','bunch','head','can','packet','loaf','dozen'];
    const unitOpts = units.map(u =>
      `<option value="${u}" ${(firstPrice ? firstPrice.unit : 'item') === u ? 'selected' : ''}>${u}</option>`
    ).join('');
    const priceEl = document.getElementById('shop-price-' + idx);
    if (!priceEl) return;
    priceEl.innerHTML = `
      <div class="shop-price-form">
        <span class="shop-pf-label">R</span>
        <input type="number" id="sp-price-${idx}" class="shop-pf-input"
          step="0.01" min="0" value="${firstPrice ? firstPrice.pricePerUnit : ''}" placeholder="0.00" />
        <span class="shop-pf-sep">per</span>
        <select id="sp-unit-${idx}" class="shop-pf-unit">${unitOpts}</select>
        <input type="text" id="sp-retailer-${idx}" class="shop-pf-retailer"
          value="${_esc(firstPrice ? (firstPrice.retailer || '') : '')}" placeholder="Store" maxlength="20" />
        <button class="btn-mini btn-mini-primary" onclick="Shopping.savePrice(${idx})">Save</button>
        <button class="btn-mini" onclick="Shopping.render()">✕</button>
      </div>`;
    document.getElementById('sp-price-' + idx)?.focus();
  }

  function savePrice(idx) {
    const items = Data.getShoppingList();
    const item = items[idx];
    if (!item) return;
    const price = parseFloat(document.getElementById('sp-price-' + idx)?.value);
    const unit = document.getElementById('sp-unit-' + idx)?.value || 'item';
    const retailer = (document.getElementById('sp-retailer-' + idx)?.value || '').trim();
    if (isNaN(price) || price < 0) { App.toast('Enter a valid price', 'warn'); return; }
    Data.setPriceEntry(item.name.toLowerCase().trim(), { unit, pricePerUnit: price, retailer });
    render();
    App.toast('Price saved ✓');
  }

  function _renderTotal(items) {
    const buyItems = items.filter(i => !i.pantryUsed);
    if (buyItems.length === 0) return '';

    let estimated = 0;
    let unpriced = 0;
    buyItems.forEach(item => {
      const cost = Data.lookupPrice(item.name, item.qty, item.unit);
      if (cost != null) estimated += cost;
      else if (item.actualPrice == null) unpriced++;
    });

    let actual = 0;
    let hasActual = false;
    buyItems.forEach(item => {
      if (item.actualPrice != null && item.actualPrice > 0) {
        actual += item.actualPrice;
        hasActual = true;
      }
    });

    if (estimated === 0 && !hasActual && unpriced === buyItems.length) return '';

    const unpricedNote = unpriced > 0
      ? `<div class="shop-total-note">${unpriced} item${unpriced > 1 ? 's' : ''} unpriced</div>`
      : '';

    const actualRow = hasActual
      ? `<div class="shop-total-row"><span class="shop-total-label">Actual</span><span class="shop-total-amount">R ${actual.toFixed(2)}</span></div>`
      : '';

    return `<div class="shop-total">
      <div class="shop-total-row">
        <span class="shop-total-label">Estimated</span>
        <span class="shop-total-amount">R ${estimated.toFixed(2)}</span>
      </div>
      ${actualRow}
      ${unpricedNote}
    </div>`;
  }

  function render() {
    const items = Data.getShoppingList();
    const el = document.getElementById('shopping-list');
    if (!el) return;

    if (items.length === 0) {
      el.innerHTML = `<div class="empty-state"><span class="emoji">🛒</span>Your shopping list is empty.<br>Generate one from the Meal Planner.</div>`;
      return;
    }

    const filterBar = _buildRecipeFilterBar(items);

    const visibleItems = !_recipeFilter || _recipeFilter.size === 0
      ? items
      : items.filter(item => {
          if (!item.sources || item.sources.length === 0) return true;
          return item.sources.some(s => _recipeFilter.has(s.recipe));
        });

    const groups = {};
    visibleItems.forEach(item => {
      const origIdx = items.indexOf(item);
      const cat = guessCategory(item.name);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push({ ...item, _idx: origIdx });
    });

    const catOrder = ['produce','meat','dairy','spices & herbs','pasta & grains','pantry','frozen','drinks','other'];
    const orderedCats = catOrder.filter(c => groups[c]);

    el.innerHTML = filterBar + orderedCats.map(cat => {
      const rows = groups[cat].map(item => _renderItem(item)).join('');
      return `
        <div class="shop-category">
          <div class="shop-cat-label">${cat.toUpperCase()}</div>
          ${rows}
        </div>`;
    }).join('') + _renderTotal(items);
  }

  function toggleSources(idx) {
    const sources = document.getElementById('shop-sources-' + idx);
    const btn = document.getElementById('shop-src-btn-' + idx);
    if (!sources) return;
    const isHidden = sources.classList.toggle('hidden');
    if (btn) btn.textContent = isHidden ? 'View recipes ▾' : 'Hide ▴';
  }

  function toggle(idx) {
    const items = Data.getShoppingList();
    const item = items[idx];
    if (!item) return;
    if (!item.checked && item.pantryUsed) {
      Data.updateShoppingItem(idx, { pantryUsed: false });
    }
    Data.toggleShoppingItem(idx);
    const updated = Data.getShoppingList();
    const el = document.getElementById('shop-item-' + idx);
    if (el) el.classList.toggle('checked', !!updated[idx]?.checked);
  }

  function markPantryUsed(idx) {
    const items = Data.getShoppingList();
    const item = items[idx];
    if (!item) return;
    const newState = !item.pantryUsed;
    Data.updateShoppingItem(idx, {
      pantryUsed: newState,
      checked: newState ? false : item.checked,
    });
    render();
  }

  function setActualPrice(idx, value) {
    const price = parseFloat(value);
    Data.updateShoppingItem(idx, { actualPrice: (isNaN(price) || price < 0) ? null : price });
    render();
  }

  function openAddAdHocItem() {
    const unitOpts = ['g','100g','kg','ml','100ml','l','item','tsp','tbsp','clove','bunch','head','can','packet','loaf','dozen']
      .map(u => `<option value="${u}"${u === 'item' ? ' selected' : ''}>${u}</option>`).join('');
    document.getElementById('modal-content').innerHTML = `
      <h3>Add item</h3>
      <div class="form-group">
        <label>Name</label>
        <div style="position:relative">
          <input type="text" id="adhoc-name" autocomplete="off" placeholder="e.g. milk"
            oninput="Shopping._adhocAutocomplete(this.value)"
            style="width:100%;box-sizing:border-box" />
          <div id="adhoc-suggestions" class="adhoc-suggestions hidden"></div>
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <div class="form-group" style="flex:1">
          <label>Qty</label>
          <input type="number" id="adhoc-qty" step="0.1" min="0" placeholder="1" />
        </div>
        <div class="form-group" style="flex:1">
          <label>Unit</label>
          <select id="adhoc-unit">${unitOpts}</select>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn-primary" onclick="Shopping.saveAdHocItem()">Add to list</button>
      </div>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('adhoc-name')?.focus();
  }

  function _adhocAutocomplete(query) {
    const suggestionsEl = document.getElementById('adhoc-suggestions');
    if (!suggestionsEl) return;
    const q = (query || '').toLowerCase().trim();
    if (q.length < 2) { suggestionsEl.classList.add('hidden'); return; }
    const matches = Data.getPriceBook()
      .map(e => e.ingredient)
      .filter(name => name.includes(q))
      .slice(0, 6);
    if (matches.length === 0) { suggestionsEl.classList.add('hidden'); return; }
    suggestionsEl.classList.remove('hidden');
    suggestionsEl.innerHTML = matches
      .map(name => `<div class="adhoc-suggestion" data-name="${_esc(name)}" onclick="Shopping._adhocSelect(this.dataset.name)">${_esc(name)}</div>`)
      .join('');
  }

  function _adhocSelect(name) {
    const input = document.getElementById('adhoc-name');
    if (input) input.value = name;
    const suggestionsEl = document.getElementById('adhoc-suggestions');
    if (suggestionsEl) suggestionsEl.classList.add('hidden');
  }

  function saveAdHocItem() {
    const name = (document.getElementById('adhoc-name')?.value || '').trim().toLowerCase();
    const qty = parseFloat(document.getElementById('adhoc-qty')?.value) || null;
    const unit = document.getElementById('adhoc-unit')?.value || 'item';
    if (!name) { App.toast('Enter an item name', 'warn'); return; }
    Data.addShoppingItem({ name, qty, unit, adhoc: true, checked: false });
    Data.ensurePriceBookEntries([{ name }]);
    App.closeModal();
    render();
    App.toast('Item added ✓');
  }

  function _updateConfirmTotal(bought) {
    const includeEst = document.getElementById('confirm-include-est')?.checked;
    let total = 0;
    bought.forEach(item => {
      if (item.actualPrice != null) {
        total += item.actualPrice;
      } else if (includeEst) {
        const est = Data.lookupPrice(item.name, item.qty, item.unit);
        if (est != null) total += est;
      }
    });
    const display = document.getElementById('confirm-total-display');
    if (display) display.textContent = `R ${total.toFixed(2)}`;
  }

  function openConfirmShop() {
    _confirmQtyOverrides = {};
    const items = Data.getShoppingList();
    const bought = items.map((item, idx) => ({ ...item, _origIdx: idx })).filter(i => i.checked);
    const pantryItems = items.map((item, idx) => ({ ...item, _origIdx: idx })).filter(i => i.pantryUsed);

    if (bought.length === 0 && pantryItems.length === 0) {
      App.toast('Nothing confirmed yet — tick items as bought or mark as pantry use', 'warn');
      return;
    }

    const boughtRows = bought.map(item => {
      const hasActual = item.actualPrice != null && item.actualPrice > 0;
      const est = Data.lookupPrice(item.name, item.qty, item.unit);
      let costHtml;
      if (hasActual) {
        costHtml = `<span class="confirm-item-cost">R ${item.actualPrice.toFixed(2)}</span>`;
      } else if (est != null) {
        costHtml = `<span class="confirm-item-cost"><span class="shop-est-badge">~est</span> R ${est.toFixed(2)}</span>`;
      } else {
        costHtml = `<span class="confirm-item-cost"><span class="shop-est-badge">~est</span> —</span>`;
      }
      const qtyInput = `<span class="confirm-item-qty-wrap"><input type="number" class="confirm-item-qty-input"
        id="confirm-qty-${item._origIdx}" step="0.01" min="0"
        value="${fmtQty(item.qty) || ''}" placeholder="${fmtQty(item.qty) || ''}"
        oninput="Shopping._setConfirmQty(${item._origIdx}, this.value)"
        title="Actual qty purchased" /><span class="confirm-item-unit">${_esc(item.unit || '')}</span></span>`;
      return `<div class="confirm-item-row">
      <span class="confirm-item-name">${_esc(item.name)}</span>
      ${qtyInput}
      ${costHtml}
    </div>`;
    }).join('');

    const pantryRows = pantryItems.map(item =>
      `<div class="confirm-item-row">
      <span class="confirm-item-name">${_esc(item.name)}</span>
      <span class="confirm-item-qty">${fmtQty(item.qty) || ''} ${_esc(item.unit || '')}</span>
      <span class="confirm-item-cost" style="color:var(--text-muted);font-style:italic">not purchasing</span>
    </div>`
    ).join('');

    const baseTotal = bought.reduce((s, i) => s + (i.actualPrice != null ? i.actualPrice : 0), 0);
    const hasUnpriced = bought.some(i => i.actualPrice == null);

    const estCheckboxHtml = hasUnpriced ? `
    <label class="confirm-est-toggle">
      <input type="checkbox" id="confirm-include-est" />
      Include estimated prices for unpriced items
    </label>` : '';

    document.getElementById('modal-content').innerHTML = `
    <h3>Confirm Shop</h3>
    <div class="form-group">
      <label>Store</label>
      <input type="text" id="confirm-retailer" placeholder="e.g. Woolworths" maxlength="30" />
    </div>
    ${bought.length > 0 ? `<div class="confirm-section-title">Purchased (${bought.length})</div>${boughtRows}` : ''}
    ${pantryItems.length > 0 ? `<div class="confirm-section-title">From pantry (${pantryItems.length})</div>${pantryRows}` : ''}
    ${estCheckboxHtml}
    <div class="confirm-total-row">
      Total: <strong id="confirm-total-display">R ${baseTotal.toFixed(2)}</strong>
    </div>
    <div class="form-group" style="margin-top:8px">
      <label>Override total (optional)</label>
      <input type="number" id="confirm-total-override" step="0.01" min="0"
        placeholder="Leave blank to use calculated total" />
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="App.closeModal()">Cancel</button>
      <button class="btn-primary" onclick="Shopping.confirmShop()">Confirm &amp; save</button>
    </div>`;
    document.getElementById('modal-overlay').classList.remove('hidden');

    const estCb = document.getElementById('confirm-include-est');
    if (estCb) estCb.addEventListener('change', () => _updateConfirmTotal(bought));
  }

  function confirmShop() {
    const items = Data.getShoppingList();
    const bought = items.map((item, idx) => ({ ...item, _origIdx: idx })).filter(i => i.checked);
    const pantryItems = items.map((item, idx) => ({ ...item, _origIdx: idx })).filter(i => i.pantryUsed);
    const retailer = (document.getElementById('confirm-retailer')?.value || '').trim();
    const includeEst = document.getElementById('confirm-include-est')?.checked || false;
    const overrideRaw = parseFloat(document.getElementById('confirm-total-override')?.value);

    let calculatedTotal = 0;
    bought.forEach(item => {
      if (item.actualPrice != null) {
        calculatedTotal += item.actualPrice;
      } else if (includeEst) {
        const est = Data.lookupPrice(item.name, item.qty, item.unit);
        if (est != null) calculatedTotal += est;
      }
    });
    const finalTotal = (!isNaN(overrideRaw) && overrideRaw >= 0) ? overrideRaw : calculatedTotal;

    // 1. Update price book for bought items with actualPrice
    bought.forEach(item => {
      const purchaseQty = _confirmQtyOverrides[item._origIdx] ?? item.qty;
      if (item.actualPrice != null && purchaseQty) {
        Data.setPriceEntry(item.name.toLowerCase().trim(), {
          unit: item.unit || 'item',
          pricePerUnit: item.actualPrice / purchaseQty,
          retailer,
        });
      }
    });

    // 2. Update pantry for bought items (add as new batch for FIFO tracking)
    bought.forEach(item => {
      const purchaseQty = _confirmQtyOverrides[item._origIdx] ?? item.qty;
      if (purchaseQty) {
        const existing = Data.getPantryItem(item.name);
        Data.addPantryBatch(item.name, purchaseQty, item.unit || 'item', { gramEquiv: existing?.gramEquiv });
      }
    });

    // 3. Log spend
    const spendItems = bought.map(item => {
      const hasActual = item.actualPrice != null;
      const cost = hasActual
        ? item.actualPrice
        : (Data.lookupPrice(item.name, item.qty, item.unit) || 0);
      return { name: item.name, qty: item.qty, unit: item.unit, cost, estimated: !hasActual };
    });
    Data.logSpend({ date: new Date().toISOString().slice(0, 10), total: finalTotal, retailer, items: spendItems });

    // 4. Remove confirmed items; keep unchecked, non-pantry-used items
    Data.setShoppingList(items.filter(i => !i.checked && !i.pantryUsed));

    App.closeModal();
    App.toast('Shop confirmed ✓');
    render();
  }

  function clearChecked() {
    const items = Data.getShoppingList().filter(i => !i.checked && !i.pantryUsed);
    Data.setShoppingList(items);
    render();
    App.toast('Checked items removed');
  }

  return { render, toggle, toggleSources, clearChecked, editPrice, savePrice, markPantryUsed, setActualPrice, openAddAdHocItem, _adhocAutocomplete, _adhocSelect, saveAdHocItem, openConfirmShop, confirmShop, setRecipeFilter, toggleRecipeFilter, _setConfirmQty };
})();
