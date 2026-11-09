/**
 * Monthly budget: what comes in, where it goes, and which of it also counts
 * towards a tax deduction. Pure functions, plus browser storage at the bottom.
 */

import { getRules } from './taxRules.js';
import { computeTax } from './taxCalculator.js';

export const GROUPS = [
  { id: 'needs', label: 'Needs', target: 0.5, description: 'Rent, EMIs, groceries, bills and insurance.' },
  { id: 'wants', label: 'Wants', target: 0.3, description: 'Eating out, shopping, entertainment and travel.' },
  { id: 'savings', label: 'Savings and investments', target: 0.2, description: 'SIPs, PPF, NPS and your emergency fund.' },
];

/** Spending that can also reduce tax under the old regime, mapped to calculator fields. */
export const TAX_TAGS = {
  sec80C: { label: '80C', field: 'sec80C', name: 'Section 80C investments' },
  sec80DSelf: { label: '80D', field: 'sec80DSelf', name: 'Health insurance: self and family' },
  sec80DParents: { label: '80D parents', field: 'sec80DParents', name: 'Health insurance: parents' },
  sec80CCD1B: { label: 'NPS', field: 'sec80CCD1B', name: 'Your own NPS, extra' },
  rentPaid: { label: 'HRA', field: 'rentPaid', name: 'Rent paid in the year' },
};

const item = (id, group, label, frequency = 'monthly', tax = null) => ({ id, group, label, amount: 0, frequency, tax });

export const DEFAULT_ITEMS = [
  item('rent', 'needs', 'Rent', 'monthly', 'rentPaid'),
  item('home-emi', 'needs', 'Home loan EMI'),
  item('groceries', 'needs', 'Groceries'),
  item('utilities', 'needs', 'Electricity, water and gas'),
  item('phone', 'needs', 'Phone and internet'),
  item('transport', 'needs', 'Transport and fuel'),
  item('tuition', 'needs', 'Children\'s tuition fees', 'yearly', 'sec80C'),
  item('health', 'needs', 'Health insurance', 'yearly', 'sec80DSelf'),
  item('health-parents', 'needs', 'Parents\' health insurance', 'yearly', 'sec80DParents'),
  item('life', 'needs', 'Life insurance premium', 'yearly', 'sec80C'),
  item('dining', 'wants', 'Eating out and delivery'),
  item('shopping', 'wants', 'Shopping'),
  item('subscriptions', 'wants', 'Entertainment and subscriptions'),
  item('travel', 'wants', 'Travel and holidays', 'yearly'),
  item('sip', 'savings', 'Mutual fund SIPs'),
  item('elss', 'savings', 'ELSS', 'monthly', 'sec80C'),
  item('ppf', 'savings', 'PPF', 'yearly', 'sec80C'),
  item('nps', 'savings', 'NPS', 'monthly', 'sec80CCD1B'),
  item('emergency', 'savings', 'Emergency fund'),
];

export const EMPTY_BUDGET = { incomeMode: 'estimate', manualIncome: 0, horizon: 10, items: DEFAULT_ITEMS };

const positive = (n) => (Number.isFinite(Number(n)) && Number(n) > 0 ? Number(n) : 0);

export function monthlyAmount(entry) {
  const amount = positive(entry.amount);
  return entry.frequency === 'yearly' ? amount / 12 : amount;
}

export function annualAmount(entry) {
  const amount = positive(entry.amount);
  return entry.frequency === 'yearly' ? amount : amount * 12;
}

/**
 * Monthly take-home estimated from the tax computation: income received, less
 * income tax and professional tax. It can't see PF or other payroll deductions,
 * so a payslip's net pay is more accurate.
 */
export function estimateTakeHome(result) {
  if (!result?.hasIncome) return { monthly: 0, annual: 0 };
  const { input, chosen } = result;
  const received = input.grossSalary + chosen.business.income + input.rentReceived
    + input.savingsInterest + input.fdInterest + input.dividends + input.otherIncome;
  const annual = Math.max(0, received - chosen.totalTax - input.professionalTax);
  return { monthly: annual / 12, annual };
}

