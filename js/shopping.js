/* ══════════════════════════════════════
   shopping.js — Shopping list view
   ══════════════════════════════════════ */

const Shopping = (() => {

  // Simple category guesser
  const CAT_MAP = {
    'produce':    ['onion','garlic','tomato','potato','carrot','pepper','cucumber','spinach','lettuce',
                   'mushroom','celery','zucchini','broccoli','cauliflower','pea','bean','corn',
                   'avocado','lemon','lime','banana','apple','orange','berry','herb','basil','parsley',
                   'coriander','ginger','chilli','capsicum'],
    'meat':       ['beef','chicken','pork','lamb','mince','steak','bacon','sausage','turkey','salmon',
                   'tuna','prawn','shrimp','fish'],
    'dairy':      ['milk','cream','butter','cheese','feta','yogurt','egg','cheddar','parmesan'],
    'pantry':     ['oil','vinegar','sauce','paste','flour','sugar','salt','pepper','spice','seasoning',
                   'stock','broth','tin','can','coconut','oats','rice','bread','biscuit','cracker'],
    'pasta & grains': ['pasta','spaghetti','penne','rice','noodle','quinoa','couscous','polenta'],
    'frozen':     ['frozen'],
    'drinks':     ['water','juice','wine','beer','coffee','tea'],
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

  function render() {
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

    const catOrder = ['produce','meat','dairy','pasta & grains','pantry','frozen','drinks','other'];
    const orderedCats = catOrder.filter(c => groups[c]);

    el.innerHTML = orderedCats.map(cat => {
      const catItems = groups[cat];
      const rows = catItems.map(item => {
        const qty = fmtQty(item.qty);
        const label = qty ? `${qty}${item.unit ? ' ' + item.unit : ''} ${item.name}` : item.name;

        let sourceHtml = '';
        if (item.sources && item.sources.length > 1) {
          const sourceText = item.sources
            .map(s => `${s.recipe}${s.qty ? ' ' + fmtQty(s.qty) + (s.unit ? ' ' + s.unit : '') : ''}`)
            .join(' · ');
          sourceHtml = `<div class="shop-item-source">${sourceText}</div>`;
        }

        return `
          <div class="shop-item ${item.checked ? 'checked' : ''}" id="shop-item-${item._idx}">
            <input type="checkbox" ${item.checked ? 'checked' : ''}
              onchange="Shopping.toggle(${item._idx})" />
            <div class="shop-item-main">
              <span class="shop-item-name">${label}</span>
              ${sourceHtml}
            </div>
          </div>`;
      }).join('');
      return `
        <div class="shop-category">
          <div class="shop-cat-label">${cat.toUpperCase()}</div>
          ${rows}
        </div>`;
    }).join('');
  }

  function toggle(idx) {
    Data.toggleShoppingItem(idx);
    // Update just this item's style without full re-render
    const items = Data.getShoppingList();
    const el = document.getElementById('shop-item-' + idx);
    if (el) el.classList.toggle('checked', items[idx]?.checked);
  }

  function clearChecked() {
    const items = Data.getShoppingList().filter(i => !i.checked);
    Data.setShoppingList(items);
    render();
    App.toast('Checked items removed');
  }

  return { render, toggle, clearChecked };
})();
