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
      el.innerHTML = `<div class="empty-state"><span class="emoji">📊</span>No spend data yet.<br>Use "Complete Shop" on the shopping list to log your first shop.</div>`;
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
    const recentShops = log.slice().reverse().slice(0, 5);
    const shopsHtml = recentShops.map((entry) => {
      const detailRows = (entry.items || []).map(item =>
        `<div>${item.name} × ${item.qty} ${item.unit} — ${_fmtR(item.cost)}</div>`
      ).join('');
      return `
        <div class="analytics-shop-row">
          <div class="analytics-shop-header" onclick="this.nextElementSibling.classList.toggle('open')">
            <span class="analytics-shop-date">${_fmtDate(entry.date)}</span>
            <span class="analytics-shop-total">${_fmtR(entry.total)}</span>
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

  return { render, clearLog };
})();