export function monthlyIncome(budget, result) {
  return budget.incomeMode === 'manual' ? positive(budget.manualIncome) : estimateTakeHome(result).monthly;
}

export function summarizeBudget(budget, income) {
  const totals = Object.fromEntries(GROUPS.map((g) => [g.id, 0]));
  for (const entry of budget.items) {
    if (entry.group in totals) totals[entry.group] += monthlyAmount(entry);
  }

  const outflow = totals.needs + totals.wants + totals.savings;
  const leftover = income - outflow;
  const share = (amount) => (income > 0 ? amount / income : 0);

  const groups = GROUPS.map((group) => {
    const amount = totals[group.id];
    const actual = share(amount);
    const over = group.id === 'savings' ? actual < group.target : actual > group.target;
    return { ...group, amount, share: actual, offTarget: income > 0 && over };
  });

  const categories = budget.items
    .map((entry) => ({ ...entry, monthly: monthlyAmount(entry), share: share(monthlyAmount(entry)) }))
    .filter((entry) => entry.monthly > 0)
    .sort((a, b) => b.monthly - a.monthly);

  return {
    income,
    totals,
    spending: totals.needs + totals.wants,
    outflow,
    leftover,
    overspending: leftover < 0,
    // Money that stays with you: what you invest plus anything left unspent.
    savingsRate: income > 0 ? (totals.savings + Math.max(0, leftover)) / income : 0,
    groups,
    categories,
  };
}

/** Annual amounts per calculator field, from spending tagged as tax-deductible. */
export function taxDeductibleSpending(budget) {
  const sums = {};
  for (const entry of budget.items) {
    if (!entry.tax || !TAX_TAGS[entry.tax]) continue;
    const field = TAX_TAGS[entry.tax].field;
    sums[field] = (sums[field] ?? 0) + annualAmount(entry);
  }
  return Object.entries(sums)
    .filter(([, amount]) => amount > 0)
    .map(([field, amount]) => ({ field, amount: Math.round(amount), name: Object.values(TAX_TAGS).find((t) => t.field === field).name }));
}

/** The changes that applying budget figures would make to a tax draft. */
export function deductionChanges(draft, deductible) {
  return deductible
    .map(({ field, amount, name }) => ({ field, name, from: positive(draft[field]), to: amount }))
    .filter((change) => change.from !== change.to);
}

export function applyDeductions(draft, changes) {
  const next = { ...draft };
  for (const change of changes) next[change.field] = change.to;
  if (changes.some((c) => c.field === 'rentPaid')) {
    next.sources = { ...draft.sources, salary: true };
  }
  return next;
}

