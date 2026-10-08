(function () {
  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => [...(el || document).querySelectorAll(sel)];

  let charts = {};

  // Theme
  function initTheme() {
    const saved = store.getSetting('theme') || 'light';
    applyTheme(saved);
  }
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    store.setSetting('theme', t);
    $('#theme-toggle').innerHTML = t === 'dark' ? '&#9788;' : '&#9790;';
    Object.values(charts).forEach(c => { if (c) c.destroy(); });
    charts = {};
    if ($('.view.active')) renderCurrentView();
  }
  function toggleTheme() {
    applyTheme(store.getSetting('theme') === 'dark' ? 'light' : 'dark');
  }

  // Toast
  function toast(msg, type = 'success') {
    const c = $('#toast-container');
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
  }

  // Navigation
  function navigate(viewId) {
    $$('.view').forEach(v => v.classList.remove('active'));
    $$('.nav-link').forEach(l => l.classList.remove('active'));
    const view = $('#view-' + viewId);
    const link = $(`.nav-link[data-view="${viewId}"]`);
    if (view) view.classList.add('active');
    if (link) link.classList.add('active');
    closeSidebar();
    renderCurrentView();
  }

  function renderCurrentView() {
    const active = $('.view.active');
    if (!active) return;
    const id = active.id.replace('view-', '');
    switch (id) {
      case 'dashboard': renderDashboard(); break;
      case 'transactions': renderTransactions(); break;
      case 'budgets': renderBudgets(); break;
      case 'goals': renderGoals(); break;
      case 'reports': renderReports(); break;
      case 'simulator': break;
    }
  }

  // Mobile sidebar
  function closeSidebar() {
    $('#sidebar').classList.remove('open');
    $('#sidebar-overlay').classList.remove('show');
  }

  // Modal helpers
  function openModal(id) { $('#' + id).classList.add('active'); }
  function closeModal(id) { $('#' + id).classList.remove('active'); }

  // Chart helper
  function getChartColors() {
    const isDark = store.getSetting('theme') === 'dark';
    return {
      gridColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      tickColor: isDark ? '#94a3b8' : '#64748b',
      tooltipBg: isDark ? '#1e293b' : '#ffffff',
      tooltipText: isDark ? '#f1f5f9' : '#1e293b'
    };
  }

  function makeChart(canvasId, config) {
    if (charts[canvasId]) charts[canvasId].destroy();
    const canvas = $('#' + canvasId);
    if (!canvas) return null;
    const c = getChartColors();
    const defaults = {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { labels: { color: c.tickColor, font: { family: 'Inter', size: 12 } } },
        tooltip: {
          backgroundColor: c.tooltipBg, titleColor: c.tooltipText, bodyColor: c.tooltipText,
          borderColor: c.gridColor, borderWidth: 1, cornerRadius: 10, padding: 12,
          titleFont: { family: 'Inter', weight: '600' }, bodyFont: { family: 'Inter' }
        }
      }
    };
    if (config.options) {
      config.options.plugins = Object.assign({}, defaults.plugins, config.options.plugins || {});
      if (config.options.scales) {
        for (const axis of Object.values(config.options.scales)) {
          axis.grid = Object.assign({ color: c.gridColor }, axis.grid || {});
          axis.ticks = Object.assign({ color: c.tickColor, font: { family: 'Inter' } }, axis.ticks || {});
        }
      }
    } else {
      config.options = defaults;
    }
    config.options.responsive = true;
    config.options.maintainAspectRatio = true;
    charts[canvasId] = new Chart(canvas, config);
    return charts[canvasId];
  }

  // Dashboard
  function renderDashboard() {
    const now = new Date();
    const hour = now.getHours();
    const greetText = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    $('#dash-greeting').textContent = greetText;

    const currentMonth = ym();
    const prevMonth = store.getPrevMonth(currentMonth);
    const totals = store.getMonthlyTotals(currentMonth);
    const prev = store.getMonthlyTotals(prevMonth);
    const balance = store.getAllTimeBalance();

    const hasData = store.transactions.length > 0;
    const sc = $('#summary-cards');
    sc.innerHTML = buildStatCard('Total Income', totals.income, 'income', hasData ? store.getMonthChange(totals.income, prev.income) : null)
      + buildStatCard('Total Expenses', totals.expenses, 'expense', hasData ? store.getMonthChange(totals.expenses, prev.expenses) : null, true)
      + buildStatCard('Net Savings', totals.savings, 'savings', hasData ? store.getMonthChange(totals.savings, prev.savings) : null)
      + buildStatCard('Balance', balance, 'balance', null);

    renderHealthScore(currentMonth);
    renderInsights(currentMonth);
    renderAchievements();
    renderDashboardCharts(currentMonth);
    renderCashFlow();
    renderRecentTransactions();
  }

  function buildStatCard(label, value, type, change, invertChange) {
    let changeHtml = '';
    if (change !== null && change !== undefined && !isNaN(change)) {
      let dir = change >= 0 ? 'up' : 'down';
      if (invertChange) dir = change >= 0 ? 'down' : 'up';
      const arrow = change >= 0 ? '&#9650;' : '&#9660;';
      changeHtml = `<div class="stat-change ${dir}">${arrow} ${Math.abs(change).toFixed(1)}%</div>`;
    }
    return `<div class="stat-card ${type}">
      <div class="stat-label">${label}</div>
      <div class="stat-value">&#8377;${fmt(value)}</div>
      ${changeHtml}
    </div>`;
  }

  function renderHealthScore(month) {
    const section = $('#health-section');
    const health = store.getFinancialHealth(month);
    if (!health) { section.innerHTML = ''; return; }
    const pct = health.total;
    const circumference = 2 * Math.PI * 50;
    const offset = circumference - (pct / 100) * circumference;
    const color = pct >= 80 ? '#10b981' : pct >= 60 ? '#3b82f6' : pct >= 40 ? '#f59e0b' : '#ef4444';
    const b = health.breakdown;

    section.innerHTML = `<div class="health-card">
      <div class="health-ring">
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border)" stroke-width="8"/>
          <circle cx="60" cy="60" r="50" fill="none" stroke="${color}" stroke-width="8"
            stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" stroke-linecap="round"/>
        </svg>
        <div class="health-ring-text">
          <div class="health-score-num" style="color:${color}">${pct}</div>
          <div class="health-score-label">${health.label}</div>
        </div>
      </div>
      <div class="health-details">
        <div class="health-title">Financial Health Score</div>
        <div class="health-bars">
          ${healthBar('Budgeting', b.budgeting, 25, '#6366f1')}
          ${healthBar('Saving', b.saving, 25, '#10b981')}
          ${healthBar('Spending', b.spending, 25, '#f59e0b')}
          ${healthBar('Consistency', b.consistency, 25, '#3b82f6')}
        </div>
      </div>
    </div>`;
  }

  function healthBar(label, score, max, color) {
    const pct = (score / max) * 100;
    return `<div class="health-bar-item">
      <div class="health-bar-label"><span>${label}</span><span>${score}/${max}</span></div>
      <div class="health-bar"><div class="health-bar-fill" style="width:${pct}%;background:${color}"></div></div>
    </div>`;
  }

  function renderInsights(month) {
    const section = $('#insights-section');
    const insights = store.getInsights(month);
    if (insights.length === 0) { section.innerHTML = ''; return; }
    section.innerHTML = `<div class="insights-card">
      <div class="insights-title">&#128161; Money Insights</div>
      ${insights.map(i => `<div class="insight-item ${i.type || 'info'}">
        <div class="insight-icon">${i.icon}</div>
        <div class="insight-text">${i.text}</div>
      </div>`).join('')}
    </div>`;
  }

  function renderAchievements() {
    const section = $('#achievements-section');
    const list = store.getAchievementsList();
    if (list.length === 0) { section.innerHTML = ''; return; }
    section.innerHTML = `<div class="section-title">&#127942; Achievements</div>
      <div class="achievements-grid">
        ${list.map(a => `<div class="achievement">
          <div class="achievement-icon">${a.icon}</div>
          <div class="achievement-name">${a.name}</div>
          <div class="achievement-desc">${a.desc}</div>
        </div>`).join('')}
      </div>`;
  }

  function renderDashboardCharts(month) {
    const months = store.getLast6Months();
    const incomeData = months.map(m => store.getMonthlyTotals(m).income);
    const expenseData = months.map(m => store.getMonthlyTotals(m).expenses);
    const labels = months.map(m => {
      const d = new Date(m + '-01');
      return d.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
    });

    makeChart('chart-income-expense', {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Income', data: incomeData, backgroundColor: '#10b981', borderRadius: 6, barPercentage: 0.5 },
          { label: 'Expenses', data: expenseData, backgroundColor: '#ef4444', borderRadius: 6, barPercentage: 0.5 }
        ]
      },
      options: {
        scales: {
          y: { beginAtZero: true, ticks: { callback: v => '₹' + fmt(v) } },
          x: {}
        },
        plugins: { legend: { position: 'top' } }
      }
    });

    const breakdown = store.getCategoryBreakdown(month, 'expense');
    const catEntries = Object.entries(breakdown).sort(([, a], [, b]) => b - a).slice(0, 8);
    if (catEntries.length > 0) {
      makeChart('chart-categories', {
        type: 'doughnut',
        data: {
          labels: catEntries.map(([c]) => c),
          datasets: [{ data: catEntries.map(([, v]) => v), backgroundColor: catEntries.map(([c]) => CATEGORY_COLORS[c] || '#6366f1'), borderWidth: 0 }]
        },
        options: {
          cutout: '65%',
          plugins: {
            legend: { position: 'right', labels: { padding: 12, usePointStyle: true, pointStyle: 'circle' } },
            tooltip: { callbacks: { label: ctx => ctx.label + ': ₹' + fmt(ctx.raw) } }
          }
        }
      });
    }
  }

  function renderCashFlow() {
    const section = $('#cashflow-section');
    const forecast = store.getCashFlowForecast();
    if (forecast.events.length === 0) { section.innerHTML = ''; return; }
    section.innerHTML = `<div class="card" style="margin-bottom:24px">
      <div class="section-title">&#128200; 30-Day Cash Flow</div>
      <div class="cashflow-events">
        ${forecast.events.map(e => `<div class="cf-event">
          <div class="cf-dot ${e.type}"></div>
          <div class="cf-label">${e.label} <span style="color:var(--text-muted);font-size:12px">(Day ${e.day})</span></div>
          <div class="cf-amount ${e.amount > 0 ? 'positive' : 'negative'}">${e.amount > 0 ? '+' : '-'}₹${fmt(Math.abs(e.amount))}</div>
        </div>`).join('')}
      </div>
      <div style="font-size:13px;color:var(--text-sec)">Projected balance in 30 days: <strong style="color:${forecast.projectedBalance >= 0 ? 'var(--income)' : 'var(--expense)'}">₹${fmt(forecast.projectedBalance)}</strong></div>
    </div>`;
  }

  function renderRecentTransactions() {
    const body = $('#recent-txn-body');
    const txns = store.getTransactions({}).slice(0, 5);
    if (txns.length === 0) {
      body.innerHTML = `<tr><td colspan="4" class="no-data">No transactions yet. Start by adding one!</td></tr>`;
      return;
    }
    body.innerHTML = txns.map(t => `<tr>
      <td>${formatDate(t.date)}</td>
      <td>${escHtml(t.description)}</td>
      <td><span class="txn-cat"><span class="txn-cat-icon">${CATEGORY_ICONS[t.category] || ''}</span> ${t.category}</span></td>
      <td class="${t.type === 'income' ? 'amount-income' : 'amount-expense'}">${t.type === 'income' ? '+' : '-'}₹${fmt(t.amount)}</td>
    </tr>`).join('');
  }

  // Transactions View
  function renderTransactions() {
    populateCategoryFilter();
    const filters = {
      type: $('#filter-type').value,
      category: $('#filter-category').value,
      month: $('#filter-month').value || undefined,
      search: $('#filter-search').value || undefined
    };
    const txns = store.getTransactions(filters);
    const body = $('#txn-body');

    if (txns.length === 0) {
      body.innerHTML = `<tr><td colspan="6" class="no-data">No transactions match your filters.</td></tr>`;
      $('#txn-totals').innerHTML = '';
      return;
    }

    body.innerHTML = txns.map(t => `<tr>
      <td>${formatDate(t.date)}</td>
      <td>${escHtml(t.description)}</td>
      <td><span class="txn-cat"><span class="txn-cat-icon">${CATEGORY_ICONS[t.category] || ''}</span> ${t.category}</span></td>
      <td><span class="badge ${t.type === 'income' ? 'badge-income' : 'badge-expense'}">${t.type}</span></td>
      <td class="${t.type === 'income' ? 'amount-income' : 'amount-expense'}">${t.type === 'income' ? '+' : '-'}₹${fmt(t.amount)}</td>
      <td class="action-btns">
        <button class="btn btn-sm btn-ghost edit-txn" data-id="${t.id}" title="Edit">&#9998;</button>
        <button class="btn btn-sm btn-danger del-txn" data-id="${t.id}" title="Delete">&#10006;</button>
      </td>
    </tr>`).join('');

    const incomeTotal = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expenseTotal = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    $('#txn-totals').innerHTML = `<span>Showing ${txns.length} transactions</span><span style="color:var(--income)">Income: ₹${fmt(incomeTotal)}</span><span style="color:var(--expense)">Expenses: ₹${fmt(expenseTotal)}</span>`;
  }

  function populateCategoryFilter() {
    const sel = $('#filter-category');
    const current = sel.value;
    const allCats = [...CATEGORIES.income, ...CATEGORIES.expense];
    sel.innerHTML = '<option value="all">All Categories</option>' + allCats.map(c => `<option value="${c}">${c}</option>`).join('');
    sel.value = current || 'all';
  }

  function populateTxnCategories(type) {
    const sel = $('#txn-category');
    sel.innerHTML = CATEGORIES[type].map(c => `<option value="${c}">${c}</option>`).join('');
  }

  // Budgets View
  function renderBudgets() {
    const month = ym();
    const status = store.getBudgetStatus(month);
    const totalBudget = store.getTotalBudget();
    const totals = store.getMonthlyTotals(month);
    const totalSpent = totals.expenses;

    const totalPct = totalBudget > 0 ? (totalSpent / totalBudget * 100).toFixed(0) : 0;
    $('#budget-total').innerHTML = `
      <div><div class="stat-label">Total Budget</div><div style="font-size:22px;font-weight:700">₹${fmt(totalBudget)}</div></div>
      <div><div class="stat-label">Total Spent</div><div style="font-size:22px;font-weight:700;color:${totalSpent > totalBudget ? 'var(--expense)' : 'var(--text)'}">₹${fmt(totalSpent)} <span style="font-size:13px;color:var(--text-sec)">(${totalPct}%)</span></div></div>
      <div><div class="stat-label">Remaining</div><div style="font-size:22px;font-weight:700;color:${totalBudget - totalSpent >= 0 ? 'var(--income)' : 'var(--expense)'}">₹${fmt(totalBudget - totalSpent)}</div></div>
    `;

    const grid = $('#budget-cards');
    if (status.length === 0) {
      grid.innerHTML = `<div class="empty-state"><div class="empty-icon">&#128202;</div><div class="empty-title">No budgets set</div><div class="empty-desc">Set monthly budgets to track your spending against targets.</div><button class="btn btn-primary" onclick="document.getElementById('btn-add-budget').click()">Set Your First Budget</button></div>`;
      return;
    }

    grid.innerHTML = status.map(b => {
      const pct = Math.min(b.pct, 100);
      const color = b.pct > 100 ? 'var(--expense)' : b.pct >= 80 ? 'var(--warning)' : 'var(--income)';
      const statusClass = b.pct > 100 ? 'budget-over' : b.pct >= 80 ? 'budget-warn' : 'budget-ok';
      const statusText = b.pct > 100 ? `Over by ₹${fmt(b.spent - b.limit)}` : b.pct >= 80 ? 'Near limit' : `₹${fmt(b.remaining)} left`;
      return `<div class="budget-card">
        <div class="budget-card-header">
          <div class="budget-card-title">${CATEGORY_ICONS[b.category] || ''} ${b.category}</div>
          <button class="btn btn-sm btn-danger del-budget" data-cat="${b.category}" title="Remove">&#10006;</button>
        </div>
        <div class="budget-info"><span>₹${fmt(b.spent)} of ₹${fmt(b.limit)}</span><span>${b.pct.toFixed(0)}%</span></div>
        <div class="budget-progress"><div class="budget-progress-bar" style="width:${pct}%;background:${color}"></div></div>
        <div class="budget-status ${statusClass}">${statusText}</div>
      </div>`;
    }).join('');
  }

  // Goals View
  function renderGoals() {
    const grid = $('#goals-grid');
    const goals = store.goals;
    if (goals.length === 0) {
      grid.innerHTML = `<div class="empty-state"><div class="empty-icon">&#11088;</div><div class="empty-title">No savings goals</div><div class="empty-desc">Set goals and track your progress toward them.</div><button class="btn btn-primary" onclick="document.getElementById('btn-add-goal').click()">Create Your First Goal</button></div>`;
      return;
    }

    grid.innerHTML = goals.map(g => {
      const pct = g.targetAmount > 0 ? Math.min((g.savedAmount / g.targetAmount) * 100, 100) : 0;
      const remaining = g.targetAmount - g.savedAmount;
      const circumference = 2 * Math.PI * 32;
      const offset = circumference - (pct / 100) * circumference;
      const color = pct >= 100 ? '#10b981' : '#6366f1';
      const dateStr = g.targetDate ? new Date(g.targetDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '';
      return `<div class="goal-card">
        <div class="goal-header">
          <div>
            <div class="goal-icon">${g.icon || '&#11088;'}</div>
            <div class="goal-name">${escHtml(g.name)}</div>
            ${dateStr ? `<div class="goal-target-date">Target: ${dateStr}</div>` : ''}
          </div>
          <div class="goal-progress-ring">
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="32" fill="none" stroke="var(--border)" stroke-width="5"/>
              <circle cx="40" cy="40" r="32" fill="none" stroke="${color}" stroke-width="5"
                stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" stroke-linecap="round"/>
            </svg>
            <div class="goal-progress-text">${pct.toFixed(0)}%</div>
          </div>
        </div>
        <div class="goal-amounts">
          <span>Saved: ₹${fmt(g.savedAmount)}</span>
          <span>Target: ₹${fmt(g.targetAmount)}</span>
        </div>
        ${remaining > 0 ? `<div class="goal-remaining">₹${fmt(remaining)} remaining</div>` : '<div class="goal-remaining" style="color:var(--income)">Goal reached!</div>'}
        <div class="goal-actions">
          ${remaining > 0 ? `<button class="btn btn-sm btn-success deposit-goal" data-id="${g.id}">+ Add Savings</button>` : ''}
          <button class="btn btn-sm btn-ghost edit-goal" data-id="${g.id}">Edit</button>
          <button class="btn btn-sm btn-danger del-goal" data-id="${g.id}">&#10006;</button>
        </div>
      </div>`;
    }).join('');
  }

  // Reports
  function renderReports() {
    const sel = $('#report-month');
    const months = store.getAvailableMonths();
    if (months.length === 0 && sel.options.length === 0) {
      sel.innerHTML = `<option value="${ym()}">${formatMonth(ym())}</option>`;
    } else if (sel.options.length <= 1) {
      sel.innerHTML = months.map(m => `<option value="${m}">${formatMonth(m)}</option>`).join('');
    }
  }

  function generateReport() {
    const month = $('#report-month').value;
    if (!month) return;
    const r = store.generateReport(month);
    const out = $('#report-output');

    if (r.totals.count === 0) {
      out.innerHTML = `<div class="empty-state"><div class="empty-icon">&#128202;</div><div class="empty-title">No data for ${formatMonth(month)}</div><div class="empty-desc">Add transactions to generate a report.</div></div>`;
      return;
    }

    const incomeChange = store.getMonthChange(r.totals.income, r.prevTotals.income);
    const expenseChange = store.getMonthChange(r.totals.expenses, r.prevTotals.expenses);

    out.innerHTML = `
      <div class="report-summary-grid">
        <div class="report-stat"><div class="label">Income</div><div class="value" style="color:var(--income)">₹${fmt(r.totals.income)}</div><div class="stat-change ${incomeChange >= 0 ? 'up' : 'down'}" style="margin-top:8px;display:inline-flex">${incomeChange >= 0 ? '&#9650;' : '&#9660;'} ${Math.abs(incomeChange).toFixed(1)}%</div></div>
        <div class="report-stat"><div class="label">Expenses</div><div class="value" style="color:var(--expense)">₹${fmt(r.totals.expenses)}</div><div class="stat-change ${expenseChange <= 0 ? 'up' : 'down'}" style="margin-top:8px;display:inline-flex">${expenseChange >= 0 ? '&#9650;' : '&#9660;'} ${Math.abs(expenseChange).toFixed(1)}%</div></div>
        <div class="report-stat"><div class="label">Net Savings</div><div class="value" style="color:${r.totals.savings >= 0 ? 'var(--savings)' : 'var(--expense)'}">₹${fmt(r.totals.savings)}</div><div style="margin-top:8px;font-size:12px;color:var(--text-sec)">Savings rate: ${r.savingsRate}%</div></div>
      </div>

      <div class="report-highlights">
        ${r.health ? `<div class="report-highlight" style="background:var(--primary-bg)"><div class="label">Health Score</div><div class="value" style="color:var(--primary)">${r.health.total}/100 — ${r.health.label}</div></div>` : ''}
        ${r.biggestImprovement ? `<div class="report-highlight" style="background:var(--income-bg)"><div class="label">Biggest Improvement</div><div class="value" style="color:var(--income)">${r.biggestImprovement.category}</div><div class="detail">Down ${Math.abs(r.biggestImprovement.change).toFixed(0)}% vs last month</div></div>` : ''}
        ${r.biggestConcern ? `<div class="report-highlight" style="background:var(--expense-bg)"><div class="label">Watch Out</div><div class="value" style="color:var(--expense)">${r.biggestConcern.category}</div><div class="detail">Up ${r.biggestConcern.change.toFixed(0)}% vs last month</div></div>` : ''}
      </div>

      <div class="report-chart-row">
        <div class="report-chart-box"><div class="chart-title">Expense Breakdown</div><canvas id="report-chart-expense"></canvas></div>
        <div class="report-chart-box"><div class="chart-title">Income Sources</div><canvas id="report-chart-income"></canvas></div>
      </div>

      <div class="report-section">
        <h3>Expenses by Category</h3>
        ${r.topExpenses.map(([cat, amt]) => `<div class="report-row"><span>${CATEGORY_ICONS[cat] || ''} ${cat}</span><span style="font-weight:600">₹${fmt(amt)}</span></div>`).join('')}
        <div class="report-row report-total"><span>Total Expenses</span><span style="color:var(--expense)">₹${fmt(r.totals.expenses)}</span></div>
      </div>

      ${r.budgetStatus.length > 0 ? `<div class="report-section">
        <h3>Budget Performance</h3>
        ${r.budgetStatus.map(b => {
          const color = b.pct > 100 ? 'var(--expense)' : b.pct >= 80 ? 'var(--warning)' : 'var(--income)';
          return `<div class="report-row"><span>${b.category}</span><span style="color:${color};font-weight:600">${b.pct.toFixed(0)}% (₹${fmt(b.spent)} / ₹${fmt(b.limit)})</span></div>`;
        }).join('')}
      </div>` : ''}

      <div class="card" style="text-align:center;padding:28px;margin-top:20px;background:var(--primary-bg);border:1px solid var(--primary)">
        <div style="font-size:24px;margin-bottom:8px">&#127919;</div>
        <div style="font-size:15px;font-weight:600;color:var(--primary)">Next Month Challenge</div>
        <div style="margin-top:8px;font-size:14px;color:var(--text-sec)">${r.challenge}</div>
      </div>
    `;

    if (r.topExpenses.length > 0) {
      makeChart('report-chart-expense', {
        type: 'doughnut',
        data: {
          labels: r.topExpenses.map(([c]) => c),
          datasets: [{ data: r.topExpenses.map(([, v]) => v), backgroundColor: r.topExpenses.map(([c]) => CATEGORY_COLORS[c] || '#6366f1'), borderWidth: 0 }]
        },
        options: { cutout: '60%', plugins: { legend: { position: 'bottom', labels: { padding: 10, usePointStyle: true, pointStyle: 'circle' } } } }
      });
    }

    const incomeEntries = Object.entries(r.incomeBreakdown);
    if (incomeEntries.length > 0) {
      makeChart('report-chart-income', {
        type: 'doughnut',
        data: {
          labels: incomeEntries.map(([c]) => c),
          datasets: [{ data: incomeEntries.map(([, v]) => v), backgroundColor: incomeEntries.map(([c]) => CATEGORY_COLORS[c] || '#10b981'), borderWidth: 0 }]
        },
        options: { cutout: '60%', plugins: { legend: { position: 'bottom', labels: { padding: 10, usePointStyle: true, pointStyle: 'circle' } } } }
      });
    }
  }

  // Simulator
  function runSimulation() {
    const savings = parseFloat($('#sim-savings').value) || 0;
    const returnRate = parseFloat($('#sim-return').value) || 0;
    const years = parseInt($('#sim-years').value) || 5;

    const balance = store.getAllTimeBalance();
    const monthlyReturn = returnRate / 100 / 12;
    const months = years * 12;
    const points = [];
    let running = balance;
    for (let m = 0; m <= months; m++) {
      points.push({ month: m, balance: Math.round(running) });
      running += savings;
      running *= (1 + monthlyReturn);
    }

    const milestones = [
      { label: '6 months', months: 6 },
      { label: '1 year', months: 12 },
      { label: `${Math.floor(years / 2)} years`, months: Math.floor(years / 2) * 12 },
      { label: `${years} years`, months: months }
    ];

    $('#sim-milestones').innerHTML = milestones.map(m => {
      const val = points[Math.min(m.months, points.length - 1)]?.balance || 0;
      return `<div class="sim-milestone"><div class="label">${m.label}</div><div class="value">₹${fmt(val)}</div></div>`;
    }).join('');

    $('#sim-chart-container').style.display = 'block';
    const step = Math.max(1, Math.floor(months / 20));
    const labels = points.filter((_, i) => i % step === 0 || i === months).map(p => {
      const y = Math.floor(p.month / 12);
      const m = p.month % 12;
      return y > 0 ? `${y}y ${m}m` : `${m}m`;
    });
    const data = points.filter((_, i) => i % step === 0 || i === months).map(p => p.balance);

    makeChart('chart-simulator', {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Projected Balance',
          data,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99,102,241,0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 2
        }]
      },
      options: {
        scales: {
          y: { ticks: { callback: v => '₹' + fmt(v) } },
          x: {}
        },
        plugins: { legend: { display: false } }
      }
    });
  }

  // Afford check
  function checkAfford() {
    const cost = parseFloat($('#afford-cost').value);
    if (!cost || cost <= 0) { toast('Enter a valid cost', 'error'); return; }
    const result = store.canAfford(cost);
    const item = $('#afford-item').value || 'This purchase';
    const d = result.details;
    $('#afford-result').innerHTML = `<div class="afford-result ${result.level}">
      <div class="afford-level">${result.level === 'success' ? '&#10004;' : result.level === 'warning' ? '&#9888;' : '&#10006;'} ${result.title}</div>
      <div class="afford-title">${escHtml(item)} — ₹${fmt(cost)}</div>
      <div class="afford-message">${result.message}</div>
      <div class="afford-details">
        <div class="afford-detail-row"><span>Current Balance</span><span>₹${fmt(d.currentBalance)}</span></div>
        <div class="afford-detail-row"><span>After Purchase</span><span style="color:${d.afterBalance >= 0 ? 'var(--income)' : 'var(--expense)'}">₹${fmt(d.afterBalance)}</span></div>
        <div class="afford-detail-row"><span>Monthly Income</span><span>₹${fmt(d.monthlyIncome)}</span></div>
        <div class="afford-detail-row"><span>Monthly Spending</span><span>₹${fmt(d.monthlySpending)}</span></div>
        ${d.remainingBudget !== null ? `<div class="afford-detail-row"><span>Budget Remaining</span><span>₹${fmt(d.remainingBudget)}</span></div>` : ''}
        <div class="afford-detail-row"><span>Savings Rate</span><span>${d.savingsRate}%</span></div>
      </div>
    </div>`;
  }

  // Helpers
  function formatDate(d) { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  function formatMonth(ym) { return new Date(ym + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }); }
  function escHtml(s) { const el = document.createElement('span'); el.textContent = s; return el.innerHTML; }

  // Event listeners
  function init() {
    initTheme();

    $$('.nav-link').forEach(link => {
      link.addEventListener('click', e => { e.preventDefault(); navigate(link.dataset.view); });
    });

    $('#theme-toggle').addEventListener('click', toggleTheme);

    $('#mobile-menu-btn').addEventListener('click', () => {
      $('#sidebar').classList.toggle('open');
      $('#sidebar-overlay').classList.toggle('show');
    });
    $('#sidebar-overlay').addEventListener('click', closeSidebar);

    $$('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => closeModal(btn.dataset.close));
    });
    $$('.modal-overlay').forEach(m => {
      m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); });
    });

    $('#fab-btn').addEventListener('click', () => { $('#fab-menu').classList.toggle('show'); });
    document.addEventListener('click', e => {
      if (!e.target.closest('.fab')) $('#fab-menu').classList.remove('show');
    });
    $$('.fab-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        $('#fab-menu').classList.remove('show');
        switch (item.dataset.action) {
          case 'add-txn': openTxnModal(); break;
          case 'add-budget': openBudgetModal(); break;
          case 'add-goal': openGoalModal(); break;
          case 'add-sub': openModal('modal-sub'); break;
          case 'afford-check': openModal('modal-afford'); break;
        }
      });
    });

    $('#btn-add-txn').addEventListener('click', openTxnModal);
    $('#txn-type').addEventListener('change', () => populateTxnCategories($('#txn-type').value));
    $('#form-txn').addEventListener('submit', handleTxnSubmit);

    $('#btn-add-budget').addEventListener('click', openBudgetModal);
    $('#form-budget').addEventListener('submit', handleBudgetSubmit);

    $('#btn-add-goal').addEventListener('click', openGoalModal);
    $('#form-goal').addEventListener('submit', handleGoalSubmit);

    $('#form-deposit').addEventListener('submit', handleDepositSubmit);
    $('#form-sub').addEventListener('submit', handleSubSubmit);
    $('#btn-afford-check').addEventListener('click', checkAfford);
    $('#btn-generate-report').addEventListener('click', generateReport);
    $('#btn-simulate').addEventListener('click', runSimulation);

    ['filter-type', 'filter-category', 'filter-month', 'filter-search'].forEach(id => {
      $('#' + id).addEventListener('input', () => renderTransactions());
    });

    let quickDebounce;
    $('#quick-entry').addEventListener('input', e => {
      clearTimeout(quickDebounce);
      quickDebounce = setTimeout(() => {
        const text = e.target.value.trim();
        if (text.length < 3) { $('#quick-preview').classList.remove('show'); return; }
        const parsed = store.parseQuickEntry(text);
        if (parsed.amount > 0) {
          $('#quick-preview-text').innerHTML = `<strong>${parsed.type === 'income' ? 'Income' : 'Expense'}</strong>: ₹${fmt(parsed.amount)} in ${parsed.category} — "${escHtml(parsed.description)}"`;
          $('#quick-preview').classList.add('show');
          $('#quick-preview').dataset.parsed = JSON.stringify(parsed);
        } else {
          $('#quick-preview').classList.remove('show');
        }
      }, 300);
    });
    $('#quick-preview-add').addEventListener('click', () => {
      const data = JSON.parse($('#quick-preview').dataset.parsed || '{}');
      if (data.amount) {
        store.addTransaction(data);
        toast('Transaction added!');
        $('#quick-entry').value = '';
        $('#quick-preview').classList.remove('show');
        renderTransactions();
      }
    });

    document.addEventListener('click', e => {
      const editTxn = e.target.closest('.edit-txn');
      if (editTxn) {
        const t = store.transactions.find(t => t.id === editTxn.dataset.id);
        if (t) {
          $('#modal-txn-title').textContent = 'Edit Transaction';
          $('#txn-id').value = t.id;
          $('#txn-type').value = t.type;
          populateTxnCategories(t.type);
          $('#txn-category').value = t.category;
          $('#txn-amount').value = t.amount;
          $('#txn-date').value = t.date;
          $('#txn-desc').value = t.description;
          openModal('modal-txn');
        }
      }

      const delTxn = e.target.closest('.del-txn');
      if (delTxn) {
        store.deleteTransaction(delTxn.dataset.id);
        toast('Transaction deleted');
        renderTransactions();
      }

      const delBudget = e.target.closest('.del-budget');
      if (delBudget) {
        store.deleteBudget(delBudget.dataset.cat);
        toast('Budget removed');
        renderBudgets();
      }

      const depositGoal = e.target.closest('.deposit-goal');
      if (depositGoal) {
        $('#deposit-goal-id').value = depositGoal.dataset.id;
        $('#deposit-amount').value = '';
        openModal('modal-deposit');
      }

      const editGoal = e.target.closest('.edit-goal');
      if (editGoal) {
        const g = store.goals.find(g => g.id === editGoal.dataset.id);
        if (g) {
          $('#modal-goal-title').textContent = 'Edit Goal';
          $('#goal-id').value = g.id;
          $('#goal-name').value = g.name;
          $('#goal-target').value = g.targetAmount;
          $('#goal-saved').value = g.savedAmount;
          $('#goal-date').value = g.targetDate || '';
          $('#goal-icon').value = g.icon || '⭐';
          openModal('modal-goal');
        }
      }

      const delGoal = e.target.closest('.del-goal');
      if (delGoal) {
        store.deleteGoal(delGoal.dataset.id);
        toast('Goal deleted');
        renderGoals();
      }
    });

    renderDashboard();
  }

  function openTxnModal() {
    $('#modal-txn-title').textContent = 'Add Transaction';
    $('#txn-id').value = '';
    $('#form-txn').reset();
    $('#txn-date').value = today();
    populateTxnCategories('expense');
    openModal('modal-txn');
  }

  function openBudgetModal() {
    $('#form-budget').reset();
    const sel = $('#budget-category');
    sel.innerHTML = CATEGORIES.expense.map(c => `<option value="${c}">${c}</option>`).join('');
    openModal('modal-budget');
  }

  function openGoalModal() {
    $('#modal-goal-title').textContent = 'New Savings Goal';
    $('#goal-id').value = '';
    $('#form-goal').reset();
    openModal('modal-goal');
  }

  function handleTxnSubmit(e) {
    e.preventDefault();
    const data = {
      type: $('#txn-type').value,
      amount: parseFloat($('#txn-amount').value),
      category: $('#txn-category').value,
      date: $('#txn-date').value,
      description: $('#txn-desc').value
    };
    const id = $('#txn-id').value;
    if (id) {
      store.updateTransaction(id, data);
      toast('Transaction updated');
    } else {
      store.addTransaction(data);
      toast('Transaction added!');
    }
    closeModal('modal-txn');
    renderCurrentView();
  }

  function handleBudgetSubmit(e) {
    e.preventDefault();
    store.setBudget($('#budget-category').value, parseFloat($('#budget-amount').value));
    toast('Budget set!');
    closeModal('modal-budget');
    renderCurrentView();
  }

  function handleGoalSubmit(e) {
    e.preventDefault();
    const data = {
      name: $('#goal-name').value,
      targetAmount: parseFloat($('#goal-target').value),
      savedAmount: parseFloat($('#goal-saved').value) || 0,
      targetDate: $('#goal-date').value || null,
      icon: $('#goal-icon').value
    };
    const id = $('#goal-id').value;
    if (id) {
      store.updateGoal(id, data);
      toast('Goal updated');
    } else {
      store.addGoal(data);
      toast('Goal created!');
    }
    closeModal('modal-goal');
    renderGoals();
  }

  function handleDepositSubmit(e) {
    e.preventDefault();
    const id = $('#deposit-goal-id').value;
    const amount = parseFloat($('#deposit-amount').value);
    if (amount > 0) {
      store.addToGoal(id, amount);
      toast(`₹${fmt(amount)} added to goal!`);
    }
    closeModal('modal-deposit');
    renderGoals();
  }

  function handleSubSubmit(e) {
    e.preventDefault();
    const data = {
      name: $('#sub-name').value,
      amount: parseFloat($('#sub-amount').value),
      frequency: $('#sub-freq').value,
      category: $('#sub-category').value,
      active: true
    };
    const id = $('#sub-id').value;
    if (id) {
      store.updateSubscription(id, data);
      toast('Subscription updated');
    } else {
      store.addSubscription(data);
      toast('Subscription added!');
    }
    closeModal('modal-sub');
    $('#form-sub').reset();
    renderCurrentView();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
