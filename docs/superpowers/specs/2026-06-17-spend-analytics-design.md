# Spend Analytics Design Spec

## Goal

Add spend tracking and analytics to the recipe book PWA. Users can log what they spent on each shop (from the shopping list) and view weekly/monthly summaries with category breakdowns.

---

## Data Model

### `_db.spendLog` (new, default `[]`)

```js
spendLog: [
  {
    date: '2026-06-17',       // ISO date string YYYY-MM-DD
    total: 487.50,             // sum of all item costs (R)
    items: [                   // snapshot of priced items at time of logging
      { name: 'beef mince', qty: 1,   unit: 'kg',   cost: 140.00 },
      { name: 'onion',       qty: 2,   unit: 'kg',   cost:  40.00 },
    ]
  }
]
```

Each entry is one shop trip. `total` equals the sum of all `items[].cost` values. Items with no price are excluded.

---

## Data API (`js/data.js`)

Three new functions added to the `Data` IIFE and exported:

| Function | Signature | Behaviour |
|---|---|---|
| `getSpendLog()` | `()` | Returns `_db.spendLog \|\| []` |
| `logSpend(entry)` | `({date, total, items})` | Pushes entry to `_db.spendLog`, calls `save()` |
| `clearSpendLog()` | `()` | Sets `_db.spendLog = []`, calls `save()` |

Also ensure `_db` default shape includes `spendLog: []` (add to the initial `_db` object if not present, and guard in `load()` to initialise if missing).

---

## "Complete Shop" button (`js/shopping.js`)

### Button placement

Add to `#view-shopping .section-header-actions` in `index.html`:
```html
<button class="btn-small" onclick="Shopping.openCompleteShop()">Complete Shop</button>
```
Place it between "Log Purchase" and "Clear checked".

### `openCompleteShop()`

1. Gets ALL shopping list items (checked AND unchecked)
2. For each item calls `Data.lookupPrice(item.name, item.qty, item.unit)` to get cost
3. Filters to items where `cost != null && cost > 0`
4. If no items have cost: `App.toast('No prices set — add prices to the Price Book first', 'warn')` and return
5. Builds `entry`:
   - `date`: `new Date().toISOString().slice(0, 10)`
   - `items`: filtered items mapped to `{ name: item.name, qty: item.qty, unit: item.unit, cost }`
   - `total`: `Math.round(sum * 100) / 100`
6. Shows modal:
   - Title: "Complete Shop"
   - Each item as: `"beef mince × 1 kg — R140.00"`
   - Total line: `"Total: R487.50"`
   - Cancel and "Log Spend & Clear List" buttons → calls `Shopping.confirmCompleteShop()`
7. Stores the prepared `entry` in module-level `_pendingSpend`

### `confirmCompleteShop()`

1. Calls `Data.logSpend(_pendingSpend)`
2. Calls `Shopping.clearChecked()` (removes all checked items from list — unchecked remain)
3. Calls `App.closeModal()`
4. `App.toast('Shop logged ✓')`
5. Calls `render()`

---

## Analytics View (`js/analytics.js`)

New IIFE module `const Analytics = (() => { ... })()`.

### Date helpers (module-private)

```js
function _today() { return new Date().toISOString().slice(0, 10); }

function _startOfWeek(dateStr) {
  // Returns the Monday of the week containing dateStr
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = (day === 0 ? -6 : 1 - day);
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  return mon.toISOString().slice(0, 10);
}

function _fmtDate(dateStr) {
  // Returns "17 Jun"
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const parts = dateStr.split('-');
  return parseInt(parts[2], 10) + ' ' + months[parseInt(parts[1], 10) - 1];
}

function _fmtMonth(dateStr) {
  // Returns "Jun 2026"
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const parts = dateStr.split('-');
  return months[parseInt(parts[1], 10) - 1] + ' ' + parts[0];
}
```

### Category mapping (module-level constant)

```js
const CATEGORIES = [
  { name: 'Protein',    keywords: ['beef','chicken','pork','lamb','fish','egg','mince','sausage','bacon','tuna'] },
  { name: 'Dairy',      keywords: ['milk','cheese','yogurt','butter','cream','yoghurt'] },
  { name: 'Vegetables', keywords: ['onion','carrot','potato','tomato','lettuce','spinach','garlic','broccoli','pepper','celery','cabbage'] },
  { name: 'Fruit',      keywords: ['apple','banana','orange','lemon','grape','strawberry','avocado'] },
  { name: 'Grains',     keywords: ['bread','rice','pasta','flour','oat','cereal','noodle'] },
  { name: 'Pantry',     keywords: ['oil','sugar','salt','sauce','vinegar','spice','herb','stock','tin','can'] },
];

function _guessCategory(name) {
  const lower = (name || '').toLowerCase();
  for (const cat of CATEGORIES) {
    if (cat.keywords.some(k => lower.includes(k))) return cat.name;
  }
  return 'Other';
}
```

### `render()`

Renders the complete analytics view into `#analytics-content`.

**Structure:**