/** Rule-based observations. Plain guidance, not financial advice. */
export function budgetInsights(summary, budget, fy) {
  const insights = [];
  const caps = getRules(fy).caps;
  const { income, totals } = summary;
  if (income <= 0 || summary.outflow <= 0) return insights;

  if (summary.overspending) {
    insights.push({
      tone: 'error',
      title: `You're spending ₹${Math.round(-summary.leftover).toLocaleString('en-IN')} more than you earn each month`,
      detail: 'Start with wants: they are the easiest to cut without changing your commitments.',
    });
  }

  const [needs, wants, savings] = summary.groups;
  if (needs.share > needs.target) {
    insights.push({
      tone: 'warn',
      title: `Needs take ${(needs.share * 100).toFixed(0)}% of your income`,
      detail: 'The 50/30/20 guideline suggests about half. High rent or EMIs are the usual cause, and they leave less room if your income drops.',
    });
  }
  if (wants.share > wants.target) {
    insights.push({
      tone: 'warn',
      title: `Wants take ${(wants.share * 100).toFixed(0)}% of your income`,
      detail: 'The guideline suggests up to 30%. Your biggest wants are listed under "Where your money goes".',
    });
  }
  if (savings.share < savings.target && !summary.overspending) {
    insights.push({
      tone: 'info',
      title: `You invest ${(savings.share * 100).toFixed(0)}% of your income`,
      detail: summary.leftover > 0
        ? `A common target is 20%. Putting part of the ₹${Math.round(summary.leftover).toLocaleString('en-IN')} you have left over into a SIP would close the gap.`
        : 'A common target is 20%.',
    });
  }

  const emergency = budget.items.find((e) => e.id === 'emergency');
  if (emergency && monthlyAmount(emergency) === 0 && totals.needs > 0) {
    insights.push({
      tone: 'info',
      title: 'No money going to an emergency fund',
      detail: `Six months of needs is about ₹${Math.round(totals.needs * 6).toLocaleString('en-IN')}. Building it first protects your other plans.`,
    });
  }

  const deductible = taxDeductibleSpending(budget);
  const eightyC = deductible.find((d) => d.field === 'sec80C');
  if (eightyC && eightyC.amount > caps.sec80C) {
    insights.push({
      tone: 'info',
      title: `₹${eightyC.amount.toLocaleString('en-IN')} a year goes into 80C items`,
      detail: `Only ₹${caps.sec80C.toLocaleString('en-IN')} reduces your tax. Anything above that is still good saving, just not a tax saving.`,
    });
  }

  if (insights.length === 0) {
    insights.push({ tone: 'success', title: 'Your budget is in good shape', detail: 'You live within your income and invest at least 20% of it.' });
  }
  return insights;
}

/* ── Investment returns ──────────────────────────── */

/**
 * Rough long-run yearly returns (CAGR) by kind of investment, as low, average
 * and high cases. These are planning assumptions, not promises: equity can
 * fall for years at a time. PPF is fixed by the government each quarter and was
 * 7.1% for October–December 2026.
 */
export const RETURN_PROFILES = {
  equity: { label: 'Equity mutual funds', low: 0.08, avg: 0.12, high: 0.15, note: 'Can fall sharply in some years. Gains above ₹1.25 lakh a year are taxed.' },
  nps: { label: 'NPS', low: 0.08, avg: 0.10, high: 0.12, note: 'Depends on your equity and debt mix. Mostly locked in until 60.' },
  ppf: { label: 'PPF', low: 0.071, avg: 0.071, high: 0.071, note: 'Government-set rate, 7.1% now and reviewed every quarter. Tax-free, locked in for 15 years.' },
  debt: { label: 'Fixed deposits and debt funds', low: 0.06, avg: 0.07, high: 0.075, note: 'Interest is taxed at your slab rate.' },
  cash: { label: 'Savings account or liquid fund', low: 0.03, avg: 0.05, high: 0.065, note: 'Kept for safety and quick access, not growth.' },
};

export const INFLATION = 0.06;
export const HORIZONS = [5, 10, 15, 20, 25];
export const SCENARIOS = ['low', 'avg', 'high'];

const DEFAULT_RETURN_TYPE = { sip: 'equity', elss: 'equity', ppf: 'ppf', nps: 'nps', emergency: 'cash' };

export function returnTypeFor(entry) {
  if (entry.returnType && RETURN_PROFILES[entry.returnType]) return entry.returnType;
  return DEFAULT_RETURN_TYPE[entry.id] ?? 'debt';
}

/**
 * Value after `years` of regular contributions paid at the start of each
 * period. Monthly money compounds at the monthly rate that matches the yearly
 * return, so 12% means 12% a year, not 12.68%.
 */
export function futureValue(amount, frequency, rate, years) {
  const yearly = frequency === 'yearly';
  const periods = yearly ? years : years * 12;
  const r = yearly ? rate : (1 + rate) ** (1 / 12) - 1;
  const invested = amount * periods;
  const value = r === 0 ? invested : amount * (((1 + r) ** periods - 1) / r) * (1 + r);
  return { invested, value };
}

/* ── Tax on returns ──────────────────────────────── */

const CESS = 0.04;

