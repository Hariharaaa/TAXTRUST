import test from 'node:test';
import assert from 'node:assert/strict';
import { computeTax } from './taxCalculator.js';
import {
  applyDeductions,
  budgetCsv,
  budgetInsights,
  deductionChanges,
  EMPTY_BUDGET,
  estimateTakeHome,
  futureValue,
  marginalRate,
  projectInvestments,
  taxOnReturns,
  returnTypeFor,
  monthlyAmount,
  monthlyIncome,
  summarizeBudget,
  taxDeductibleSpending,
} from './budget.js';

const withAmounts = (amounts, extra = {}) => ({
  ...EMPTY_BUDGET,
  ...extra,
  items: EMPTY_BUDGET.items.map((item) => (item.id in amounts ? { ...item, amount: amounts[item.id] } : item)),
});

test('yearly items are spread across twelve months', () => {
  assert.equal(monthlyAmount({ amount: 24000, frequency: 'yearly' }), 2000);
  assert.equal(monthlyAmount({ amount: 5000, frequency: 'monthly' }), 5000);
  assert.equal(monthlyAmount({ amount: -10, frequency: 'monthly' }), 0);
});

test('totals, left over and savings rate', () => {
  // Needs 25,000 + 2,000 (24k health/yr) = 27,000. Wants 10,000. Savings 15,000 + 1,000 (12k PPF/yr) = 16,000.
  const budget = withAmounts({ rent: 25000, health: 24000, dining: 10000, sip: 15000, ppf: 12000 });
  const s = summarizeBudget(budget, 100000);
  assert.equal(s.totals.needs, 27000);
  assert.equal(s.totals.wants, 10000);
  assert.equal(s.totals.savings, 16000);
  assert.equal(s.spending, 37000);
  assert.equal(s.leftover, 47000);
  assert.equal(s.savingsRate, 0.63); // 16,000 invested + 47,000 unspent
  assert.equal(s.overspending, false);
});

test('overspending is reported, and savings rate never goes negative', () => {
  const s = summarizeBudget(withAmounts({ rent: 60000, shopping: 50000 }), 100000);
  assert.equal(s.overspending, true);
  assert.equal(s.leftover, -10000);
  assert.equal(s.savingsRate, 0);
});

test('categories are sorted biggest first and skip empty ones', () => {
  const s = summarizeBudget(withAmounts({ rent: 20000, groceries: 8000, travel: 120000 }), 100000);
  assert.deepEqual(s.categories.map((c) => c.id), ['rent', 'travel', 'groceries']);
});

test('50/30/20 flags needs above half and savings below a fifth', () => {
  const s = summarizeBudget(withAmounts({ rent: 60000, sip: 5000 }), 100000);
  const byId = Object.fromEntries(s.groups.map((g) => [g.id, g]));
  assert.equal(byId.needs.offTarget, true);
  assert.equal(byId.wants.offTarget, false);
  assert.equal(byId.savings.offTarget, true);
});

test('tax-deductible spending is annualised per calculator field', () => {
  const budget = withAmounts({ rent: 25000, elss: 5000, ppf: 50000, life: 30000, health: 18000, nps: 2000 });
  const byField = Object.fromEntries(taxDeductibleSpending(budget).map((d) => [d.field, d.amount]));
  assert.equal(byField.rentPaid, 300000);
  assert.equal(byField.sec80C, 140000); // 60,000 ELSS + 50,000 PPF + 30,000 life
  assert.equal(byField.sec80DSelf, 18000);
  assert.equal(byField.sec80CCD1B, 24000);
});

test('applying deductions only changes what differs, and turns on salary for rent', () => {
  const budget = withAmounts({ rent: 25000, elss: 5000 });
  const draft = { sec80C: 60000, rentPaid: 0, sources: { salary: false } };
  const changes = deductionChanges(draft, taxDeductibleSpending(budget));
  assert.deepEqual(changes.map((c) => c.field), ['rentPaid']);
  const next = applyDeductions(draft, changes);
  assert.equal(next.rentPaid, 300000);
  assert.equal(next.sources.salary, true);
  assert.equal(next.sec80C, 60000);
});

test('take-home estimate is income received less tax', () => {
  const result = computeTax({ fy: '2025-26', grossSalary: 1800000 });
  // 18,00,000 less 1,50,800 tax.
  assert.equal(estimateTakeHome(result).annual, 1649200);
  assert.equal(estimateTakeHome(computeTax({})).monthly, 0);
});

