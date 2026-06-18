/* ══════════════════════════════════════
   shopping.js — Shopping list view
   ══════════════════════════════════════ */

const Shopping = (() => {

  let _userUnchecked = new Set(); // ingredient names (lowercase) the user explicitly unticked
  let _logItems = []; // items captured when Log Purchase modal was opened
  let _pendingSpend = null;

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

  function _renderPantryBadge(item) {
    const pantryItem = Data.getPantryItem(item.name);
    if (!pantryItem || pantryItem.qty <= 0) return '';
    const [shoppingBase, shoppingBaseUnit] = Data.normalizeToBase(item.qty || 0, item.unit);
    const [pantryBase, pantryBaseUnit] = Data.normalizeToBase(pantryItem.qty, pantryItem.unit, pantryItem.gramEquiv);
    if (shoppingBaseUnit === pantryBaseUnit) {
      if (pantryBase >= (item.qty ? shoppingBase : 0)) {
        return `<div class="pantry-in-stock">✓ In pantry (${_fmtPantryQty(pantryItem.qty)} ${_esc(pantryItem.unit)})</div>`;
      }
      return `<div class="pantry-partial-stock">In pantry: ${_fmtPantryQty(pantryItem.qty)} ${_esc(pantryItem.unit)}</div>`;
    }
    return `<div class="pantry-partial-stock">In pantry: ${_fmtPantryQty(pantryItem.qty)} ${_esc(pantryItem.unit)}</div>`;
  }

  function _fmtPantryQty(q) { return fmtQty(q) || '0'; }

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
    let total = 0;
    let unpriced = 0;
    items.forEach(item => {
      const cost = Data.lookupPrice(item.name, item.qty, item.unit);
      if (cost != null) total += cost;
      else unpriced++;
    });
    if (total === 0 && unpriced === items.length) return '';
    const note = unpriced > 0
      ? `<span class="shop-total-note">${unpriced} item${unpriced > 1 ? 's' : ''} unpriced</span>`
      : '';
    return `<div class="shop-total">
    <span class="shop-total-label">Estimated total</span>
    <span class="shop-total-amount">R ${total.toFixed(2)}</span>
    ${note}
  </div>`;
  }

  function render() {
    // Auto-tick items fully covered by pantry stock (cross-unit aware)
    const preItems = Data.getShoppingList();
    preItems.forEach((item, idx) => {
      if (item.checked) return;
      if (_userUnchecked.has(item.name.toLowerCase().trim())) return; // user explicitly unticked
      const pantry = Data.getPantry();
      const pantryItem = pantry.find(p => p.ingredient.toLowerCase() === item.name.toLowerCase().trim());
      if (!pantryItem || pantryItem.qty <= 0) return;
      if (!item.qty) return; // skip items with no specified quantity
      const [shoppingBase, shoppingBaseUnit] = Data.normalizeToBase(item.qty, item.unit);
      const [pantryBase, pantryBaseUnit] = Data.normalizeToBase(pantryItem.qty, pantryItem.unit, pantryItem.gramEquiv);
      if (shoppingBaseUnit === pantryBaseUnit && pantryBase >= shoppingBase) {
        Data.toggleShoppingItem(idx);
      }
    });

    const items = Data.getShoppingList();
    const el = document.getElementById('shopping-list');
    if (!el) return;

    if (items.length === 0) {
      el.innerHTML = `<div class="empty-state"><span class="emoji">🛒</span>Your shopping list is empty.<br>Generate one from the Meal Planner.</div>`;
      return;
    }

    const groups = {};
    items.forEach((item, idx) => {
      const cat = guessCategory(item.name);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push({ ...item, _idx: idx });
    });

    const catOrder = ['produce','meat','dairy','spices & herbs','pasta & grains','pantry','frozen','drinks','other'];
    const orderedCats = catOrder.filter(c => groups[c]);

    el.innerHTML = orderedCats.map(cat => {
      const catItems = groups[cat];
      const rows = catItems.map(item => {
        const qty = fmtQty(item.qty);
        const label = qty ? `${qty}${item.unit ? ' ' + item.unit : ''} ${item.name}` : item.name;

        const hasSources = item.sources && item.sources.length > 0 &&
          (item.sources.length > 1 || (item.sources[0] && item.sources[0].context));
        let sourcesHtml = '';
        if (hasSources) {
          const sourceRows = item.sources.map(s => {
            const ctxParts = [];
            if (s.qty) ctxParts.push(fmtQty(s.qty) + (s.unit ? ' ' + s.unit : ''));
            if (s.context) ctxParts.push(s.context);
            return `<div class="shop-source-row">
              <span class="shop-source-recipe">${s.recipe}</span>
              ${ctxParts.length ? `<span class="shop-source-ctx">${ctxParts.join(' · ')}</span>` : ''}
            </div>`;
          }).join('');
          sourcesHtml = `<div id="shop-sources-${item._idx}" class="shop-item-sources hidden">${sourceRows}</div>`;
        }

        return `
          <div class="shop-item ${item.checked ? 'checked' : ''}" id="shop-item-${item._idx}">
            <input type="checkbox" ${item.checked ? 'checked' : ''}
              onchange="Shopping.toggle(${item._idx})" />
            <div class="shop-item-main">
              <div class="shop-item-top">
                <span class="shop-item-name">${label}</span>
                ${hasSources ? `<button id="shop-src-btn-${item._idx}" class="shop-src-toggle" onclick="Shopping.toggleSources(${item._idx})">View recipes ▾</button>` : ''}
              </div>
              ${_renderPantryBadge(item)}
              ${_renderPriceDisplay(item._idx, item)}
              ${sourcesHtml}
            </div>
          </div>`;
      }).join('');
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
    Data.toggleShoppingItem(idx);
    const items = Data.getShoppingList();
    const name = (items[idx]?.name || '').toLowerCase().trim();
    if (name) {
      if (!items[idx].checked) {
        _userUnchecked.add(name); // user manually unticked — don't re-auto-tick
      } else {
        _userUnchecked.delete(name); // user re-checked it — allow auto-tick again
      }
    }
    const el = document.getElementById('shop-item-' + idx);
    if (el) el.classList.toggle('checked', items[idx]?.checked);
  }

  function clearChecked() {
    const items = Data.getShoppingList().filter(i => !i.checked);
    Data.setShoppingList(items);
    render();
    App.toast('Checked items removed');
  }

  function openLogPurchase() {
    _logItems = Data.getShoppingList().filter(i => !i.checked);
    const items = _logItems;
    if (items.length === 0) {
      App.toast('Nothing to log — all items are already ticked', 'warn');
      return;
    }
    const rows = items.map((item, i) => {
      const qty = item.qty || 1;
      return `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);">
          <span style="flex:1;font-size:0.9rem;text-transform:capitalize">${_esc(item.name)}</span>
          <input type="number" id="log-qty-${i}" step="0.1" min="0"
            value="${qty}" style="width:60px;padding:4px;border:1px solid var(--border);border-radius:6px;" />
          <span style="font-size:0.85rem;color:var(--text-muted)">${_esc(item.unit || '')}</span>
        </div>`;
    }).join('');
    document.getElementById('modal-content').innerHTML = `
      <h3>Log Purchase</h3>
      <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:12px">Confirm quantities to add to pantry:</p>
      <div>${rows}</div>
      <div class="modal-actions" style="margin-top:16px">
        <button class="btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn-primary" onclick="Shopping.confirmPurchase()">Confirm &amp; Update Pantry</button>
      </div>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
  }

  function confirmPurchase() {
    const items = _logItems;
    items.forEach((item, i) => {
      const qty = parseFloat(document.getElementById('log-qty-' + i)?.value) || 0;
      if (qty > 0) {
        Data.setPantryItem(item.name, { qty, unit: item.unit || 'item' });
      }
    });
    App.closeModal();
    App.toast('Pantry updated ✓');
    render();
  }

  function openCompleteShop() {
    const items = Data.getShoppingList();
    const pricedItems = items.map(item => {
      const cost = Data.lookupPrice(item.name, item.qty, item.unit);
      return cost != null && cost > 0 ? { name: item.name, qty: item.qty, unit: item.unit, cost } : null;
    }).filter(Boolean);

    if (pricedItems.length === 0) {
      App.toast('No prices set — add prices to the Price Book first', 'warn');
      return;
    }

    const total = Math.round(pricedItems.reduce((s, i) => s + i.cost, 0) * 100) / 100;
    _pendingSpend = {
      date: new Date().toISOString().slice(0, 10),
      total,
      items: pricedItems,
    };

    const rows = pricedItems.map(item =>
      `<div style="padding:4px 0;font-size:0.9rem">${_esc(item.name)} × ${item.qty || ''} ${_esc(item.unit || '')} — R${item.cost.toFixed(2)}</div>`
    ).join('');

    document.getElementById('modal-content').innerHTML = `
      <h3>Complete Shop</h3>
      <div style="max-height:40vh;overflow-y:auto;margin-bottom:12px">${rows}</div>
      <div style="font-weight:700;font-size:1.05rem;margin-bottom:16px">Total: R${total.toFixed(2)}</div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn-primary" onclick="Shopping.confirmCompleteShop()">Log Spend &amp; Clear List</button>
      </div>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
  }

  function confirmCompleteShop() {
    if (!_pendingSpend) return;
    Data.logSpend(_pendingSpend);
    _pendingSpend = null;
    clearChecked();
    App.closeModal();
    App.toast('Shop logged ✓');
    render();
  }

  return { render, toggle, toggleSources, clearChecked, editPrice, savePrice, openLogPurchase, confirmPurchase, openCompleteShop, confirmCompleteShop };
})();