/**
 * How each kind of investment is taxed when you take the money out, assuming
 * everything is withdrawn at the end of the period. Checked against the FY
 * 2026-27 rules, which Budget 2026 left unchanged.
 */
export const RETURN_TAX = {
  equity: { rule: 'equity', label: '12.5% on long-term gains above ₹1.25 lakh a year' },
  nps: { rule: 'nps', label: '60% of the corpus is tax-free; the rest is treated as taxable here' },
  ppf: { rule: 'exempt', label: 'Tax-free' },
  debt: { rule: 'slab', label: 'Gains taxed at your slab rate' },
  cash: { rule: 'slab', label: 'Interest taxed at your slab rate' },
};

export const EQUITY_LTCG = { rate: 0.125, exemptPerYear: 125000 };
export const NPS_TAX_FREE_SHARE = 0.6;
export const SLAB_CHOICES = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3];

/**
 * The rate your next rupee of interest would be taxed at, cess included, read
 * off your own tax computation. Capped at 30% plus cess: marginal relief near
 * a threshold can briefly push the true figure higher.
 */
export function marginalRate(result) {
  if (!result?.hasIncome) return null;
  const step = 10000;
  const withMore = computeTax({
    ...result.input,
    sources: { ...result.input.sources, otherIncome: true },
    otherIncome: result.input.otherIncome + step,
    filingRegime: result.filingRegime,
  });
  const rate = (withMore.chosen.totalTax - result.chosen.totalTax) / step;
  return Math.min(Math.max(rate, 0), 0.3 * (1 + CESS));
}

/**
 * Tax due on withdrawal for each item, for one scenario. The ₹1.25 lakh equity
 * exemption is per person per year, so it is shared across all equity items.
 */
export function taxOnReturns(items, scenario, slabRate) {
  const gain = (item) => Math.max(0, item[scenario] - item.invested);
  const equityItems = items.filter((i) => RETURN_TAX[i.type].rule === 'equity');
  const equityGain = equityItems.reduce((t, i) => t + gain(i), 0);
  const equityTax = Math.max(0, equityGain - EQUITY_LTCG.exemptPerYear) * EQUITY_LTCG.rate * (1 + CESS);

  const perItem = {};
  for (const item of items) {
    const rule = RETURN_TAX[item.type].rule;
    let tax = 0;
    if (rule === 'equity') tax = equityGain > 0 ? equityTax * (gain(item) / equityGain) : 0;
    if (rule === 'slab') tax = gain(item) * slabRate;
    if (rule === 'nps') tax = item[scenario] * (1 - NPS_TAX_FREE_SHARE) * slabRate;
    perItem[item.id] = tax;
  }
  const total = Object.values(perItem).reduce((t, v) => t + v, 0);
  return { perItem, total, equityTax, equityGain };
}

