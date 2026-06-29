/* ══════════════════════════════════════
   data.js — Storage, Google Drive sync
   ══════════════════════════════════════ */

const Data = (() => {

  // ── Internal state ──────────────────
  let _db = {
    version: '1.1',
    lastUpdated: new Date().toISOString(),
    recipes: [],
    deletedRecipeIds: [],
    mealPlan: { week1:{}, week2:{}, week3:{}, week4:{} },
    pantry: [],
    shoppingList: [],
    priceBook: [],
    spendLog: [],
    cookLog: [],
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
      if (!_db.spendLog) _db.spendLog = [];
      if (!_db.deletedRecipeIds) _db.deletedRecipeIds = [];
      if (!_db.cookLog) _db.cookLog = [];
      if (!_db.pantry) _db.pantry = [];
      // Migrate: add batches to pantry items that have none
      _db.pantry.forEach(item => {
        if (!item.batches) {
          item.batches = [{ qty: item.qty || 0, date: item.updatedDate || '' }];
        }
      });
      // Init settings
      if (!_db.settings) _db.settings = {};
      if (_db.settings.fifo === undefined) _db.settings.fifo = true;
      // Migrate v1 flat priceBook to v2 nested format — v1 data discarded intentionally, re-seed starter prices
      if (_db.priceBook.length > 0 && _db.priceBook[0].unit !== undefined) {
        _db.priceBook = [];
        loadStarterPrices();
      }
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

  function setPantryItem(ingredientName, opts) {
    if (!_db.pantry) _db.pantry = [];
    const name = (ingredientName || '').toLowerCase().trim();
    let item = _db.pantry.find(p => p.ingredient.toLowerCase() === name);
    const today = new Date().toISOString().slice(0, 10);
    if (!item) {
      item = { ingredient: name, qty: 0, unit: 'item', updatedDate: '', perishable: false, batches: [] };
      _db.pantry.push(item);
    }
    item.qty = parseFloat(opts.qty) || 0;
    item.unit = opts.unit || item.unit;
    if (opts.gramEquiv) { item.gramEquiv = parseFloat(opts.gramEquiv); } else { delete item.gramEquiv; }
    if (opts.perishable !== undefined) item.perishable = !!opts.perishable;
    item.updatedDate = today;
    item.batches = [{ qty: item.qty, date: today }];
    save();
  }

  function addPantryBatch(ingredientName, qty, unit, opts) {
    if (!_db.pantry) _db.pantry = [];
    const name = (ingredientName || '').toLowerCase().trim();
    const today = new Date().toISOString().slice(0, 10);
    const batchQty = parseFloat(qty) || 0;
    let item = _db.pantry.find(p => p.ingredient.toLowerCase() === name);
    if (!item) {
      item = { ingredient: name, qty: 0, unit: unit || 'item', updatedDate: today, perishable: false, batches: [] };
      _db.pantry.push(item);
    }
    if (unit) item.unit = unit;
    if (!item.batches) item.batches = [];
    const gramEquiv = opts && opts.gramEquiv ? parseFloat(opts.gramEquiv) : undefined;
    if (gramEquiv) item.gramEquiv = gramEquiv;
    if (opts && opts.perishable !== undefined) item.perishable = !!opts.perishable;
    item.batches.push({ qty: batchQty, date: (opts && opts.date) || today });
    item.qty = item.batches.reduce((s, b) => s + (parseFloat(b.qty) || 0), 0);
    item.updatedDate = today;
    save();
  }

  function deductPantryFIFO(ingredientName, deductAmt, unit) {
    const name = (ingredientName || '').toLowerCase().trim();
    const item = (_db.pantry || []).find(p => p.ingredient.toLowerCase() === name);
    if (!item) return;
    if (!item.batches) item.batches = [{ qty: item.qty || 0, date: item.updatedDate || '' }];

    let toDeduct = parseFloat(deductAmt) || 0;
    if (unit && unit.toLowerCase() !== item.unit.toLowerCase()) {
      const [deductBase, deductBaseUnit] = normalizeToBase(toDeduct, unit, item.gramEquiv);
      const [itemBase, itemBaseUnit] = normalizeToBase(1, item.unit, item.gramEquiv);
      if (deductBaseUnit === itemBaseUnit && itemBase > 0) {
        toDeduct = deductBase / itemBase;
      } else {
        return;
      }
    }

    item.batches.sort((a, b) => (a.date || '') < (b.date || '') ? -1 : 1);

    let remaining = toDeduct;
    item.batches = item.batches.map(batch => {
      if (remaining <= 0) return batch;
      const take = Math.min(batch.qty, remaining);
      remaining -= take;
      return { ...batch, qty: batch.qty - take };
    }).filter(b => b.qty > 0.0001);

    item.qty = Math.max(0, item.batches.reduce((s, b) => s + b.qty, 0));
    item.updatedDate = new Date().toISOString().slice(0, 10);
    save();
    return item;
  }

  function getFIFO() {
    if (!_db.settings) return true;
    return _db.settings.fifo !== false;
  }

  function setFIFO(enabled) {
    if (!_db.settings) _db.settings = {};
    _db.settings.fifo = !!enabled;
    save();
  }

  function removePantryItem(ingredientName) {
    if (!_db.pantry) return;
    const name = (ingredientName || '').toLowerCase().trim();
    const idx = _db.pantry.findIndex(p => p.ingredient.toLowerCase() === name);
    if (idx < 0) return;
    _db.pantry.splice(idx, 1);
    save();
  }

  function clearPantryPerishables() {
    if (!_db.pantry) return;
    const hasPerishables = _db.pantry.some(p => p.perishable);
    if (!hasPerishables) return;
    const today = new Date().toISOString().slice(0, 10);
    _db.pantry.forEach(p => {
      if (p.perishable) {
        p.qty = 0;
        p.batches = [{ qty: 0, date: today }];
      }
    });
    save();
  }

  function getPantryItem(name) {
    const lower = (name || '').toLowerCase().trim();
    const pantry = _db.pantry || [];
    const exact = pantry.find(p => p.ingredient.toLowerCase() === lower);
    if (exact) return exact;
    return pantry.find(p => p.ingredient.toLowerCase().includes(lower)) || null;
  }

  function getSpendLog()        { return _db.spendLog || []; }

  function logSpend(entry) {
    if (!_db.spendLog) _db.spendLog = [];
    _db.spendLog.push({ date: entry.date, total: entry.total, retailer: entry.retailer || '', items: entry.items });
    save();
  }

  function updateSpendEntry(idx, entry) {
    if (!_db.spendLog || !_db.spendLog[idx]) return;
    _db.spendLog[idx] = entry;
    save();
  }

  function clearSpendLog() {
    _db.spendLog = [];
    save();
  }

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
    if (!_db.deletedRecipeIds.includes(id)) _db.deletedRecipeIds.push(id);
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

  function _normSlotData(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val.filter(Boolean);
    return [val];
  }

  function setMealSlot(week, day, meal, idx, recipeId) {
    const wk = 'week' + week;
    _db.mealPlan[wk] = _db.mealPlan[wk] || {};
    _db.mealPlan[wk][day] = _db.mealPlan[wk][day] || {};
    const current = _normSlotData(_db.mealPlan[wk][day][meal]);
    while (current.length <= idx) current.push('');
    current[idx] = recipeId || '';
    const cleaned = current.filter(Boolean);
    _db.mealPlan[wk][day][meal] = cleaned.length === 0 ? '' : cleaned.length === 1 ? cleaned[0] : cleaned;
    save();
  }

  function addMealSlot(week, day, meal) {
    const wk = 'week' + week;
    _db.mealPlan[wk] = _db.mealPlan[wk] || {};
    _db.mealPlan[wk][day] = _db.mealPlan[wk][day] || {};
    const current = _normSlotData(_db.mealPlan[wk][day][meal]);
    current.push('');
    _db.mealPlan[wk][day][meal] = current.length > 1 ? current : (current[0] || '');
    save();
  }

  function removeMealSlot(week, day, meal, idx) {
    const wk = 'week' + week;
    if (!_db.mealPlan[wk] || !_db.mealPlan[wk][day]) return;
    const current = _normSlotData(_db.mealPlan[wk][day][meal]);
    current.splice(idx, 1);
    const cleaned = current.filter(Boolean);
    _db.mealPlan[wk][day][meal] = cleaned.length === 0 ? '' : cleaned.length === 1 ? cleaned[0] : cleaned;
    save();
  }

  function setShoppingList(items) {
    _db.shoppingList = items;
    save();
  }

  function addShoppingItem(item) {
    if (!_db.shoppingList) _db.shoppingList = [];
    _db.shoppingList.push(item);
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
  function normalizeToBase(qty, unit, gramEquiv) {
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
    if (u === 'clove') return [qty * 5, 'g'];
    if (u === 'dozen') return [qty * 12, 'item'];
    if (['can','packet','loaf','bunch','head'].includes(u) && gramEquiv) return [qty * gramEquiv, 'g'];
    return [qty, 'item'];
  }

  function _pricePerBase(pricePerUnit, pbUnit, gramEquiv) {
    if (pbUnit === 'g')     return [pricePerUnit, 'g'];
    if (pbUnit === '100g')  return [pricePerUnit / 100, 'g'];
    if (pbUnit === 'kg')    return [pricePerUnit / 1000, 'g'];
    if (pbUnit === 'ml')    return [pricePerUnit, 'ml'];
    if (pbUnit === '100ml') return [pricePerUnit / 100, 'ml'];
    if (pbUnit === 'l')     return [pricePerUnit / 1000, 'ml'];
    if (pbUnit === 'tsp')   return [pricePerUnit / 5, 'ml'];
    if (pbUnit === 'tbsp')  return [pricePerUnit / 15, 'ml'];
    if (pbUnit === 'cup')   return [pricePerUnit / 240, 'ml'];
    if (pbUnit === 'clove') return [pricePerUnit / 5, 'g'];
    if (pbUnit === 'dozen') return [pricePerUnit / 12, 'item'];
    if (['can','packet','loaf','bunch','head'].includes(pbUnit) && gramEquiv) return [pricePerUnit / gramEquiv, 'g'];
    return [pricePerUnit, 'item'];
  }

  const STRIP_WORDS = /\b(large|small|medium|big|fresh|frozen|dried|diced|chopped|minced|sliced|ground|grated|boneless|skinless|lean|extra|finely|roughly|thinly|thick)\b/gi;

  function ensurePriceBookEntries(parsedIngredients) {
    if (!_db.priceBook) _db.priceBook = [];
    let added = false;
    (parsedIngredients || []).forEach(item => {
      if (!item.name) return;
      const normalised = item.name.replace(STRIP_WORDS, '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (!normalised) return;
      if (lookupPriceEntry(normalised)) return;
      _db.priceBook.push({ ingredient: normalised, prices: [] });
      added = true;
    });
    if (added) save();
  }

  // ── Price Book CRUD ──────────────────
  function getPriceBook() { return _db.priceBook || []; }

  function setPriceEntry(ingredientName, priceEntry) {
    if (!_db.priceBook) _db.priceBook = [];
    const name = (ingredientName || '').toLowerCase().trim();
    let card = _db.priceBook.find(c => c.ingredient.toLowerCase() === name);
    if (!card) {
      card = { ingredient: name, prices: [] };
      _db.priceBook.push(card);
    }
    const entry = {
      unit: priceEntry.unit,
      pricePerUnit: priceEntry.pricePerUnit,
      retailer: (priceEntry.retailer || '').trim(),
      updatedDate: new Date().toISOString().slice(0, 10),
    };
    if (priceEntry.gramEquiv) entry.gramEquiv = parseFloat(priceEntry.gramEquiv);
    const rowIdx = card.prices.findIndex(
      p => p.unit === entry.unit && p.retailer.toLowerCase() === entry.retailer.toLowerCase()
    );
    if (rowIdx >= 0) card.prices[rowIdx] = entry;
    else card.prices.push(entry);
    save();
  }

  function removePriceEntry(ingredientName, priceIdx) {
    if (!_db.priceBook) return;
    const name = (ingredientName || '').toLowerCase().trim();
    const cardIdx = _db.priceBook.findIndex(c => c.ingredient.toLowerCase() === name);
    if (cardIdx < 0) return;
    const card = _db.priceBook[cardIdx];
    if (priceIdx < 0 || priceIdx >= card.prices.length) return;
    card.prices.splice(priceIdx, 1);
    // Keep the ingredient entry even if it has no prices — they can be added later
    save();
  }

  function syncAllRecipeIngredients() {
    if (typeof Recipes === 'undefined') { App.toast('Recipes module not loaded', 'warn'); return; }
    let count = 0;
    (_db.recipes || []).forEach(r => {
      const parsed = Recipes.parseIngredients(r.ingredients);
      parsed.forEach(ing => {
        if (!ing.name) return;
        const lower = ing.name.toLowerCase().trim();
        if (!lower) return;
        if (!_db.priceBook) _db.priceBook = [];
        const exists = _db.priceBook.some(c => c.ingredient.toLowerCase() === lower);
        if (!exists) { _db.priceBook.push({ ingredient: lower, prices: [] }); count++; }
      });
    });
    save();
    App.toast(count > 0 ? `Added ${count} new ingredient${count !== 1 ? 's' : ''} ✓` : 'All ingredients already in book');
  }

  function addIngredientEntry(name) {
    if (!name) return;
    if (!_db.priceBook) _db.priceBook = [];
    const lower = name.toLowerCase().trim();
    const exists = _db.priceBook.some(c => c.ingredient.toLowerCase() === lower);
    if (!exists) {
      _db.priceBook.push({ ingredient: lower, prices: [] });
      save();
    }
  }

  function removeIngredient(ingredientIdx) {
    if (!_db.priceBook || ingredientIdx < 0 || ingredientIdx >= _db.priceBook.length) return;
    _db.priceBook.splice(ingredientIdx, 1);
    save();
  }

  function lookupPriceEntry(name) {
    const lower = (name || '').toLowerCase().trim();
    const book = _db.priceBook || [];
    const exact = book.find(c => lower === c.ingredient.toLowerCase());
    if (exact) return exact;
    return book.find(c => lower.includes(c.ingredient.toLowerCase())) || null;
  }

  function lookupPrice(name, qty, unit) {
    const card = lookupPriceEntry(name);
    if (!card) return null;
    const parsedQty = parseFloat(qty) || 0;
    if (parsedQty === 0) return 0;
    const [baseQty, baseType] = normalizeToBase(parsedQty, unit || '');
    const compatible = card.prices
      .map(p => _pricePerBase(p.pricePerUnit, p.unit, p.gramEquiv))
      .filter(([, t]) => t === baseType)
      .map(([ppb]) => ppb);
    if (compatible.length === 0) return null;
    const avg = compatible.reduce((a, b) => a + b, 0) / compatible.length;
    return Math.round(baseQty * avg * 100) / 100;
  }

  function toggleShoppingItem(idx) {
    if (_db.shoppingList[idx]) {
      _db.shoppingList[idx].checked = !_db.shoppingList[idx].checked;
      save();
    }
  }

  function updateShoppingItem(idx, fields) {
    if (!_db.shoppingList[idx]) return;
    Object.assign(_db.shoppingList[idx], fields);
    save();
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

      // Step 2: merge recipes from both sides — never let one side silently erase the other.
      // deletedRecipeIds from BOTH devices are combined so a deletion propagates everywhere.
      const deletedIds = new Set([
        ...(_db.deletedRecipeIds || []),
        ...(remote.deletedRecipeIds || []),
      ]);
      const localById = new Map((_db.recipes || []).map(r => [r.id, r]));
      const mergedRecipes = [...localById.values()].filter(r => !deletedIds.has(r.id));
      (remote.recipes || []).forEach(r => {
        if (!localById.has(r.id) && !deletedIds.has(r.id)) mergedRecipes.push(r);
      });

      // Step 3: last-write-wins for all non-recipe fields (mealPlan, shoppingList, etc.)
      const remoteNewer = remote.lastUpdated && (!_db.lastUpdated || remote.lastUpdated > _db.lastUpdated);
      const prevRecipeCount = (_db.recipes || []).length;
      if (remoteNewer) {
        _db = { ..._db, ...remote };
      }
      // Always apply the merged recipe list and combined deletion log
      _db.recipes = mergedRecipes;
      _db.deletedRecipeIds = [...deletedIds];

      // Sync ingredients from all merged recipes into ingredient book
      if (typeof Recipes !== 'undefined') {
        mergedRecipes.forEach(r => {
          ensurePriceBookEntries(Recipes.parseIngredients(r.ingredients));
        });
      }

      save();
      const changed = remoteNewer || mergedRecipes.length !== prevRecipeCount;
      if (changed) App.refresh();

      // Step 4: push merged state to Drive
      await _uploadToDrive(fileId, token);

      App.toast(remoteNewer ? 'Synced — updated from Drive ✓' : 'Synced with Drive ✓');
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

  function getCookLog() {
    return _db.cookLog || [];
  }

  function logCook(entry) {
    if (!_db.cookLog) _db.cookLog = [];
    _db.cookLog.push({
      date: entry.date,
      recipeId: entry.recipeId,
      recipeName: entry.recipeName,
      servings: entry.servings,
      baseServings: entry.baseServings,
    });
    save();
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
    const d = '2026-06-29';
    // retailer field marks entries sourced from live Checkers Sixty60 data
    const flat = [
      // ── Produce (Checkers estimates) ──────────────────────────────
      { ingredient: 'onion',          unit: 'kg',    pricePerUnit: 20    },
      { ingredient: 'garlic',         unit: 'item',  pricePerUnit: 4     },
      { ingredient: 'tomato',         unit: 'kg',    pricePerUnit: 35    },
      { ingredient: 'potato',         unit: 'kg',    pricePerUnit: 22    },
      { ingredient: 'carrot',         unit: 'kg',    pricePerUnit: 22    },
      { ingredient: 'capsicum',       unit: 'kg',    pricePerUnit: 55    },
      { ingredient: 'cucumber',       unit: 'item',  pricePerUnit: 12    },
      { ingredient: 'spinach',        unit: 'kg',    pricePerUnit: 35    },
      { ingredient: 'mushroom',       unit: 'kg',    pricePerUnit: 80    },
      { ingredient: 'broccoli',       unit: 'kg',    pricePerUnit: 50    },
      { ingredient: 'avocado',        unit: 'item',  pricePerUnit: 18    },
      { ingredient: 'lemon',          unit: 'item',  pricePerUnit: 8     },
      { ingredient: 'lime',           unit: 'item',  pricePerUnit: 6     },
      { ingredient: 'banana',         unit: 'kg',    pricePerUnit: 22    },
      { ingredient: 'apple',          unit: 'kg',    pricePerUnit: 38    },
      { ingredient: 'orange',         unit: 'kg',    pricePerUnit: 28    },
      { ingredient: 'ginger',         unit: '100g',  pricePerUnit: 12    },
      { ingredient: 'chilli',         unit: '100g',  pricePerUnit: 15    },
      { ingredient: 'spring onion',   unit: 'item',  pricePerUnit: 6     },
      { ingredient: 'sweet potato',   unit: 'kg',    pricePerUnit: 28    },
      // ── Meat (Checkers Sixty60, 2026-06-29) ───────────────────────
      // Beef mince lean R98.99/kg; champion R129.99/kg
      { ingredient: 'beef mince',     unit: 'kg',    pricePerUnit: 98.99,  retailer: 'Sixty60' },
      // Chicken breast fillets (Farmer's Choice) R84.99/kg; County Fair R59.99/kg
      { ingredient: 'chicken breast', unit: 'kg',    pricePerUnit: 84.99,  retailer: 'Sixty60' },
      // Deboned skinless thighs R124.99/kg; bone-in thighs R99.99/kg
      { ingredient: 'chicken thigh',  unit: 'kg',    pricePerUnit: 99.99,  retailer: 'Sixty60' },
      // Drums & thighs mix R79.99/kg
      { ingredient: 'chicken',        unit: 'kg',    pricePerUnit: 79.99,  retailer: 'Sixty60' },
      // Free-range chicken livers R29.99/250g → R12/100g
      { ingredient: 'chicken livers', unit: '100g',  pricePerUnit: 12.00,  retailer: 'Sixty60' },
      // Pork rashers/loin chops R129.99/kg
      { ingredient: 'pork',           unit: 'kg',    pricePerUnit: 129.99, retailer: 'Sixty60' },
      // Lamb braai chops / knuckle R189.99/kg
      { ingredient: 'lamb',           unit: 'kg',    pricePerUnit: 189.99, retailer: 'Sixty60' },
      // Rump steak R219.99/kg
      { ingredient: 'rump steak',     unit: 'kg',    pricePerUnit: 219.99, retailer: 'Sixty60' },
      // Stewing beef R129.99/kg
      { ingredient: 'stewing beef',   unit: 'kg',    pricePerUnit: 129.99, retailer: 'Sixty60' },
      { ingredient: 'beef fillet',    unit: 'kg',    pricePerUnit: 420    },
      // Farmer's Deli back bacon R44.99/200g → R22.50/100g
      { ingredient: 'bacon',          unit: '100g',  pricePerUnit: 22.50,  retailer: 'Sixty60' },
      // Pork bangers R89.99/kg; beef bangers R89.99/kg
      { ingredient: 'sausage',        unit: 'kg',    pricePerUnit: 89.99,  retailer: 'Sixty60' },
      // Championship boerewors R119.99/kg
      { ingredient: 'boerewors',      unit: 'kg',    pricePerUnit: 119.99, retailer: 'Sixty60' },
      { ingredient: 'salmon',         unit: 'kg',    pricePerUnit: 280    },
      { ingredient: 'tuna',           unit: '100g',  pricePerUnit: 15     },
      // ── Dairy (Checkers Sixty60, 2026-06-29) ──────────────────────
      { ingredient: 'milk',           unit: 'l',     pricePerUnit: 22.99  },
      // Fair Cape fresh cream R25.99/250ml → R10.40/100ml
      { ingredient: 'cream',          unit: '100ml', pricePerUnit: 10.40,  retailer: 'Sixty60' },
      // Lurpak 200g R79.99 → R40/100g (mid: use R35 to cover cheaper brands too)
      { ingredient: 'butter',         unit: '100g',  pricePerUnit: 35.00,  retailer: 'Sixty60' },
      { ingredient: 'cheddar',        unit: '100g',  pricePerUnit: 28     },
      // Leeuwenbosch feta 200g R39.99 → R20/100g
      { ingredient: 'feta',           unit: '100g',  pricePerUnit: 20.00,  retailer: 'Sixty60' },
      { ingredient: 'mozzarella',     unit: '100g',  pricePerUnit: 25     },
      { ingredient: 'parmesan',       unit: '100g',  pricePerUnit: 55     },
      // LANCEWOOD cream cheese 250g R94.99 → R38/100g
      { ingredient: 'cream cheese',   unit: '100g',  pricePerUnit: 38.00,  retailer: 'Sixty60' },
      // Ricotta 250g R44.99 → R18/100g
      { ingredient: 'ricotta',        unit: '100g',  pricePerUnit: 18.00,  retailer: 'Sixty60' },
      // LANCEWOOD buttermilk 500ml R21.99 → R4.40/100ml
      { ingredient: 'buttermilk',     unit: '100ml', pricePerUnit: 4.40,   retailer: 'Sixty60' },
      { ingredient: 'yogurt',         unit: 'kg',    pricePerUnit: 65     },
      // Nulaid Large eggs 6-pack R24.99 → R4.17/egg
      { ingredient: 'egg',            unit: 'item',  pricePerUnit: 4.17,   retailer: 'Sixty60' },
      { ingredient: 'sour cream',     unit: '100g',  pricePerUnit: 12     },
      // ── Pantry (Checkers estimates) ───────────────────────────────
      { ingredient: 'olive oil',      unit: '100ml', pricePerUnit: 18     },
      { ingredient: 'sunflower oil',  unit: 'l',     pricePerUnit: 25     },
      { ingredient: 'coconut oil',    unit: '100ml', pricePerUnit: 22     },
      { ingredient: 'flour',          unit: 'kg',    pricePerUnit: 16     },
      { ingredient: 'sugar',          unit: 'kg',    pricePerUnit: 18     },
      { ingredient: 'rice',           unit: 'kg',    pricePerUnit: 18     },
      { ingredient: 'pasta',          unit: 'kg',    pricePerUnit: 28     },
      { ingredient: 'spaghetti',      unit: 'kg',    pricePerUnit: 28     },
      { ingredient: 'oats',           unit: 'kg',    pricePerUnit: 38     },
      { ingredient: 'bread',          unit: 'item',  pricePerUnit: 22     },
      { ingredient: 'honey',          unit: '100g',  pricePerUnit: 16     },
      { ingredient: 'soy sauce',      unit: '100ml', pricePerUnit: 12     },
      { ingredient: 'tomato paste',   unit: '100g',  pricePerUnit: 10     },
      { ingredient: 'tinned tomato',  unit: '100g',  pricePerUnit: 5      },
      { ingredient: 'coconut milk',   unit: '100ml', pricePerUnit: 8      },
      { ingredient: 'stock',          unit: 'item',  pricePerUnit: 8      },
      { ingredient: 'vinegar',        unit: '100ml', pricePerUnit: 4      },
      // ── Spices (Checkers estimates) ───────────────────────────────
      { ingredient: 'cumin',          unit: '100g',  pricePerUnit: 38     },
      { ingredient: 'paprika',        unit: '100g',  pricePerUnit: 32     },
      { ingredient: 'turmeric',       unit: '100g',  pricePerUnit: 30     },
      { ingredient: 'cinnamon',       unit: '100g',  pricePerUnit: 35     },
      { ingredient: 'curry powder',   unit: '100g',  pricePerUnit: 42     },
      { ingredient: 'garam masala',   unit: '100g',  pricePerUnit: 45     },
      { ingredient: 'black pepper',   unit: '100g',  pricePerUnit: 42     },
      { ingredient: 'cayenne',        unit: '100g',  pricePerUnit: 38     },
      { ingredient: 'oregano',        unit: '100g',  pricePerUnit: 32     },
      { ingredient: 'thyme',          unit: '100g',  pricePerUnit: 32     },
    ];
    _db.priceBook = flat.map(f => ({
      ingredient: f.ingredient.toLowerCase().trim(),
      prices: [{ unit: f.unit, pricePerUnit: f.pricePerUnit, retailer: f.retailer || '', updatedDate: d }],
    }));
    save();
  }

  return {
    load, save, getRecipes, getPlan, getPantry, getShoppingList,
    addRecipe, updateRecipe, deleteRecipe, getRecipeById,
    setMealSlot, addMealSlot, removeMealSlot, setShoppingList, addShoppingItem, setTreats, setRecipeCalories, toggleShoppingItem, updateShoppingItem,
    isDriveConnected, connectDrive, disconnectDrive, syncDrive,
    exportJSON, importJSON, handleImportFile, clearAll,
    loadStarterData, loadStarterPrices, getClientId, setClientId,
    getPriceBook, setPriceEntry, removePriceEntry, addIngredientEntry, removeIngredient,
    lookupPriceEntry, lookupPrice, ensurePriceBookEntries, syncAllRecipeIngredients,
    setPantryItem, addPantryBatch, deductPantryFIFO, getFIFO, setFIFO,
    removePantryItem, clearPantryPerishables, getPantryItem,
    getSpendLog, logSpend, clearSpendLog, updateSpendEntry,
    getCookLog, logCook,
    normalizeToBase,
    DAYS, MEALS,
  };
})();
