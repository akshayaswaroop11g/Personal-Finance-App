const CATEGORIES = {
  income: ['Salary', 'Freelance', 'Investments', 'Gifts', 'Refunds', 'Other Income'],
  expense: ['Food & Dining', 'Groceries', 'Housing', 'Transportation', 'Utilities', 'Healthcare', 'Entertainment', 'Shopping', 'Education', 'Insurance', 'Personal Care', 'Subscriptions', 'Travel', 'Other Expense']
};

const CATEGORY_ICONS = {
  'Salary': '💼', 'Freelance': '💻', 'Investments': '📈', 'Gifts': '🎁', 'Refunds': '💸', 'Other Income': '💰',
  'Food & Dining': '🍔', 'Groceries': '🛒', 'Housing': '🏠', 'Transportation': '🚗', 'Utilities': '⚡',
  'Healthcare': '🏥', 'Entertainment': '🎬', 'Shopping': '🛍️', 'Education': '📚', 'Insurance': '🛡️',
  'Personal Care': '💇', 'Subscriptions': '📱', 'Travel': '✈️', 'Other Expense': '📦'
};

const CATEGORY_COLORS = {
  'Salary': '#10b981', 'Freelance': '#06b6d4', 'Investments': '#3b82f6', 'Gifts': '#8b5cf6',
  'Refunds': '#a78bfa', 'Other Income': '#60a5fa',
  'Food & Dining': '#ef4444', 'Groceries': '#f59e0b', 'Housing': '#dc2626', 'Transportation': '#ec4899',
  'Utilities': '#6b7280', 'Healthcare': '#10b981', 'Entertainment': '#8b5cf6', 'Shopping': '#f472b6',
  'Education': '#3b82f6', 'Insurance': '#374151', 'Personal Care': '#a78bfa', 'Subscriptions': '#fbbf24',
  'Travel': '#38bdf8', 'Other Expense': '#94a3b8'
};

