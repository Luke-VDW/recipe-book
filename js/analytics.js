/* ══════════════════════════════════════
   analytics.js — Spend analytics view
   ══════════════════════════════════════ */

const Analytics = (() => {

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

  function _today() { return new Date().toISOString().slice(0, 10); }

  function _startOfWeek(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const mon = new Date(d);
    mon.setDate(d.getDate() + diff);
    return mon.toISOString().slice(0, 10);
  }

  function _fmtDate(dateStr) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const p = dateStr.split('-');
    return parseInt(p[2], 10) + ' ' + months[parseInt(p[1], 10) - 1];
  }

  function _fmtMonth(dateStr) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const p = dateStr.split('-');
    return months[parseInt(p[1], 10) - 1] + ' ' + p[0];
  }

  function _fmtR(n) {
    return 'R ' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function _esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _bar(label, value, maxValue, amount) {
    const pct = maxValue > 0 ? (value / maxValue * 100).toFixed(1) : 0;
    return `
      <div class="analytics-bar-row">
        <span class="analytics-bar-label">${label}</span>
        <div class="analytics-bar-track">
          <div class="analytics-bar-fill" style="width:${pct}%"></div>
        </div>
        <span class="analytics-bar-amount">${_fmtR(amount)}</span>
      </div>`;
  }

  function render() {
    const el = document.getElementById('analytics-content');
    if (!el) return;
    const log = Data.getSpendLog();

    if (log.length === 0) {
      el.innerHTML = `<div class="empty-state"><span class="emoji">📊</span>No spend data yet.<br>Use "Confirm Shop" on the shopping list to log your first shop.</div>`;
      return;
    }

    const today = _today();
    const weekStart = _startOfWeek(today);
    const monthKey = today.slice(0, 7);

    const thisWeek  = log.filter(e => e.date >= weekStart).reduce((s, e) => s + e.total, 0);
    const thisMonth = log.filter(e => e.date.slice(0,7) === monthKey).reduce((s, e) => s + e.total, 0);
    const allTime   = log.reduce((s, e) => s + e.total, 0);

    // ── Summary cards ──────────────────────────────
    const summaryHtml = `
      <div class="analytics-summary">
        <div class="analytics-card">
          <div class="analytics-card-label">This week</div>
          <div class="analytics-card-value">${_fmtR(thisWeek)}</div>
        </div>
        <div class="analytics-card">
          <div class="analytics-card-label">This month</div>
          <div class="analytics-card-value">${_fmtR(thisMonth)}</div>
        </div>
        <div class="analytics-card">
          <div class="analytics-card-label">All time</div>
          <div class="analytics-card-value">${_fmtR(allTime)}</div>
        </div>
      </div>`;

    // ── Monthly bar chart (last 6 months) ──────────
    const monthlyTotals = {};
    const todayDate = new Date(today + 'T00:00:00');
    const monthKeys = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(todayDate.getFullYear(), todayDate.getMonth() - i, 1);
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      monthKeys.push(key);
      monthlyTotals[key] = 0;
    }
    log.forEach(e => {
      const k = e.date.slice(0, 7);
      if (k in monthlyTotals) monthlyTotals[k] += e.total;
    });
    const maxMonthly = Math.max(...Object.values(monthlyTotals), 1);
    const monthlyHtml = monthKeys.map(k =>
      _bar(_fmtMonth(k + '-01'), monthlyTotals[k], maxMonthly, monthlyTotals[k])
    ).join('');

    // ── Category breakdown (current month) ─────────
    const catTotals = {};
    log.filter(e => e.date.slice(0, 7) === monthKey).forEach(e => {
      (e.items || []).forEach(item => {
        const cat = _guessCategory(item.name);
        catTotals[cat] = (catTotals[cat] || 0) + item.cost;
      });
    });
    const catEntries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
    const maxCat = catEntries.length > 0 ? catEntries[0][1] : 1;
    const catHtml = catEntries.length > 0
      ? catEntries.map(([cat, total]) => _bar(cat, total, maxCat, total)).join('')
      : `<p style="color:var(--text-muted);font-size:0.85rem">No category data for this month.</p>`;

    // ── Recent shops (last 5, newest first) ────────
    const recentShops = log.map((entry, i) => ({ ...entry, _realIdx: i })).reverse().slice(0, 5);
    const shopsHtml = recentShops.map((entry) => {
      const retailerTag = entry.retailer
        ? `<span class="analytics-shop-retailer">${_esc(entry.retailer)}</span>` : '';
      const detailRows = (entry.items || []).map(item => {
        const estBadge = item.estimated ? `<span class="shop-est-badge">~est</span>` : '';
        return `<div>${_esc(item.name)} × ${item.qty || ''} ${_esc(item.unit || '')} — ${_fmtR(item.cost)} ${estBadge}</div>`;
      }).join('');
      return `
        <div class="analytics-shop-row">
          <div class="analytics-shop-header">
            <span class="analytics-shop-date" style="cursor:pointer" onclick="this.closest('.analytics-shop-row').querySelector('.analytics-shop-detail').classList.toggle('open')">${_fmtDate(entry.date)}${retailerTag}</span>
            <span class="analytics-shop-total">${_fmtR(entry.total)}</span>
            <button class="btn-mini" onclick="event.stopPropagation();Analytics.editSpendEntry(${entry._realIdx})">Edit</button>
          </div>
          <div class="analytics-shop-detail">${detailRows}</div>
        </div>`;
    }).join('');

    el.innerHTML = summaryHtml
      + `<div class="analytics-section-title">Monthly Spend</div>${monthlyHtml}`
      + `<div class="analytics-section-title">This Month by Category</div>${catHtml}`
      + `<div class="analytics-section-title">Recent Shops</div>${shopsHtml}`
      + `<button class="btn-danger" style="margin-top:24px;width:100%" onclick="Analytics.clearLog()">🗑 Clear Spend Log</button>`;
  }

  function clearLog() {
    if (!confirm('Clear all spend history? This cannot be undone.')) return;
    Data.clearSpendLog();
    render();
    App.toast('Spend log cleared');
  }

  function editSpendEntry(realIdx) {
    const log = Data.getSpendLog();
    const entry = log[realIdx];
    if (!entry) return;

    const itemRows = (entry.items || []).map((item, i) => {
      const estBadge = item.estimated ? `<span class="shop-est-badge">~est</span>` : '';
      return `<div class="confirm-item-row" style="align-items:center">
        <span class="confirm-item-name">${_esc(item.name)} ${estBadge}</span>
        <span style="font-size:0.8rem;color:var(--text-muted)">${item.qty || ''} ${_esc(item.unit || '')}</span>
        <label style="display:flex;align-items:center;gap:4px;font-size:0.85rem">R
          <input type="number" id="edit-item-cost-${i}" step="0.01" min="0"
            value="${item.cost != null ? item.cost.toFixed(2) : ''}"
            style="width:70px;padding:3px 6px;border:1px solid var(--border);border-radius:6px;font-size:0.85rem" />
        </label>
      </div>`;
    }).join('');

    document.getElementById('modal-content').innerHTML = `
      <h3>Edit Shop — ${_fmtDate(entry.date)}</h3>
      <div class="form-group">
        <label>Store</label>
        <input type="text" id="edit-retailer" value="${_esc(entry.retailer || '')}" maxlength="30" />
      </div>
      ${itemRows}
      <div class="form-group" style="margin-top:8px">
        <label>Override total (optional — leave blank to use sum of items)</label>
        <input type="number" id="edit-total-override" step="0.01" min="0"
          value="${entry.total != null ? entry.total.toFixed(2) : ''}" />
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="App.closeModal()">Cancel</button>
        <button class="btn-primary" onclick="Analytics.saveSpendEntry(${realIdx})">Save</button>
      </div>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
  }

  function saveSpendEntry(realIdx) {
    const log = Data.getSpendLog();
    const entry = log[realIdx];
    if (!entry) return;

    const retailer = (document.getElementById('edit-retailer')?.value || '').trim();
    const overrideRaw = parseFloat(document.getElementById('edit-total-override')?.value);

    const updatedItems = (entry.items || []).map((item, i) => {
      const newCost = parseFloat(document.getElementById(`edit-item-cost-${i}`)?.value);
      if (!isNaN(newCost) && newCost >= 0 && newCost !== item.cost) {
        if (item.estimated && item.qty) {
          Data.setPriceEntry(item.name.toLowerCase().trim(), {
            unit: item.unit || 'item',
            pricePerUnit: newCost / item.qty,
            retailer,
          });
        }
        return { ...item, cost: newCost, estimated: false };
      }
      return item;
    });

    const sumTotal = updatedItems.reduce((s, i) => s + (i.cost || 0), 0);
    const finalTotal = (!isNaN(overrideRaw) && overrideRaw >= 0) ? overrideRaw : sumTotal;

    Data.updateSpendEntry(realIdx, { ...entry, total: finalTotal, retailer, items: updatedItems });

    App.closeModal();
    render();
    App.toast('Shop updated ✓');
  }

  return { render, clearLog, editSpendEntry, saveSpendEntry };
})();
