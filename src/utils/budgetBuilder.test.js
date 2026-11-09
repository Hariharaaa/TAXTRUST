import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ITEMS, monthlyAmount, summarizeBudget } from './budget.js';
import { applyBuiltBudget, buildBudget } from './budgetBuilder.js';

const prefs = (extra = {}) => ({ household: 'single', housing: 'rent', housingAmount: 25000, plan: 'balanced', ...extra });
const build = (income, extra = {}, tax = null, items = DEFAULT_ITEMS) => buildBudget({ income, prefs: prefs(extra), items, tax });
const summary = (income, built, items = DEFAULT_ITEMS) => summarizeBudget({ items: applyBuiltBudget(items, built.amounts) }, income);

test('balanced plan lands close to 50/30/20 without going over income', () => {
  const built = build(150000);
  const s = summary(150000, built);
  assert.ok(s.outflow <= 150000);
  assert.ok(s.outflow > 150000 - 3000); // Only rounding is left over.
  assert.ok(Math.abs(s.totals.needs - 75000) < 1500);
  assert.ok(Math.abs(s.totals.wants - 45000) < 1500);
  assert.ok(Math.abs(s.totals.savings - 30000) < 1500);
});

test('rent is used exactly as given', () => {
  assert.equal(build(150000).amounts.rent, 25000);
  assert.equal(build(150000, { housing: 'loan', housingAmount: 32000 }).amounts['home-emi'], 32000);
  const own = build(150000, { housing: 'own', housingAmount: 99999 });
  assert.equal(own.amounts.rent, 0);
  assert.equal(own.amounts['home-emi'], 0);
});

test('saver plan puts 30% into savings', () => {
  const s = summary(100000, build(100000, { plan: 'saver' }));
  assert.ok(Math.abs(s.totals.savings - 30000) < 1000);
});

test('insurance stays at sensible yearly amounts at high incomes', () => {
  const built = build(500000, { housing: 'own' });
  assert.ok(built.amounts.health <= 25000);
  assert.ok(built.amounts['health-parents'] <= 25000);
  assert.ok(built.amounts.life <= 25000);
  // The money above the caps went to other needs, not nowhere.
  const s = summary(500000, built);
  assert.ok(Math.abs(s.totals.needs - 250000) < 2500);
});

test('seniors get the higher 80D limit', () => {
  const built = build(500000, { housing: 'own' }, { recommended: 'new', fy: '2026-27', senior: true, parentsSenior: true });
  assert.ok(built.amounts.health > 25000 && built.amounts.health <= 50000);
});

test('only families get tuition fees', () => {
  assert.equal(build(150000).amounts.tuition, 0);
  assert.ok(build(150000, { household: 'family' }).amounts.tuition > 0);
});

test('old regime: ELSS fills 80C room after insurance and tuition', () => {
  const built = build(150000, { household: 'family' }, { recommended: 'old', fy: '2026-27' });
  assert.ok(built.amounts.elss > 0);
  assert.equal(built.amounts.ppf, 0);
  const eightyC = built.amounts.life + built.amounts.tuition + built.amounts.elss * 12;
  assert.ok(eightyC <= 150000);
});

test('new regime: no ELSS, PPF and SIP instead', () => {
  const built = build(150000, {}, { recommended: 'new', fy: '2026-27' });
  assert.equal(built.amounts.elss, 0);
  assert.ok(built.amounts.ppf > 0);
  assert.ok(built.amounts.sip > built.amounts.ppf / 12);
});

test('NPS stays within the 80CCD(1B) yearly limit', () => {
  assert.ok(build(1000000, { housing: 'own' }).amounts.nps * 12 <= 50000);
});

test('expensive housing squeezes wants first, with a warning', () => {
  const built = build(80000, { housingAmount: 50000 });
  const s = summary(80000, built);
  assert.ok(s.outflow <= 80000);
  assert.ok(s.totals.wants < 80000 * 0.3);
  assert.ok(built.warnings.some((w) => w.includes('Housing takes')));
});

test('housing above income is flagged and nothing goes negative', () => {
  const built = build(40000, { housingAmount: 60000 });
  assert.ok(built.warnings.some((w) => w.includes('more than your take-home')));
  assert.ok(Object.values(built.amounts).every((v) => v >= 0));
});

test('your own expenses are kept and counted first', () => {
  const items = [...DEFAULT_ITEMS, { id: 'gym', group: 'wants', label: 'Gym', amount: 5000, frequency: 'monthly', tax: null }];
  const built = build(150000, {}, null, items);
  const applied = applyBuiltBudget(items, built.amounts);
  assert.equal(applied.find((i) => i.id === 'gym').amount, 5000);
  const s = summarizeBudget({ items: applied }, 150000);
  assert.ok(Math.abs(s.totals.wants - 45000) < 1500); // Gym included in the 30%.
});

test('yearly items come out as yearly amounts', () => {
  const built = build(150000);
  assert.equal(built.amounts.health % 1000, 0);
  const item = DEFAULT_ITEMS.find((i) => i.id === 'health');
  assert.equal(item.frequency, 'yearly');
  assert.ok(monthlyAmount({ ...item, amount: built.amounts.health }) < 3000);
});

test('no income, no budget', () => {
  const built = build(0);
  assert.deepEqual(built.amounts, {});
  assert.ok(built.warnings.length > 0);
});

test('the emergency fund is built in a few years, and long builds read in years', () => {
  const note = (plan) => build(137433, { household: 'couple', housingAmount: 28000, plan }).notes.find((n) => n.startsWith('Emergency fund'));
  // Six months of needs at 40% of savings: about 25 months on Saver, 38 on Balanced.
  assert.ok(note('saver').includes('about 2 years'), note('saver'));
  assert.ok(note('balanced').includes('about 3 years'), note('balanced'));
});