function ym(d) {
  if (!d) d = new Date();
  if (typeof d === 'string') return d.slice(0, 7);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function today() {
  const d = new Date();
  return ym(d) + '-' + String(d.getDate()).padStart(2, '0');
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

class FinanceStore {
  constructor() {
    this._migrateOldData();
    this.transactions = this._load('ft_transactions') || [];
    this.budgets = this._load('ft_budgets') || {};
    this.goals = this._load('ft_goals') || [];
    this.subscriptions = this._load('ft_subscriptions') || [];
    this.settings = this._load('ft_settings') || { theme: 'light' };
    this.achievements = this._load('ft_achievements') || {};
  }

  _migrateOldData() {
    try {
      if (localStorage.getItem('ft_version') === '2') return;
      const oldKeys = ['transactions', 'budgets', 'fintrack_transactions', 'fintrack_budgets',
        'fintrack_settings', 'fintrack_data', 'sampleDataLoaded'];
      oldKeys.forEach(k => localStorage.removeItem(k));
      localStorage.setItem('ft_version', '2');
    } catch {}
  }

  _load(key) { try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : null; } catch { return null; } }
  _save(key, data) { try { localStorage.setItem(key, JSON.stringify(data)); } catch {} }
  _saveTxn() { this._save('ft_transactions', this.transactions); }
  _saveBudgets() { this._save('ft_budgets', this.budgets); }
  _saveGoals() { this._save('ft_goals', this.goals); }
  _saveSubs() { this._save('ft_subscriptions', this.subscriptions); }
  _saveSettings() { this._save('ft_settings', this.settings); }
  _saveAchievements() { this._save('ft_achievements', this.achievements); }

  // Transactions
  addTransaction(txn) {
    txn.id = genId();
    this.transactions.push(txn);
    this.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    this._saveTxn();
    this._checkAchievements();
    return txn;
  }

  updateTransaction(id, updates) {
    const idx = this.transactions.findIndex(t => t.id === id);
    if (idx === -1) return null;
    Object.assign(this.transactions[idx], updates);
    this.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    this._saveTxn();
    return this.transactions[idx];
  }

  deleteTransaction(id) {
    this.transactions = this.transactions.filter(t => t.id !== id);
    this._saveTxn();
  }

  getTransactions(filters = {}) {
    let r = [...this.transactions];
    if (filters.type && filters.type !== 'all') r = r.filter(t => t.type === filters.type);
    if (filters.category && filters.category !== 'all') r = r.filter(t => t.category === filters.category);
    if (filters.month) r = r.filter(t => t.date.startsWith(filters.month));
    if (filters.search) { const q = filters.search.toLowerCase(); r = r.filter(t => t.description.toLowerCase().includes(q)); }
    if (filters.sort === 'amount-asc') r.sort((a, b) => a.amount - b.amount);
    else if (filters.sort === 'amount-desc') r.sort((a, b) => b.amount - a.amount);
    else if (filters.sort === 'date-asc') r.sort((a, b) => new Date(a.date) - new Date(b.date));
    return r;
  }

  // Budgets
  setBudget(category, amount) { this.budgets[category] = amount; this._saveBudgets(); }
  deleteBudget(category) { delete this.budgets[category]; this._saveBudgets(); }

  getBudgetStatus(yearMonth) {
    const spending = this.getCategoryBreakdown(yearMonth, 'expense');
    const results = [];
    for (const [cat, limit] of Object.entries(this.budgets)) {
      const spent = spending[cat] || 0;
      const pct = limit > 0 ? (spent / limit) * 100 : 0;
      results.push({ category: cat, limit, spent, remaining: limit - spent, pct });
    }
    return results.sort((a, b) => b.pct - a.pct);
  }

  getTotalBudget() {
    return Object.values(this.budgets).reduce((s, v) => s + v, 0);
  }

  // Goals
  addGoal(goal) { goal.id = genId(); goal.createdDate = today(); this.goals.push(goal); this._saveGoals(); return goal; }
  updateGoal(id, updates) {
    const g = this.goals.find(g => g.id === id);
    if (g) Object.assign(g, updates);
    this._saveGoals();
    return g;
  }
  deleteGoal(id) { this.goals = this.goals.filter(g => g.id !== id); this._saveGoals(); }
  addToGoal(id, amount) {
    const g = this.goals.find(g => g.id === id);
    if (g) { g.savedAmount = Math.min(g.savedAmount + amount, g.targetAmount); this._saveGoals(); this._checkAchievements(); }
    return g;
  }

  // Subscriptions
  addSubscription(sub) { sub.id = genId(); this.subscriptions.push(sub); this._saveSubs(); return sub; }
  updateSubscription(id, updates) {
    const s = this.subscriptions.find(s => s.id === id);
    if (s) Object.assign(s, updates);
    this._saveSubs();
    return s;
  }
  deleteSubscription(id) { this.subscriptions = this.subscriptions.filter(s => s.id !== id); this._saveSubs(); }

  getMonthlySubTotal() {
    return this.subscriptions.filter(s => s.active !== false).reduce((sum, s) => {
      return sum + (s.frequency === 'yearly' ? s.amount / 12 : s.amount);
    }, 0);
  }

  getAnnualSubTotal() { return this.getMonthlySubTotal() * 12; }

  // Settings
  setSetting(key, val) { this.settings[key] = val; this._saveSettings(); }
  getSetting(key) { return this.settings[key]; }

  // Calculations
  getMonthlyTotals(yearMonth) {
    const txns = this.transactions.filter(t => t.date.startsWith(yearMonth));
    const income = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expenses = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { income, expenses, savings: income - expenses, count: txns.length };
  }

  getCategoryBreakdown(yearMonth, type = 'expense') {
    const txns = this.transactions.filter(t => t.date.startsWith(yearMonth) && t.type === type);
    const b = {};
    txns.forEach(t => { b[t.category] = (b[t.category] || 0) + t.amount; });
    return b;
  }

  getAllTimeBalance() {
    return this.transactions.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
  }

  getLast6Months() {
    const months = [], now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(ym(d));
    }
    return months;
  }

  getAvailableMonths() {
    const s = new Set();
    this.transactions.forEach(t => s.add(t.date.slice(0, 7)));
    return [...s].sort().reverse();
  }

  getPrevMonth(yearMonth) {
    const d = new Date(yearMonth + '-01');
    d.setMonth(d.getMonth() - 1);
    return ym(d);
  }

  getMonthChange(current, previous) {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous * 100);
  }

  // Financial Health Score
  getFinancialHealth(yearMonth) {
    const totals = this.getMonthlyTotals(yearMonth);
    const budgetStatus = this.getBudgetStatus(yearMonth);
    const prevYM = this.getPrevMonth(yearMonth);
    const prevTotals = this.getMonthlyTotals(prevYM);

    let budgetScore = 25;
    if (budgetStatus.length > 0) {
      const underBudget = budgetStatus.filter(b => b.pct <= 100).length;
      budgetScore = Math.round((underBudget / budgetStatus.length) * 25);
    }

    let savingScore = 0;
    if (totals.income > 0) {
      const rate = totals.savings / totals.income;
      savingScore = Math.min(25, Math.round(rate * 125));
    }

    let spendingScore = 25;
    if (prevTotals.expenses > 0 && totals.expenses > prevTotals.expenses * 1.2) {
      spendingScore = Math.max(0, 25 - Math.round((totals.expenses / prevTotals.expenses - 1) * 50));
    }

    const daysThisMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const dayOfMonth = new Date().getDate();
    const hasRecentTxn = this.transactions.some(t => {
      const diff = (new Date() - new Date(t.date)) / (1000 * 60 * 60 * 24);
      return diff <= 7;
    });
    let consistencyScore = hasRecentTxn ? 20 : 10;
    if (totals.count >= dayOfMonth * 0.5) consistencyScore = 25;

    const total = Math.min(100, Math.max(0, budgetScore + savingScore + spendingScore + consistencyScore));
    let label = 'Needs Work';
    if (total >= 80) label = 'Excellent';
    else if (total >= 60) label = 'Good';
    else if (total >= 40) label = 'Fair';

    return {
      total, label,
      breakdown: {
        budgeting: budgetScore,
        saving: savingScore,
        spending: spendingScore,
        consistency: consistencyScore
      }
    };
  }

  // Money Insights
  getInsights(yearMonth) {
    const insights = [];
    const totals = this.getMonthlyTotals(yearMonth);
    const prevYM = this.getPrevMonth(yearMonth);
    const prevTotals = this.getMonthlyTotals(prevYM);
    const breakdown = this.getCategoryBreakdown(yearMonth, 'expense');
    const prevBreakdown = this.getCategoryBreakdown(prevYM, 'expense');
    const budgetStatus = this.getBudgetStatus(yearMonth);

    if (totals.count === 0) return [{ icon: '📊', text: 'Start adding transactions to see personalized insights.' }];

    for (const [cat, amt] of Object.entries(breakdown)) {
      const prev = prevBreakdown[cat] || 0;
      if (prev > 0) {
        const change = ((amt - prev) / prev * 100).toFixed(0);
        if (change > 20) insights.push({ icon: '📈', text: `You spent ${change}% more on ${cat} this month.`, type: 'warning' });
        else if (change < -20) insights.push({ icon: '📉', text: `${cat} spending is down ${Math.abs(change)}% — nice!`, type: 'success' });
      }
    }

    if (totals.savings > prevTotals.savings && prevTotals.savings > 0) {
      insights.push({ icon: '💰', text: 'You saved more this month than last month. Keep it up!', type: 'success' });
    }

    if (totals.income > 0) {
      const rate = (totals.savings / totals.income * 100).toFixed(0);
      if (rate >= 30) insights.push({ icon: '🌟', text: `Your savings rate is ${rate}% — outstanding!`, type: 'success' });
      else if (rate < 10 && rate >= 0) insights.push({ icon: '⚠️', text: `Your savings rate is only ${rate}%. Consider cutting discretionary spending.`, type: 'warning' });
    }

    const sorted = Object.entries(breakdown).sort(([, a], [, b]) => b - a);
    if (sorted.length > 0) {
      insights.push({ icon: CATEGORY_ICONS[sorted[0][0]] || '📊', text: `${sorted[0][0]} is your largest expense category at ₹${fmt(sorted[0][1])}.`, type: 'info' });
    }

    const overBudget = budgetStatus.filter(b => b.pct > 100);
    if (overBudget.length > 0) {
      insights.push({ icon: '🚨', text: `You're over budget in ${overBudget.map(b => b.category).join(', ')}.`, type: 'danger' });
    }

    const nearBudget = budgetStatus.filter(b => b.pct >= 80 && b.pct <= 100);
    if (nearBudget.length > 0) {
      insights.push({ icon: '⚡', text: `${nearBudget[0].category} is at ${nearBudget[0].pct.toFixed(0)}% of budget — watch your spending.`, type: 'warning' });
    }

    return insights.slice(0, 5);
  }

  // Can I Afford This?
  canAfford(amount) {
    const balance = this.getAllTimeBalance();
    const month = ym();
    const totals = this.getMonthlyTotals(month);
    const totalBudget = this.getTotalBudget();
    const remainingBudget = totalBudget > 0 ? totalBudget - totals.expenses : null;
    const savingsRate = totals.income > 0 ? totals.savings / totals.income : 0;
    const goalsTotal = this.goals.reduce((s, g) => s + (g.targetAmount - g.savedAmount), 0);

    let level, title, message;
    const afterBalance = balance - amount;
    const afterSavings = totals.savings - amount;

    if (amount > balance) {
      level = 'danger'; title = 'Not Recommended';
      message = 'This purchase exceeds your current balance.';
    } else if (remainingBudget !== null && amount > remainingBudget) {
      level = 'danger'; title = 'Not Recommended';
      message = 'This would put you over your monthly budget.';
    } else if (afterSavings < 0) {
      level = 'warning'; title = 'Think About It';
      message = 'This purchase is possible, but it would reduce your planned monthly savings.';
    } else if (amount > balance * 0.3) {
      level = 'warning'; title = 'Think About It';
      message = 'This is a significant portion of your balance. Consider if it aligns with your goals.';
    } else {
      level = 'success'; title = 'Comfortable';
      message = 'You can afford this purchase while staying within your current budget.';
    }

    return {
      level, title, message, amount,
      details: {
        currentBalance: balance,
        afterBalance,
        monthlyIncome: totals.income,
        monthlySpending: totals.expenses,
        remainingBudget,
        savingsRate: (savingsRate * 100).toFixed(1),
        goalsRemaining: goalsTotal
      }
    };
  }

  // Cash Flow Forecast
  getCashFlowForecast() {
    const balance = this.getAllTimeBalance();
    const months = this.getAvailableMonths().slice(0, 3);
    const avgIncome = months.length > 0
      ? months.reduce((s, m) => s + this.getMonthlyTotals(m).income, 0) / months.length
      : 0;
    const avgDailyExpense = months.length > 0
      ? months.reduce((s, m) => s + this.getMonthlyTotals(m).expenses, 0) / months.length / 30
      : 0;

    const events = [];
    const now = new Date();
    let running = balance;

    events.push({ day: 0, label: 'Today', amount: 0, balance: running, type: 'info' });

    this.subscriptions.filter(s => s.active !== false).forEach(sub => {
      if (sub.frequency === 'monthly') {
        const billDay = sub.billingDay || 1;
        let daysUntil = billDay - now.getDate();
        if (daysUntil <= 0) daysUntil += 30;
        if (daysUntil <= 30) {
          events.push({ day: daysUntil, label: sub.name, amount: -sub.amount, type: 'expense' });
        }
      }
    });

    const incomeDay = 1;
    let daysUntilPay = incomeDay - now.getDate();
    if (daysUntilPay <= 0) daysUntilPay += 30;
    if (avgIncome > 0) {
      events.push({ day: daysUntilPay, label: 'Expected Income', amount: avgIncome, type: 'income' });
    }

    events.sort((a, b) => a.day - b.day);

    const forecast = [];
    let bal = balance;
    for (let day = 0; day <= 30; day++) {
      const dayEvents = events.filter(e => e.day === day);
      dayEvents.forEach(e => { if (e.amount) bal += e.amount; });
      bal -= avgDailyExpense;
      forecast.push({ day, balance: Math.round(bal), events: dayEvents });
    }

    return { events: events.filter(e => e.amount !== 0), forecast, projectedBalance: Math.round(bal) };
  }

  // Financial Simulator
  simulate(params) {
    const { monthlySavings = 0, monthlyExpenseChange = 0, incomeChange = 0, oneTimePurchase = 0 } = params;
    const balance = this.getAllTimeBalance();
    const month = ym();
    const totals = this.getMonthlyTotals(month);
    const monthlyIncome = totals.income + incomeChange;
    const monthlyExpenses = totals.expenses + monthlyExpenseChange;
    const effectiveSavings = monthlySavings || (monthlyIncome - monthlyExpenses);

    const points = [];
    let running = balance - oneTimePurchase;
    const periods = [
      { months: 6, label: '6 months' }, { months: 12, label: '1 year' },
      { months: 36, label: '3 years' }, { months: 60, label: '5 years' }
    ];

    for (let m = 0; m <= 60; m++) {
      running += effectiveSavings;
      points.push({ month: m, balance: Math.round(running) });
    }

    return {
      startBalance: balance,
      effectiveSavings,
      points,
      milestones: periods.map(p => ({ ...p, balance: points[p.months]?.balance || 0 }))
    };
  }

  // Report generation
  generateReport(yearMonth) {
    const totals = this.getMonthlyTotals(yearMonth);
    const prevYM = this.getPrevMonth(yearMonth);
    const prevTotals = this.getMonthlyTotals(prevYM);
    const expenseBreakdown = this.getCategoryBreakdown(yearMonth, 'expense');
    const incomeBreakdown = this.getCategoryBreakdown(yearMonth, 'income');
    const prevExpenseBreakdown = this.getCategoryBreakdown(prevYM, 'expense');
    const budgetStatus = this.getBudgetStatus(yearMonth);
    const topExpenses = Object.entries(expenseBreakdown).sort(([, a], [, b]) => b - a);
    const savingsRate = totals.income > 0 ? ((totals.savings / totals.income) * 100).toFixed(1) : '0.0';

    let biggestImprovement = null, biggestConcern = null;
    for (const [cat, amt] of Object.entries(expenseBreakdown)) {
      const prev = prevExpenseBreakdown[cat] || 0;
      if (prev > 0) {
        const change = (amt - prev) / prev * 100;
        if (change < 0 && (!biggestImprovement || change < biggestImprovement.change))
          biggestImprovement = { category: cat, change };
        if (change > 0 && (!biggestConcern || change > biggestConcern.change))
          biggestConcern = { category: cat, change };
      }
    }

    const challengeAmount = Math.round(totals.savings * 0.2 / 100) * 100;

    return {
      month: yearMonth, totals, prevTotals, expenseBreakdown, incomeBreakdown,
      budgetStatus, topExpenses, savingsRate, biggestImprovement, biggestConcern,
      challenge: challengeAmount > 0 ? `Try to save an extra ₹${fmt(challengeAmount)} next month.` : 'Start tracking expenses to set a savings challenge.',
      health: this.getFinancialHealth(yearMonth)
    };
  }

  // Quick Entry Parser
  parseQuickEntry(text) {
    const result = { type: 'expense', amount: 0, category: '', description: text, date: today() };

    const amountMatch = text.match(/₹?\s*([\d,]+(?:\.\d{1,2})?)/);
    if (amountMatch) result.amount = parseFloat(amountMatch[1].replace(/,/g, ''));

    if (/received|earned|got paid|income|salary/i.test(text)) result.type = 'income';

    const categoryKeywords = {
      'Food & Dining': /food|lunch|dinner|breakfast|restaurant|cafe|coffee|snack|meal|eat/i,
      'Groceries': /grocery|groceries|supermarket|vegetable|fruit|milk/i,
      'Transportation': /uber|ola|taxi|cab|fuel|petrol|diesel|metro|bus|auto|transport|ride/i,
      'Entertainment': /movie|netflix|spotify|game|concert|show|entertainment/i,
      'Shopping': /shop|buy|purchase|amazon|flipkart|cloth|shoe|dress/i,
      'Healthcare': /doctor|hospital|medicine|pharmacy|health|gym|medical/i,
      'Housing': /rent|maintenance|repair|home/i,
      'Utilities': /electric|water|internet|phone|bill|recharge/i,
      'Education': /book|course|class|tuition|school|college|education/i,
      'Travel': /travel|flight|hotel|trip|vacation/i,
      'Subscriptions': /subscription|membership|premium/i,
      'Personal Care': /salon|haircut|spa|beauty|grooming/i,
      'Salary': /salary|paycheck|pay/i,
      'Freelance': /freelance|project|consulting|client/i
    };

    const descWithoutAmount = text.replace(/₹?\s*[\d,]+(?:\.\d{1,2})?/, '').trim();

    for (const [cat, regex] of Object.entries(categoryKeywords)) {
      if (regex.test(descWithoutAmount)) {
        result.category = cat;
        if (CATEGORIES.income.includes(cat)) result.type = 'income';
        break;
      }
    }

    if (!result.category) {
      result.category = result.type === 'income' ? 'Other Income' : 'Other Expense';
    }

    result.description = descWithoutAmount.replace(/^(spent|paid|received|earned|got)\s+(on\s+|for\s+)?/i, '').trim() || result.category;

    return result;
  }

  // Achievements
  _checkAchievements() {
    const a = this.achievements;
    const txnCount = this.transactions.length;

    if (txnCount >= 1 && !a.first_transaction) a.first_transaction = { date: today(), name: 'First Step', icon: '🎯', desc: 'Logged your first transaction' };
    if (txnCount >= 10 && !a.ten_transactions) a.ten_transactions = { date: today(), name: 'Getting Started', icon: '📊', desc: 'Logged 10 transactions' };
    if (txnCount >= 50 && !a.fifty_transactions) a.fifty_transactions = { date: today(), name: 'Committed', icon: '💪', desc: 'Logged 50 transactions' };
    if (txnCount >= 100 && !a.hundred_transactions) a.hundred_transactions = { date: today(), name: 'Finance Pro', icon: '🏆', desc: 'Logged 100 transactions' };

    const month = ym();
    const totals = this.getMonthlyTotals(month);
    if (totals.savings >= 10000 && !a.save_10k) a.save_10k = { date: today(), name: 'Saver', icon: '💰', desc: 'Saved ₹10,000 in a month' };
    if (totals.savings >= 25000 && !a.save_25k) a.save_25k = { date: today(), name: 'Super Saver', icon: '💎', desc: 'Saved ₹25,000 in a month' };

    const budgetStatus = this.getBudgetStatus(month);
    if (budgetStatus.length > 0 && budgetStatus.every(b => b.pct <= 100) && !a['budget_master_' + month])
      a['budget_master_' + month] = { date: today(), name: 'Budget Master', icon: '🎖️', desc: 'All categories under budget' };

    const completedGoals = this.goals.filter(g => g.savedAmount >= g.targetAmount);
    if (completedGoals.length >= 1 && !a.first_goal) a.first_goal = { date: today(), name: 'Goal Getter', icon: '🎯', desc: 'Completed your first savings goal' };

    this._saveAchievements();
  }

  getAchievementsList() {
    return Object.values(this.achievements).sort((a, b) => new Date(b.date) - new Date(a.date));
  }
}

function fmt(n) {
  return Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const store = new FinanceStore();
