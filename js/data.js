/* ══════════════════════════════════════
   data.js — Storage, Google Drive sync
   ══════════════════════════════════════ */

const Data = (() => {

  // ── Internal state ──────────────────
  let _db = {
    version: '1.1',
    lastUpdated: new Date().toISOString(),
    recipes: [],
    mealPlan: { week1:{}, week2:{}, week3:{}, week4:{} },
    pantry: [],
    shoppingList: [],
    priceBook: [],
  };

  const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  const MEALS = ['breakfast','lunch','dinner'];

  // ── LocalStorage ────────────────────
  function load() {
    try {
      const raw = localStorage.getItem('recipebook_db');
      if (raw) _db = { ..._db, ...JSON.parse(raw) };
      // Ensure mealPlan weeks all have full structure
      ['week1','week2','week3','week4'].forEach(w => {
        _db.mealPlan[w] = _db.mealPlan[w] || {};
        DAYS.forEach(d => {
          _db.mealPlan[w][d] = _db.mealPlan[w][d] || { breakfast:'', lunch:'', dinner:'' };
        });
      });
      if (!_db.priceBook) _db.priceBook = [];
    } catch(e) { console.warn('Data.load error', e); }
  }

  function save() {
    _db.lastUpdated = new Date().toISOString();
    localStorage.setItem('recipebook_db', JSON.stringify(_db));
  }

  // ── Accessors ───────────────────────
  function getRecipes()     { return _db.recipes || []; }
  function getPlan()        { return _db.mealPlan; }
  function getPantry()      { return _db.pantry || []; }
  function getShoppingList(){ return _db.shoppingList || []; }

  function addRecipe(r) {
    r.id = r.id || 'r_' + Date.now();
    r.savedDate = r.savedDate || new Date().toISOString().slice(0,10);
    _db.recipes.push(r);
    save();
    return r;
  }

  function updateRecipe(r) {
    const idx = _db.recipes.findIndex(x => x.id === r.id);
    if (idx >= 0) { _db.recipes[idx] = r; save(); }
  }

  function deleteRecipe(id) {
    _db.recipes = _db.recipes.filter(r => r.id !== id);
    // Remove from meal plan too
    ['week1','week2','week3','week4'].forEach(w => {
      DAYS.forEach(d => {
        MEALS.forEach(m => {
          if (_db.mealPlan[w][d] && _db.mealPlan[w][d][m] === id)
            _db.mealPlan[w][d][m] = '';
        });
      });
    });
    ['week1','week2','week3','week4'].forEach(w => {
      if (_db.mealPlan[w]?.treats) {
        _db.mealPlan[w].treats = _db.mealPlan[w].treats.filter(t => t.recipeId !== id);
      }
    });
    save();
  }

  function getRecipeById(id) {
    return _db.recipes.find(r => r.id === id) || null;
  }

  function setMealSlot(week, day, meal, recipeId) {
    const wk = 'week' + week;
    _db.mealPlan[wk] = _db.mealPlan[wk] || {};
    _db.mealPlan[wk][day] = _db.mealPlan[wk][day] || {};
    _db.mealPlan[wk][day][meal] = recipeId;
    save();
  }

  function setShoppingList(items) {
    _db.shoppingList = items;
    save();
  }

  function setTreats(week, treats) {
    const wk = 'week' + week;
    _db.mealPlan[wk] = _db.mealPlan[wk] || {};
    _db.mealPlan[wk].treats = treats;
    save();
  }

  function setRecipeCalories(id, kcal) {
    const idx = _db.recipes.findIndex(r => r.id === id);
    if (idx >= 0) {
      _db.recipes[idx].kcalTotal = kcal;
      save();
    }
  }

  // ── Unit conversion helpers ──────────
  function _normalizeToBase(qty, unit) {
    const u = (unit || '').toLowerCase();
    if (u === 'kg')   return [qty * 1000, 'g'];
    if (u === 'g')    return [qty, 'g'];
    if (u === 'l')    return [qty * 1000, 'ml'];
    if (u === 'ml')   return [qty, 'ml'];
    if (u === 'tsp')  return [qty * 5, 'ml'];
    if (u === 'tbsp') return [qty * 15, 'ml'];
    if (u === 'cup')  return [qty * 240, 'ml'];
    if (u === 'oz')   return [qty * 28.35, 'g'];
    if (u === 'lb')   return [qty * 453.6, 'g'];
    return [qty, 'item'];
  }

  function _pricePerBase(pricePerUnit, pbUnit) {
    if (pbUnit === 'g')     return [pricePerUnit, 'g'];
    if (pbUnit === '100g')  return [pricePerUnit / 100, 'g'];
    if (pbUnit === 'kg')    return [pricePerUnit / 1000, 'g'];
    if (pbUnit === 'ml')    return [pricePerUnit, 'ml'];
    if (pbUnit === '100ml') return [pricePerUnit / 100, 'ml'];
    if (pbUnit === 'l')     return [pricePerUnit / 1000, 'ml'];
    if (pbUnit === 'tsp')   return [pricePerUnit / 5, 'ml'];
    if (pbUnit === 'tbsp')  return [pricePerUnit / 15, 'ml'];
    return [pricePerUnit, 'item'];
  }

  // ── Price Book CRUD ──────────────────
  function getPriceBook() { return _db.priceBook || []; }

  function setPriceEntry(entry, idx) {
    if (!_db.priceBook) _db.priceBook = [];
    if (idx !== undefined && idx >= 0 && idx < _db.priceBook.length) {
      _db.priceBook[idx] = entry;
    } else {
      const existing = _db.priceBook.findIndex(
        e => e.ingredient.toLowerCase() === entry.ingredient.toLowerCase()
      );
      if (existing >= 0) _db.priceBook[existing] = entry;
      else _db.priceBook.push(entry);
    }
    save();
  }

  function removePriceEntry(idx) {
    if (!_db.priceBook || idx < 0 || idx >= _db.priceBook.length) return;
    _db.priceBook.splice(idx, 1);
    save();
  }

  function lookupPriceEntry(name) {
    const lower = (name || '').toLowerCase().trim();
    const book = _db.priceBook || [];
    return book.find(e =>
      lower.includes(e.ingredient.toLowerCase()) ||
      e.ingredient.toLowerCase().includes(lower)
    ) || null;
  }

  function lookupPrice(name, qty, unit) {
    const entry = lookupPriceEntry(name);
    if (!entry) return null;
    const parsedQty = parseFloat(qty) || 0;
    if (parsedQty === 0) return 0;
    const [baseQty, baseType]          = _normalizeToBase(parsedQty, unit || '');
    const [pbPricePerBase, pbBaseType] = _pricePerBase(entry.pricePerUnit, entry.unit);
    if (baseType !== pbBaseType) return null;
    return Math.round(baseQty * pbPricePerBase * 100) / 100;
  }

  function toggleShoppingItem(idx) {
    if (_db.shoppingList[idx]) {
      _db.shoppingList[idx].checked = !_db.shoppingList[idx].checked;
      save();
    }
  }

  // ── Google Drive Sync ────────────────
  // Credentials stored in localStorage (not in _db)
  function getClientId()  { return localStorage.getItem('rb_gcp_client_id') || ''; }
  function setClientId(v) { localStorage.setItem('rb_gcp_client_id', v); }
  function getToken()     { return localStorage.getItem('rb_drive_token') || ''; }
  function setToken(v)    { localStorage.setItem('rb_drive_token', v); }
  function clearToken()   { localStorage.removeItem('rb_drive_token'); }

  function isDriveConnected() {
    return !!(getToken() && getClientId());
  }

  async function connectDrive() {
    let clientId = getClientId();
    if (!clientId) {
      clientId = prompt('Paste your Google OAuth Client ID (see Settings > Setup Guide):');
      if (!clientId) return;
      setClientId(clientId.trim());
    }
    // Open OAuth popup
    const redirectUri = window.location.href.split('?')[0].split('#')[0].replace(/index\.html$/, '') + 'oauth.html';
    const scope = encodeURIComponent('https://www.googleapis.com/auth/drive.file');
    const url = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=token&scope=${scope}&prompt=consent`;
    const popup = window.open(url, 'oauth', 'width=500,height=600');
    // Listen for token from oauth.html
    window.addEventListener('message', function handler(ev) {
      if (ev.data && ev.data.type === 'oauth_token') {
        setToken(ev.data.token);
        window.removeEventListener('message', handler);
        popup && popup.close();
        Settings.updateDriveStatus();
        syncDrive();
      }
    });
  }

  function disconnectDrive() {
    clearToken();
    Settings.updateDriveStatus();
  }

  async function _findOrCreateFile() {
    const token = getToken();
    const name = 'RecipeBook_Data.json';
    // Search for existing file
    const search = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name%3D'${name}'+and+trashed%3Dfalse&fields=files(id,name,modifiedTime)`,
      { headers: { Authorization: 'Bearer ' + token } }
    );
    if (!search.ok) throw new Error('Drive search failed: ' + search.status);
    const result = await search.json();
    if (result.files && result.files.length > 0) return result.files[0].id;
    // Create new file
    const meta = JSON.stringify({ name, mimeType: 'application/json' });
    const content = JSON.stringify(_db, null, 2);
    const boundary = 'rb_boundary';
    const body = `--${boundary}\r\nContent-Type: application/json\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;
    const create = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );
    if (!create.ok) throw new Error('Drive create failed');
    const created = await create.json();
    return created.id;
  }

  async function syncDrive() {
    if (!isDriveConnected()) {
      App.toast('Not connected to Drive. Go to Settings.', 'warn');
      return;
    }
    const btn = document.getElementById('btn-sync');
    if (btn) btn.style.opacity = '0.4';
    try {
      const fileId = await _findOrCreateFile();
      const token = getToken();

      // Step 1: always pull from Drive
      const dl = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        { headers: { Authorization: 'Bearer ' + token } }
      );
      if (!dl.ok) throw new Error('Drive download failed: ' + dl.status);
      const remote = await dl.json();

      // Step 2: merge — add any recipes from Drive not already present locally
      const localIds = new Set(_db.recipes.map(r => r.id));
      const newRecipes = (remote.recipes || []).filter(r => !localIds.has(r.id));
      if (newRecipes.length) _db.recipes = [..._db.recipes, ...newRecipes];

      // Merge meal plan: fill local empty slots with Drive values
      const WEEKS = ['week1','week2','week3','week4'];
      WEEKS.forEach(w => {
        const remoteWk = (remote.mealPlan || {})[w] || {};
        DAYS.forEach(d => {
          const remoteDay = remoteWk[d] || {};
          MEALS.forEach(m => {
            if (remoteDay[m] && !(_db.mealPlan[w]?.[d]?.[m])) {
              _db.mealPlan[w] = _db.mealPlan[w] || {};
              _db.mealPlan[w][d] = _db.mealPlan[w][d] || {};
              _db.mealPlan[w][d][m] = remoteDay[m];
            }
          });
        });
        if (remoteWk.treats?.length && !(_db.mealPlan[w]?.treats?.length)) {
          _db.mealPlan[w].treats = remoteWk.treats;
        }
      });

      save();
      if (newRecipes.length) App.refresh();

      // Step 3: always push the merged result back to Drive
      await _uploadToDrive(fileId, token);

      const msg = newRecipes.length
        ? `Synced — pulled ${newRecipes.length} new recipe${newRecipes.length > 1 ? 's' : ''} from Drive ✓`
        : 'Synced with Drive ✓';
      App.toast(msg);
    } catch(err) {
      console.error('Sync error', err);
      App.toast('Sync failed — check console', 'error');
    } finally {
      if (btn) btn.style.opacity = '1';
    }
  }

  async function _uploadToDrive(fileId, token) {
    const content = JSON.stringify(_db, null, 2);
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: content,
      }
    );
    if (!res.ok) throw new Error('Drive upload failed: ' + res.status);
  }

  // ── Import / Export ─────────────────
  function exportJSON() {
    const blob = new Blob([JSON.stringify(_db, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'RecipeBook_Data.json';
    a.click();
  }

  function importJSON() {
    document.getElementById('import-file-input').click();
  }

  function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const imported = JSON.parse(e.target.result);
        _db = { ..._db, ...imported };
        save();
        App.toast('Data imported ✓');
        App.refresh();
      } catch(err) {
        App.toast('Invalid JSON file', 'error');
      }
    };
    reader.readAsText(file);
  }

  function clearAll() {
    if (!confirm('Delete ALL recipes, meal plan, and shopping list data? This cannot be undone.')) return;
    _db = {
      version: '1.1',
      lastUpdated: new Date().toISOString(),
      recipes: [],
      mealPlan: { week1:{}, week2:{}, week3:{}, week4:{} },
      pantry: [],
      shoppingList: [],
      priceBook: [],
    };
    save();
    App.toast('All data cleared');
    App.refresh();
  }

  // ── Starter data ────────────────────
  function loadStarterData() {
    if (_db.recipes.length > 0) return; // already has data
    _db.recipes = [
      {
        id: 'r_001', name: 'Classic Spaghetti Bolognese', category: 'Dinner',
        servings: 4, prepMins: 15, cookMins: 45,
        ingredients: '500g beef mince; 1 onion diced; 2 cloves garlic; 400g tinned tomatoes; 2 tbsp tomato paste; 300g spaghetti; 2 tbsp olive oil; salt; pepper',
        method: '1. Fry onion & garlic in olive oil until soft.\n2. Add mince, brown well.\n3. Stir in tomato paste, then tinned tomatoes.\n4. Simmer 30 min. Season.\n5. Cook pasta al dente, drain, serve with sauce.',
        tags: 'Italian, Family, Quick', source: '', savedDate: '2026-06-05',
      },
      {
        id: 'r_002', name: 'Simple Greek Salad', category: 'Salad',
        servings: 2, prepMins: 10, cookMins: 0,
        ingredients: '1 cucumber; 4 tomatoes; 0.5 red onion; 100g feta cheese; 50g black olives; 3 tbsp olive oil; 1 tbsp red wine vinegar; dried oregano',
        method: '1. Chop cucumber, tomatoes & onion into chunks.\n2. Combine in a bowl.\n3. Top with crumbled feta & olives.\n4. Drizzle oil & vinegar. Sprinkle oregano.',
        tags: 'Vegetarian, Quick, Light', source: '', savedDate: '2026-06-05',
      },
      {
        id: 'r_003', name: 'Banana Oat Pancakes', category: 'Breakfast',
        servings: 2, prepMins: 5, cookMins: 10,
        ingredients: '2 ripe bananas; 1 cup rolled oats; 2 eggs; 1 tsp vanilla extract; 1 pinch salt; 1 tbsp coconut oil',
        method: '1. Blend all ingredients until smooth.\n2. Heat pan with coconut oil over medium heat.\n3. Pour small rounds, cook 2-3 min each side until golden.',
        tags: 'Healthy, Gluten-free option, Quick', source: '', savedDate: '2026-06-05',
      },
    ];
    save();
  }

  function loadStarterPrices() {
    if (_db.priceBook && _db.priceBook.length > 0) return;
    const d = '2026-06-17';
    _db.priceBook = [
      // Produce
      { ingredient: 'onion',         unit: 'kg',   pricePerUnit: 20,  retailer: '', updatedDate: d },
      { ingredient: 'garlic',        unit: 'item', pricePerUnit: 4,   retailer: '', updatedDate: d },
      { ingredient: 'tomato',        unit: 'kg',   pricePerUnit: 35,  retailer: '', updatedDate: d },
      { ingredient: 'potato',        unit: 'kg',   pricePerUnit: 22,  retailer: '', updatedDate: d },
      { ingredient: 'carrot',        unit: 'kg',   pricePerUnit: 22,  retailer: '', updatedDate: d },
      { ingredient: 'capsicum',      unit: 'kg',   pricePerUnit: 55,  retailer: '', updatedDate: d },
      { ingredient: 'cucumber',      unit: 'item', pricePerUnit: 12,  retailer: '', updatedDate: d },
      { ingredient: 'spinach',       unit: 'kg',   pricePerUnit: 35,  retailer: '', updatedDate: d },
      { ingredient: 'mushroom',      unit: 'kg',   pricePerUnit: 80,  retailer: '', updatedDate: d },
      { ingredient: 'broccoli',      unit: 'kg',   pricePerUnit: 50,  retailer: '', updatedDate: d },
      { ingredient: 'avocado',       unit: 'item', pricePerUnit: 18,  retailer: '', updatedDate: d },
      { ingredient: 'lemon',         unit: 'item', pricePerUnit: 8,   retailer: '', updatedDate: d },
      { ingredient: 'lime',          unit: 'item', pricePerUnit: 6,   retailer: '', updatedDate: d },
      { ingredient: 'banana',        unit: 'kg',   pricePerUnit: 22,  retailer: '', updatedDate: d },
      { ingredient: 'apple',         unit: 'kg',   pricePerUnit: 38,  retailer: '', updatedDate: d },
      { ingredient: 'orange',        unit: 'kg',   pricePerUnit: 28,  retailer: '', updatedDate: d },
      { ingredient: 'ginger',        unit: '100g', pricePerUnit: 12,  retailer: '', updatedDate: d },
      { ingredient: 'chilli',        unit: '100g', pricePerUnit: 15,  retailer: '', updatedDate: d },
      { ingredient: 'spring onion',  unit: 'item', pricePerUnit: 6,   retailer: '', updatedDate: d },
      { ingredient: 'sweet potato',  unit: 'kg',   pricePerUnit: 28,  retailer: '', updatedDate: d },
      // Meat
      { ingredient: 'beef mince',    unit: 'kg',   pricePerUnit: 140, retailer: '', updatedDate: d },
      { ingredient: 'chicken breast',unit: 'kg',   pricePerUnit: 95,  retailer: '', updatedDate: d },
      { ingredient: 'chicken thigh', unit: 'kg',   pricePerUnit: 70,  retailer: '', updatedDate: d },
      { ingredient: 'chicken',       unit: 'kg',   pricePerUnit: 80,  retailer: '', updatedDate: d },
      { ingredient: 'pork',          unit: 'kg',   pricePerUnit: 110, retailer: '', updatedDate: d },
      { ingredient: 'lamb',          unit: 'kg',   pricePerUnit: 190, retailer: '', updatedDate: d },
      { ingredient: 'rump steak',    unit: 'kg',   pricePerUnit: 200, retailer: '', updatedDate: d },
      { ingredient: 'beef fillet',   unit: 'kg',   pricePerUnit: 420, retailer: '', updatedDate: d },
      { ingredient: 'bacon',         unit: 'kg',   pricePerUnit: 130, retailer: '', updatedDate: d },
      { ingredient: 'sausage',       unit: 'kg',   pricePerUnit: 90,  retailer: '', updatedDate: d },
      { ingredient: 'salmon',        unit: 'kg',   pricePerUnit: 280, retailer: '', updatedDate: d },
      { ingredient: 'tuna',          unit: '100g', pricePerUnit: 15,  retailer: '', updatedDate: d },
      // Dairy
      { ingredient: 'milk',          unit: 'l',    pricePerUnit: 26,  retailer: '', updatedDate: d },
      { ingredient: 'cream',         unit: '100ml',pricePerUnit: 16,  retailer: '', updatedDate: d },
      { ingredient: 'butter',        unit: '100g', pricePerUnit: 18,  retailer: '', updatedDate: d },
      { ingredient: 'cheddar',       unit: '100g', pricePerUnit: 28,  retailer: '', updatedDate: d },
      { ingredient: 'feta',          unit: '100g', pricePerUnit: 22,  retailer: '', updatedDate: d },
      { ingredient: 'mozzarella',    unit: '100g', pricePerUnit: 25,  retailer: '', updatedDate: d },
      { ingredient: 'parmesan',      unit: '100g', pricePerUnit: 55,  retailer: '', updatedDate: d },
      { ingredient: 'yogurt',        unit: 'kg',   pricePerUnit: 65,  retailer: '', updatedDate: d },
      { ingredient: 'egg',           unit: 'item', pricePerUnit: 4,   retailer: '', updatedDate: d },
      { ingredient: 'sour cream',    unit: '100g', pricePerUnit: 12,  retailer: '', updatedDate: d },
      // Pantry
      { ingredient: 'olive oil',     unit: '100ml',pricePerUnit: 18,  retailer: '', updatedDate: d },
      { ingredient: 'sunflower oil', unit: 'l',    pricePerUnit: 25,  retailer: '', updatedDate: d },
      { ingredient: 'coconut oil',   unit: '100ml',pricePerUnit: 22,  retailer: '', updatedDate: d },
      { ingredient: 'flour',         unit: 'kg',   pricePerUnit: 16,  retailer: '', updatedDate: d },
      { ingredient: 'sugar',         unit: 'kg',   pricePerUnit: 18,  retailer: '', updatedDate: d },
      { ingredient: 'rice',          unit: 'kg',   pricePerUnit: 18,  retailer: '', updatedDate: d },
      { ingredient: 'pasta',         unit: 'kg',   pricePerUnit: 28,  retailer: '', updatedDate: d },
      { ingredient: 'spaghetti',     unit: 'kg',   pricePerUnit: 28,  retailer: '', updatedDate: d },
      { ingredient: 'oats',          unit: 'kg',   pricePerUnit: 38,  retailer: '', updatedDate: d },
      { ingredient: 'bread',         unit: 'item', pricePerUnit: 22,  retailer: '', updatedDate: d },
      { ingredient: 'honey',         unit: '100g', pricePerUnit: 16,  retailer: '', updatedDate: d },
      { ingredient: 'soy sauce',     unit: '100ml',pricePerUnit: 12,  retailer: '', updatedDate: d },
      { ingredient: 'tomato paste',  unit: '100g', pricePerUnit: 10,  retailer: '', updatedDate: d },
      { ingredient: 'tinned tomato', unit: '100g', pricePerUnit: 5,   retailer: '', updatedDate: d },
      { ingredient: 'coconut milk',  unit: '100ml',pricePerUnit: 8,   retailer: '', updatedDate: d },
      { ingredient: 'stock',         unit: 'item', pricePerUnit: 8,   retailer: '', updatedDate: d },
      { ingredient: 'vinegar',       unit: '100ml',pricePerUnit: 4,   retailer: '', updatedDate: d },
      // Spices
      { ingredient: 'cumin',         unit: '100g', pricePerUnit: 38,  retailer: '', updatedDate: d },
      { ingredient: 'paprika',       unit: '100g', pricePerUnit: 32,  retailer: '', updatedDate: d },
      { ingredient: 'turmeric',      unit: '100g', pricePerUnit: 30,  retailer: '', updatedDate: d },
      { ingredient: 'cinnamon',      unit: '100g', pricePerUnit: 35,  retailer: '', updatedDate: d },
      { ingredient: 'curry powder',  unit: '100g', pricePerUnit: 42,  retailer: '', updatedDate: d },
      { ingredient: 'garam masala',  unit: '100g', pricePerUnit: 45,  retailer: '', updatedDate: d },
      { ingredient: 'black pepper',  unit: '100g', pricePerUnit: 42,  retailer: '', updatedDate: d },
      { ingredient: 'cayenne',       unit: '100g', pricePerUnit: 38,  retailer: '', updatedDate: d },
      { ingredient: 'oregano',       unit: '100g', pricePerUnit: 32,  retailer: '', updatedDate: d },
      { ingredient: 'thyme',         unit: '100g', pricePerUnit: 32,  retailer: '', updatedDate: d },
    ];
    save();
  }

  return {
    load, save, getRecipes, getPlan, getPantry, getShoppingList,
    addRecipe, updateRecipe, deleteRecipe, getRecipeById,
    setMealSlot, setShoppingList, setTreats, setRecipeCalories, toggleShoppingItem,
    isDriveConnected, connectDrive, disconnectDrive, syncDrive,
    exportJSON, importJSON, handleImportFile, clearAll,
    loadStarterData, loadStarterPrices, getClientId, setClientId,
    getPriceBook, setPriceEntry, removePriceEntry, lookupPriceEntry, lookupPrice,
    DAYS, MEALS,
  };
})();