```html
<div id="analytics-content">
  <!-- Summary cards -->
  <div class="analytics-summary">
    <div class="analytics-card">
      <div class="analytics-card-label">This week</div>
      <div class="analytics-card-value">R XXX.XX</div>
    </div>
    <div class="analytics-card">
      <div class="analytics-card-label">This month</div>
      <div class="analytics-card-value">R X,XXX.XX</div>
    </div>
    <div class="analytics-card">
      <div class="analytics-card-label">All time</div>
      <div class="analytics-card-value">R X,XXX.XX</div>
    </div>
  </div>

  <!-- Monthly breakdown (last 6 months) -->
  <div class="analytics-section-title">Monthly Spend</div>
  [bar rows]

  <!-- Category breakdown (current month) -->
  <div class="analytics-section-title">This Month by Category</div>
  [bar rows]

  <!-- Recent shops -->
  <div class="analytics-section-title">Recent Shops</div>
  [shop rows, last 5, newest first]

  <!-- Clear button -->
  <button class="btn-danger" style="margin-top:24px" onclick="Analytics.clearLog()">🗑 Clear Spend Log</button>
</div>
```

If `spendLog` is empty, show:
```html
<div class="empty-state"><span class="emoji">📊</span>No spend data yet. Use "Complete Shop" on the shopping list to log your first shop.</div>
```

**Summary logic:**
- "This week": sum of `total` for entries where `entry.date >= _startOfWeek(_today())`
- "This month": sum for entries where `entry.date.slice(0, 7) === _today().slice(0, 7)`
- "All time": sum of all entries

**Monthly bar chart:**
- Build last 6 month keys: `['2026-06', '2026-05', ...]` going back 6 months from today
- Sum entry totals per month key (`entry.date.slice(0, 7)`)
- Max value = highest monthly total (if 0, skip chart or show empty bars)
- Each bar: `width: ${(monthTotal / maxTotal * 100).toFixed(1)}%`
- Label format: `_fmtMonth(monthKey + '-01')`

**Category bar chart (current month):**
- Filter entries to current month
- For each item in those entries, call `_guessCategory(item.name)` and accumulate `item.cost`
- Sort categories descending by spend
- Show only categories with spend > 0
- Same bar width calculation relative to max category spend

**Recent shops (last 5):**
- Take last 5 entries from `spendLog` (sorted newest first — slice from end)
- Each row is expandable: clicking the header toggles `.analytics-shop-detail.open`
- Header: date formatted as "17 Jun" + total formatted as "R487.50"
- Detail: list of items in the shop as "beef mince × 1 kg — R140.00"
- Toggle implemented with inline `onclick` that uses `classList.toggle`

### `clearLog()`

```js
function clearLog() {
  if (!confirm('Clear all spend history?')) return;
  Data.clearSpendLog();
  render();
  App.toast('Spend log cleared');
}
```

### Public API

```js
return { render, clearLog };
```

---

## HTML View (`index.html`)

### New `#view-analytics` section (before `</main>`)

```html
<!-- ANALYTICS -->
<section id="view-analytics" class="view">
  <div class="section-header">
    <h2>Spend Analytics</h2>
  </div>
  <div id="analytics-content"></div>
</section>
```

### Script tag (before `js/app.js`)

```html
<script src="js/analytics.js"></script>
```

### Settings navigation

Add after the Pantry settings group:

```html
<div class="settings-group">
  <h3>Spend Analytics</h3>
  <p class="hint">Track your grocery spend over time with weekly and monthly breakdowns.</p>
  <button class="btn-secondary" onclick="App.pushView('analytics','Spend Analytics'); Analytics.render()">View Analytics →</button>
</div>
```

### "Complete Shop" button in shopping list header

Add between "Log Purchase" and "Clear checked":
```html
<button class="btn-small" onclick="Shopping.openCompleteShop()">Complete Shop</button>
```

---

## CSS (`css/style.css`)

Append at end of file:

```css
/* ── Analytics view ────────────────────────────────────── */
.analytics-summary { display:flex; gap:12px; margin-bottom:24px; flex-wrap:wrap; }
.analytics-card { flex:1; min-width:120px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:16px; text-align:center; }
.analytics-card-label { font-size:0.75rem; color:var(--text-muted); margin-bottom:4px; }
.analytics-card-value { font-size:1.4rem; font-weight:700; color:var(--dk-green); }
.analytics-section-title { font-weight:700; margin:20px 0 10px; }
.analytics-bar-row { display:flex; align-items:center; gap:10px; margin-bottom:8px; font-size:0.85rem; }
.analytics-bar-label { width:90px; flex-shrink:0; }
.analytics-bar-track { flex:1; background:var(--border); border-radius:4px; height:14px; overflow:hidden; }
.analytics-bar-fill { height:100%; background:var(--md-green); border-radius:4px; transition:width 0.3s; }
.analytics-bar-amount { width:70px; text-align:right; flex-shrink:0; }
.analytics-shop-row { border-bottom:1px solid var(--border); padding:12px 0; }
.analytics-shop-header { display:flex; justify-content:space-between; align-items:center; cursor:pointer; }
.analytics-shop-date { font-weight:600; }
.analytics-shop-total { color:var(--dk-green); font-weight:700; }
.analytics-shop-detail { font-size:0.82rem; color:var(--text-muted); padding:8px 0 0; display:none; }
.analytics-shop-detail.open { display:block; }
```

---

## Files Changed

| File | Change |
|---|---|
| `js/data.js` | Add `getSpendLog`, `logSpend`, `clearSpendLog`; add `spendLog: []` to `_db` default + `load()` guard |
| `js/shopping.js` | Add `openCompleteShop`, `confirmCompleteShop`, `_pendingSpend`; export both |
| `js/analytics.js` | New IIFE module (create from scratch) |
| `index.html` | Add `#view-analytics`, script tag, settings group, "Complete Shop" button in shopping header |
| `css/style.css` | Append analytics styles |