/** Projection for every savings item with an amount, under all three cases. */
export function projectInvestments(budget, years, { slabRate = 0.2 * (1 + CESS) } = {}) {
  const items = budget.items
    .filter((entry) => entry.group === 'savings' && positive(entry.amount) > 0)
    .map((entry) => {
      const type = returnTypeFor(entry);
      const profile = RETURN_PROFILES[type];
      const cases = Object.fromEntries(SCENARIOS.map((s) => [s, futureValue(positive(entry.amount), entry.frequency, profile[s], years)]));
      return { id: entry.id, label: entry.label, type, rate: profile.avg, invested: cases.avg.invested, ...Object.fromEntries(SCENARIOS.map((s) => [s, cases[s].value])) };
    });

  const sum = (key) => items.reduce((total, item) => total + item[key], 0);
  const avg = sum('avg');
  const invested = sum('invested');

  // Year-by-year path for the average case, for the growth chart.
  const path = Array.from({ length: years }, (_, i) => {
    const year = i + 1;
    let yearInvested = 0;
    let yearValue = 0;
    for (const entry of budget.items) {
      if (entry.group !== 'savings' || positive(entry.amount) === 0) continue;
      const point = futureValue(positive(entry.amount), entry.frequency, RETURN_PROFILES[returnTypeFor(entry)].avg, year);
      yearInvested += point.invested;
      yearValue += point.value;
    }
    return { year, invested: yearInvested, growth: yearValue - yearInvested, value: yearValue };
  });

  const taxes = Object.fromEntries(SCENARIOS.map((s) => [s, taxOnReturns(items, s, slabRate)]));
  for (const item of items) {
    item.tax = taxes.avg.perItem[item.id];
    item.afterTax = item.avg - item.tax;
    item.afterTaxLow = item.low - taxes.low.perItem[item.id];
    item.afterTaxHigh = item.high - taxes.high.perItem[item.id];
  }

  // Booking up to ₹1.25 lakh of equity gains each year resets the cost, so
  // roughly one exemption per year is used instead of one in total.
  const harvestedTax = Math.max(0, taxes.avg.equityGain - EQUITY_LTCG.exemptPerYear * years) * EQUITY_LTCG.rate * (1 + CESS);
  const afterTax = avg - taxes.avg.total;

  return {
    years,
    items,
    invested,
    low: sum('low'),
    avg,
    high: sum('high'),
    growth: avg - invested,
    slabRate,
    tax: taxes.avg.total,
    afterTax,
    afterTaxLow: sum('low') - taxes.low.total,
    afterTaxHigh: sum('high') - taxes.high.total,
    equityTax: taxes.avg.equityTax,
    harvestSaving: Math.max(0, taxes.avg.equityTax - harvestedTax),
    todaysMoney: afterTax / (1 + INFLATION) ** years,
    // The single yearly rate that turns these contributions into the average value.
    blendedRate: invested > 0 ? blendedRate(items, budget, years, avg) : 0,
    path,
  };
}

function blendedRate(items, budget, years, target) {
  const contributions = budget.items.filter((e) => items.some((i) => i.id === e.id));
  const valueAt = (rate) => contributions.reduce((t, e) => t + futureValue(positive(e.amount), e.frequency, rate, years).value, 0);
  let low = 0;
  let high = 0.5;
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    if (valueAt(mid) < target) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

/** Stop a spreadsheet treating a typed name as a formula. */
function csvCell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function budgetCsv(budget, summary) {
  const groupLabel = Object.fromEntries(GROUPS.map((g) => [g.id, g.label]));
  const rows = [
    ['Monthly budget'],
    ['Take-home pay per month (₹)', Math.round(summary.income)],
    [],
    ['Item', 'Group', 'Entered as', 'Amount entered (₹)', 'Per month (₹)', 'Tax deduction'],
    ...budget.items
      .filter((e) => positive(e.amount) > 0)
      .map((e) => [csvCell(e.label), groupLabel[e.group], e.frequency, Math.round(positive(e.amount)), Math.round(monthlyAmount(e)), e.tax ? TAX_TAGS[e.tax].label : '']),
    [],
    ...GROUPS.map((g) => [`Total ${g.label.toLowerCase()} per month (₹)`, Math.round(summary.totals[g.id])]),
    [summary.overspending ? 'Overspending per month (₹)' : 'Left over per month (₹)', Math.round(Math.abs(summary.leftover))],
  ];
  return rows.map((row) => row.join(',')).join('\n');
}

/* ── Storage ─────────────────────────────────────── */

const BUDGET_KEY = 'taxtrust_budget';

export function loadBudget() {
  try {
    const raw = localStorage.getItem(BUDGET_KEY);
    if (!raw) return EMPTY_BUDGET;
    const saved = JSON.parse(raw);
    return { ...EMPTY_BUDGET, ...saved, items: Array.isArray(saved.items) ? saved.items : DEFAULT_ITEMS };
  } catch {
    return EMPTY_BUDGET;
  }
}

export function saveBudget(budget) {
  try {
    localStorage.setItem(BUDGET_KEY, JSON.stringify(budget));
  } catch {
    // Storage can be blocked. The planner still works for this visit.
  }
}