test('typed take-home overrides the estimate', () => {
  const result = computeTax({ fy: '2025-26', grossSalary: 1800000 });
  assert.equal(monthlyIncome({ incomeMode: 'manual', manualIncome: 120000 }, result), 120000);
  assert.ok(Math.abs(monthlyIncome({ incomeMode: 'estimate' }, result) - 1649200 / 12) < 0.01);
});

test('insights call out overspending first and 80C above its limit', () => {
  const over = budgetInsights(summarizeBudget(withAmounts({ rent: 90000, shopping: 30000 }), 100000), withAmounts({ rent: 90000, shopping: 30000 }), '2026-27');
  assert.equal(over[0].tone, 'error');
  const heavy80C = withAmounts({ ppf: 150000, life: 60000, sip: 30000, emergency: 5000 });
  const notes = budgetInsights(summarizeBudget(heavy80C, 100000), heavy80C, '2026-27');
  assert.ok(notes.some((n) => n.title.includes('80C')));
});

test('a balanced budget gets a positive note', () => {
  const budget = withAmounts({ rent: 30000, dining: 10000, sip: 20000, emergency: 5000 });
  const notes = budgetInsights(summarizeBudget(budget, 100000), budget, '2026-27');
  assert.equal(notes[0].tone, 'success');
});

test('CSV lists only items with amounts and neutralises formulas', () => {
  const budget = withAmounts({ rent: 25000 });
  budget.items = [...budget.items, { id: 'x', group: 'wants', label: '=cmd()', amount: 100, frequency: 'monthly', tax: null }];
  const csv = budgetCsv(budget, summarizeBudget(budget, 100000));
  assert.ok(csv.includes('Rent,Needs,monthly,25000,25000,HRA'));
  assert.ok(csv.includes("'=cmd()"));
  assert.ok(!csv.includes('Groceries'));
});

/* ── Investment returns ──────────────────────────── */

test('PPF: 1.5 lakh a year for 15 years at 7.1% matches the published figure', () => {
  // PPF calculators give ₹40,68,209 for this case.
  const { invested, value } = futureValue(150000, 'yearly', 0.071, 15);
  assert.equal(invested, 2250000);
  assert.equal(Math.round(value), 4068209);
});

test('monthly SIP matches a month-by-month simulation', () => {
  const monthlyRate = 1.12 ** (1 / 12) - 1;
  let balance = 0;
  for (let month = 0; month < 120; month++) balance = (balance + 10000) * (1 + monthlyRate);
  const { invested, value } = futureValue(10000, 'monthly', 0.12, 10);
  assert.equal(invested, 1200000);
  assert.ok(Math.abs(value - balance) < 0.01);
});

test('a zero return gives back exactly what was put in', () => {
  assert.equal(futureValue(5000, 'monthly', 0, 3).value, 180000);
});

test('default return types follow the item, custom items assume debt', () => {
  assert.equal(returnTypeFor({ id: 'sip' }), 'equity');
  assert.equal(returnTypeFor({ id: 'ppf' }), 'ppf');
  assert.equal(returnTypeFor({ id: 'emergency' }), 'cash');
  assert.equal(returnTypeFor({ id: 'custom-1' }), 'debt');
  assert.equal(returnTypeFor({ id: 'sip', returnType: 'nps' }), 'nps');
});

test('projection totals, range ordering and today\'s money', () => {
  const budget = withAmounts({ sip: 10000, ppf: 150000, rent: 25000 });
  const p = projectInvestments(budget, 15);
  assert.equal(p.items.length, 2); // Rent is spending, not an investment.
  assert.equal(p.invested, 10000 * 180 + 150000 * 15);
  assert.ok(p.low < p.avg && p.avg < p.high);
  assert.equal(Math.round(p.growth), Math.round(p.avg - p.invested));
  assert.ok(Math.abs(p.todaysMoney - p.afterTax / 1.06 ** 15) < 0.01);
  // The blended rate sits between PPF's 7.1% and equity's 12%.
  assert.ok(p.blendedRate > 0.071 && p.blendedRate < 0.12);
});

test('the yearly path ends at the projected value', () => {
  const p = projectInvestments(withAmounts({ sip: 10000, nps: 5000 }), 10);
  assert.equal(p.path.length, 10);
  assert.ok(Math.abs(p.path.at(-1).value - p.avg) < 0.01);
  assert.ok(p.path.every((point, i) => i === 0 || point.value > p.path[i - 1].value));
});

