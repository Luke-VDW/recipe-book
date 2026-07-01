/* ══════════════════════════════════════
   spoonacular.js — Recipe import
   ══════════════════════════════════════ */

const Importer = (() => {

  const BASE = 'https://api.spoonacular.com';

  function getKey() {
    return localStorage.getItem('rb_spoon_key') || '';
  }

  const UNIT_NORM = {
    tablespoons:'tbsp', tablespoon:'tbsp', tbsps:'tbsp',
    teaspoons:'tsp', teaspoon:'tsp', tsps:'tsp',
    cups:'cup', cloves:'clove', pieces:'piece',
    pinches:'pinch', pounds:'lb', ounces:'oz',
    grams:'g', kilograms:'kg', milliliters:'ml', liters:'l',
    '':'',
  };

  function normaliseUnit(u) {
    if (!u) return '';
    return UNIT_NORM[u.toLowerCase()] || u.toLowerCase();
  }

  function roundQty(q) {
    if (!q) return 0;
    if (q >= 500) return Math.round(q);
    if (q >= 50)  return Math.round(q / 5) * 5;
    if (q >= 10)  return Math.round(q * 2) / 2;
    if (q >= 1)   return Math.round(q * 4) / 4;
    return Math.round(q * 8) / 8;
  }

  function _esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _stripHtml(html) {
    return (html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  }

  async function search() {
    const key = getKey();
    const notice = document.getElementById('import-key-notice');
    if (!key) {
      notice && notice.classList.remove('hidden');
      return;
    }
    notice && notice.classList.add('hidden');

    const q = document.getElementById('import-search').value.trim();
    if (!q) return;

    const resultsEl = document.getElementById('import-results');
    resultsEl.innerHTML = '<div class="empty-state">Searching…</div>';

    try {
      const res = await fetch(
        `${BASE}/recipes/complexSearch?query=${encodeURIComponent(q)}&number=10&addRecipeInformation=true&apiKey=${key}`
      );
      if (!res.ok) throw new Error('API error ' + res.status);
      const data = await res.json();
      _saveQuota(res.headers);

      if (!data.results || data.results.length === 0) {
        resultsEl.innerHTML = '<div class="empty-state">No results found.</div>';
        return;
      }

      resultsEl.innerHTML = data.results.map(r => {
        const rawSummary = _stripHtml(r.summary || '');
        const summary = rawSummary.length > 160 ? rawSummary.substring(0, 157) + '…' : rawSummary;
        const tags = [...(r.cuisines || []), ...(r.diets || [])]
          .slice(0, 4)
          .map(t => `<span class="import-tag">${_esc(t)}</span>`)
          .join('');
        return `
          <div class="import-card">
            ${r.image ? `<img src="${_esc(r.image)}" alt="${_esc(r.title)}" loading="lazy" />` : ''}
            <div class="import-card-body">
              <h4>${_esc(r.title)}</h4>
              <div class="meta">${r.readyInMinutes ? `⏱ ${r.readyInMinutes}m` : ''} ${r.servings ? `· ${r.servings} servings` : ''}</div>
              ${summary ? `<div class="import-summary">${_esc(summary)}</div>` : ''}
              ${tags ? `<div class="import-tags">${tags}</div>` : ''}
              <button class="btn-primary" onclick="Importer.importRecipe(${r.id}, '${r.title.replace(/'/g,"\\'")}')">＋ Import</button>
            </div>
          </div>`;
      }).join('');
    } catch(err) {
      resultsEl.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
    }
  }

  async function importRecipe(id, title) {
    const key = getKey();
    if (!key) return;

    App.toast('Importing…', 'info');
    try {
      const res = await fetch(`${BASE}/recipes/${id}/information?includeNutrition=true&apiKey=${key}`);
      if (!res.ok) throw new Error('API error ' + res.status);
      const d = await res.json();
      _saveQuota(res.headers);

      // Build ingredients string — prefer metric measures when available
      const ingredients = (d.extendedIngredients || []).map(i => {
        const metric = i.measures?.metric;
        const rawQty  = metric?.amount ?? i.amount ?? 0;
        const rawUnit = metric?.unitShort ?? i.unit ?? '';
        const qty  = roundQty(rawQty);
        const unit = normaliseUnit(rawUnit);
        const name = (i.nameClean || i.name || '').trim();
        if (qty && unit) return `${qty}${unit} ${name}`;
        if (qty)         return `${qty} ${name}`;
        return name;
      }).filter(Boolean).join('; ');

      // Build method string, then convert any remaining °F to °C
      let method = '';
      if (d.analyzedInstructions && d.analyzedInstructions.length > 0) {
        method = d.analyzedInstructions[0].steps
          .map((s, i) => `${i+1}. ${s.step}`)
          .join('\n');
      } else if (d.instructions) {
        method = d.instructions.replace(/<[^>]+>/g, '');
      }
      method = method
        .replace(/(\d+(?:\.\d+)?)\s*°\s*F\b/g, (_, f) => `${Math.round((+f-32)*5/9)}°C`)
        .replace(/(\d+(?:\.\d+)?)\s*degrees?\s+Fahrenheit/gi, (_, f) => `${Math.round((+f-32)*5/9)}°C`);

      // Determine category
      const dishTypes = (d.dishTypes || []).map(t => t.toLowerCase());
      let category = 'Dinner';
      if (dishTypes.includes('breakfast') || dishTypes.includes('brunch')) category = 'Breakfast';
      else if (dishTypes.includes('lunch') || dishTypes.includes('salad'))  category = 'Lunch';
      else if (dishTypes.includes('dessert') || dishTypes.includes('sweet')) category = 'Dessert';
      else if (dishTypes.includes('snack') || dishTypes.includes('appetizer')) category = 'Snack';
      else if (dishTypes.includes('soup'))  category = 'Soup';
      else if (dishTypes.includes('side dish')) category = 'Side';

      // Tags from diets + cuisines
      const tags = [...(d.cuisines || []), ...(d.diets || [])]
        .map(t => t.charAt(0).toUpperCase() + t.slice(1)).slice(0, 5).join(', ');

      // Extract calories from nutrition data (per-serving × servings = total)
      const calNutrient = (d.nutrition?.nutrients || []).find(n => n.name === 'Calories');
      const kcalTotal = calNutrient ? Math.round(calNutrient.amount * (d.servings || 1)) : null;

      const recipe = {
        name: d.title,
        category,
        servings: d.servings || 2,
        prepMins: d.preparationMinutes > 0 ? d.preparationMinutes : Math.round((d.readyInMinutes || 0) * 0.3),
        cookMins: d.cookingMinutes > 0 ? d.cookingMinutes : Math.round((d.readyInMinutes || 0) * 0.7),
        ingredients,
        method,
        tags,
        source: d.sourceUrl || d.spoonacularSourceUrl || '',
        kcalTotal,
      };

      Data.addRecipe(recipe);
      Data.ensurePriceBookEntries(Recipes.parseIngredients(recipe.ingredients));
      Recipes.render();
      App.toast(`"${d.title}" imported ✓`);
    } catch(err) {
      App.toast('Import failed: ' + err.message, 'error');
    }
  }

  function _saveQuota(headers) {
    const left = headers.get('X-API-Quota-Left');
    if (left != null) {
      localStorage.setItem('rb_spoon_quota', left);
      const el = document.getElementById('spoon-quota-display');
      if (el) el.textContent = `API quota remaining today: ${left} points`;
    }
  }

  // Allow pressing Enter in search box
  function init() {
    const input = document.getElementById('import-search');
    if (input) {
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') search();
      });
    }
  }

  return { search, importRecipe, init, getKey };
})();