test('no investments, no projection', () => {
  const p = projectInvestments(withAmounts({ rent: 25000 }), 10);
  assert.equal(p.items.length, 0);
  assert.equal(p.avg, 0);
  assert.equal(p.blendedRate, 0);
});

/* ── Tax on returns ──────────────────────────────── */

const item = (id, type, invested, avg) => ({ id, type, invested, low: avg, avg, high: avg });

test('equity: 12.5% plus cess on gains above ₹1.25 lakh', () => {
  // SIP of 10,000 a month for 10 years at 12%: 22,40,359 from 12,00,000 put in.
  const { value, invested } = futureValue(10000, 'monthly', 0.12, 10);
  const { total } = taxOnReturns([item('sip', 'equity', invested, value)], 'avg', 0.312);
  const gain = value - invested;
  assert.ok(Math.abs(total - (gain - 125000) * 0.125 * 1.04) < 0.01);
  assert.equal(Math.round(total), 118997);
});

test('the equity exemption is shared, not given to each fund', () => {
  const one = taxOnReturns([item('a', 'equity', 100000, 300000)], 'avg', 0.3).total;
  const split = taxOnReturns([item('a', 'equity', 50000, 150000), item('b', 'equity', 50000, 150000)], 'avg', 0.3);
  assert.ok(Math.abs(split.total - one) < 0.01);
  assert.ok(Math.abs(split.perItem.a - split.perItem.b) < 0.01);
});

test('equity gains under ₹1.25 lakh are tax-free', () => {
  assert.equal(taxOnReturns([item('a', 'equity', 100000, 220000)], 'avg', 0.3).total, 0);
});

test('PPF is tax-free, debt and cash are taxed at the slab rate', () => {
  const r = taxOnReturns([
    item('ppf', 'ppf', 100000, 200000),
    item('fd', 'debt', 100000, 150000),
    item('cash', 'cash', 100000, 110000),
  ], 'avg', 0.208);
  assert.equal(r.perItem.ppf, 0);
  assert.ok(Math.abs(r.perItem.fd - 50000 * 0.208) < 0.01);
  assert.ok(Math.abs(r.perItem.cash - 10000 * 0.208) < 0.01);
});

test('NPS: only the part beyond the tax-free 60% is taxed', () => {
  const r = taxOnReturns([item('nps', 'nps', 600000, 1000000)], 'avg', 0.312);
  assert.ok(Math.abs(r.total - 1000000 * 0.4 * 0.312) < 0.01);
});

test('a loss is never taxed', () => {
  assert.equal(taxOnReturns([item('fd', 'debt', 100000, 90000)], 'avg', 0.3).total, 0);
});

test('marginal rate is read from the tax computation, cess included', () => {
  // 18 lakh salary, new regime: taxable 17.25 lakh sits in the 20% band.
  const rate = marginalRate(computeTax({ fy: '2026-27', grossSalary: 1800000 }));
  assert.ok(Math.abs(rate - 0.208) < 1e-9);
  assert.equal(marginalRate(computeTax({ fy: '2026-27', grossSalary: 500000 })), 0);
  assert.equal(marginalRate(computeTax({})), null);
});

test('marginal rate is capped where marginal relief would push it over 31.2%', () => {
  const rate = marginalRate(computeTax({ fy: '2026-27', grossSalary: 1275000 }));
  assert.ok(rate <= 0.312 + 1e-9);
});

test('projection after tax, range and harvesting', () => {
  const budget = withAmounts({ sip: 10000, ppf: 150000, emergency: 5000 });
  const p = projectInvestments(budget, 10, { slabRate: 0.312 });
  assert.ok(Math.abs(p.afterTax - (p.avg - p.tax)) < 0.01);
  assert.ok(p.afterTaxLow < p.afterTax && p.afterTax < p.afterTaxHigh);
  assert.equal(p.items.find((i) => i.id === 'ppf').tax, 0);
  assert.ok(p.harvestSaving > 0 && p.harvestSaving <= p.equityTax);
  // Ten years of ₹1.25 lakh exemptions: 10,40,359 gain less 12,50,000 leaves no tax.
  assert.ok(Math.abs(p.harvestSaving - p.equityTax) < 0.01);
});
