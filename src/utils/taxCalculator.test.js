/**
 * Golden cases. Every expected figure below was worked by hand from the rate
 * tables, not copied from the engine's output. Run with `npm test`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { computeTax } from './taxCalculator.js';

const FY = '2025-26';
const salary = (grossSalary, extra = {}) => computeTax({ fy: FY, grossSalary, ...extra });

test('new regime: income up to the rebate limit is tax free', () => {
  const r = salary(1275000).newRegime;
  assert.equal(r.totalIncome, 1200000);
  assert.equal(r.normalTax, 60000);
  assert.equal(r.rebate, 60000);
  assert.equal(r.totalTax, 0);
});

test('new regime: marginal relief just above the rebate limit', () => {
  // Taxable 12,25,000. Slab tax 63,750, but tax is capped at the 25,000 excess.
  const r = salary(1300000).newRegime;
  assert.equal(r.totalIncome, 1225000);
  assert.equal(r.normalTax, 63750);
  assert.equal(r.rebateMarginalRelief, 38750);
  assert.equal(r.taxAfterRebate, 25000);
  assert.equal(r.totalTax, 26000);
});

test('new regime: marginal relief ends at the known break-even', () => {
  const below = salary(1270580 + 75000).newRegime;
  const above = salary(1270600 + 75000).newRegime;
  assert.ok(below.rebateMarginalRelief > 0);
  assert.equal(above.rebateMarginalRelief, 0);
});

test('new regime: ordinary salary', () => {
  // Taxable 17,25,000: 20k + 40k + 60k + 25k = 1,45,000 + 4% cess.
  assert.equal(salary(1800000).newRegime.totalTax, 150800);
});

test('old regime: salary with 80C', () => {
  // 10L - 50k SD - 1.5L = 8L. 12,500 + 60,000 = 72,500 + 4% cess.
  const r = salary(1000000, { sec80C: 150000 }).oldRegime;
  assert.equal(r.totalIncome, 800000);
  assert.equal(r.totalTax, 75400);
});

test('old regime: 80C above the cap only counts up to the cap', () => {
  const r = salary(1000000, { sec80C: 400000 }).oldRegime;
  assert.equal(r.totalIncome, 800000);
});

test('old regime: rebate wipes tax at exactly 5 lakh, not above it', () => {
  assert.equal(salary(550000).oldRegime.totalTax, 0);
  // 5,00,010: tax 12,500 + 2 ... no rebate, so cess applies to all of it.
  assert.equal(salary(550010).oldRegime.totalTax, 13002);
});

test('old regime: exemption rises with age', () => {
  // Total income 6L in each case.
  assert.equal(salary(650000).oldRegime.totalTax, 33800); // 12,500 + 20,000 + cess
  assert.equal(salary(650000, { age: 'senior' }).oldRegime.totalTax, 31200); // 10,000 + 20,000 + cess
  assert.equal(salary(650000, { age: 'superSenior' }).oldRegime.totalTax, 20800); // 20,000 + cess
});

test('age does not change new regime slabs', () => {
  assert.equal(salary(1800000, { age: 'superSenior' }).newRegime.totalTax, 150800);
});

test('surcharge at 10% above 50 lakh', () => {
  // Taxable 60L: 3,00,000 up to 24L + 10,80,000 on 36L = 13,80,000.
  const r = salary(6075000).newRegime;
  assert.equal(r.normalTax, 1380000);
  assert.equal(r.surcharge.net, 138000);
  assert.equal(r.totalTax, 1578720);
});

test('surcharge marginal relief just above 50 lakh', () => {
  // Taxable 50,10,000: tax 10,83,000. Payable is capped at 10,80,000 + 10,000.
  const r = salary(5085000).newRegime;
  assert.equal(r.normalTax, 1083000);
  assert.equal(r.surcharge.gross, 108300);
  assert.equal(r.surcharge.net, 7000);
  assert.equal(r.totalTax, 1133600);
});

test('new regime surcharge is capped at 25%', () => {
  const r = salary(100000000);
  assert.equal(r.newRegime.surcharge.rate, 0.25);
  assert.equal(r.oldRegime.surcharge.rate, 0.37);
});

test('HRA exemption takes the lowest of the three tests', () => {
  const inputs = { basicSalary: 400000, hraReceived: 300000, rentPaid: 360000 };
  assert.equal(salary(1000000, inputs).oldRegime.salary.hraExempt, 160000);
  assert.equal(salary(1000000, { ...inputs, isMetro: true }).oldRegime.salary.hraExempt, 200000);
  assert.equal(salary(1000000, { ...inputs, hraReceived: 150000 }).oldRegime.salary.hraExempt, 150000);
});

test('HRA is not exempt under the new regime', () => {
  const r = salary(1000000, { basicSalary: 400000, hraReceived: 300000, rentPaid: 360000 });
  assert.equal(r.newRegime.salary.hraExempt, 0);
});

test('HRA without a basic salary gives no exemption rather than guessing', () => {
  const r = salary(1000000, { hraReceived: 300000, rentPaid: 360000 });
  assert.equal(r.oldRegime.salary.hraExempt, 0);
});

test('presumptive profession: 50% of receipts, no standard deduction', () => {
  const r = computeTax({
    fy: FY,
    sources: { salary: false, business: true },
    bizType: 'profession',
    bizReceipts: 3000000,
  }).newRegime;
  assert.equal(r.business.income, 1500000);
  assert.equal(r.totalTax, 109200); // 20k + 40k + 45k = 1,05,000 + cess
});

test('presumptive business: 8% of cash and 6% of digital receipts', () => {
  const r = computeTax({
    fy: FY,
    sources: { salary: false, business: true },
    bizType: 'business',
    bizReceipts: 10000000,
    bizCashReceipts: 2000000,
  }).newRegime;
  assert.equal(r.business.income, 640000); // 1,60,000 + 4,80,000
});

test('equity LTCG: rebate does not reach special-rate tax', () => {
  // Salary 10.75L, LTCG 3.25L. Slab tax 40,000 is rebated; 12.5% on 2L stays.
  const r = computeTax({
    fy: FY,
    sources: { salary: true, capitalGains: true },
    grossSalary: 1075000,
    ltcgEquity: 325000,
  }).newRegime;
  assert.equal(r.totalIncome, 1200000);
  assert.equal(r.normalTax, 40000);
  assert.equal(r.rebate, 40000);
  assert.equal(r.specialTax, 25000);
  assert.equal(r.totalTax, 26000);
});

test('unused basic exemption reduces special-rate gains', () => {
  // No other income: 2.5L of the 3L gain is covered, 20% on 50k, then rebate.
  const r = computeTax({ fy: FY, sources: { salary: false, capitalGains: true }, stcgEquity: 300000 }).oldRegime;
  assert.equal(r.capitalGains.stcgEquity, 300000);
  assert.equal(r.specialTax, 10000);
  assert.equal(r.totalTax, 0);
});

test('let-out loss: only 2 lakh sets off under the old regime, none under the new', () => {
  const r = computeTax({
    fy: FY,
    sources: { salary: true, property: true },
    grossSalary: 2000000,
    rentReceived: 300000,
    letOutInterest: 500000,
  });
  assert.equal(r.oldRegime.houseProperty.income, -200000);
  assert.equal(r.oldRegime.houseProperty.lossCarriedForward, 90000);
  assert.equal(r.newRegime.houseProperty.income, 0);
});

test('self-occupied home loan interest counts only under the old regime', () => {
  const r = computeTax({
    fy: FY,
    sources: { salary: true, property: true },
    grossSalary: 1500000,
    homeLoanInterest: 350000,
  });
  assert.equal(r.oldRegime.houseProperty.selfOccupiedInterest, 200000);
  assert.equal(r.newRegime.houseProperty.selfOccupiedInterest, 0);
});

test('80D has separate limits for self and parents', () => {
  const r = salary(1500000, { sec80DSelf: 40000, sec80DParents: 60000, parentsSenior: true }).oldRegime;
  const allowed = Object.fromEntries(r.deductions.items.map((i) => [i.key, i.allowed]));
  assert.equal(allowed.sec80DSelf, 25000);
  assert.equal(allowed.sec80DParents, 50000);
});

test('employer NPS is deductible in both regimes at different caps', () => {
  const r = salary(2000000, { basicSalary: 1000000, employerNps: 200000 });
  const allowed = (regime) => regime.deductions.items.find((i) => i.key === 'sec80CCD2').allowed;
  assert.equal(allowed(r.oldRegime), 100000);
  assert.equal(allowed(r.newRegime), 140000);
});

test('savings interest relief: 80TTA below 60, 80TTB for seniors', () => {
  const inputs = { sources: { salary: true, otherIncome: true }, savingsInterest: 20000, fdInterest: 60000 };
  const allowedFor = (age) => {
    const items = salary(1500000, { ...inputs, age }).oldRegime.deductions.items;
    return items.find((i) => i.key === 'sec80TTA' || i.key === 'sec80TTB').allowed;
  };
  assert.equal(allowedFor('below60'), 10000);
  assert.equal(allowedFor('senior'), 50000);
});

test('deductions cannot reduce special-rate income', () => {
  const r = computeTax({
    fy: FY,
    sources: { salary: true, capitalGains: true },
    grossSalary: 100000,
    stcgEquity: 500000,
    sec80C: 150000,
  }).oldRegime;
  assert.equal(r.deductions.total, 50000); // Only the 50k left after standard deduction.
  assert.equal(r.totalIncome, 500000);
});

test('total income rounds to the nearest 10', () => {
  assert.equal(salary(1234567 + 75000).newRegime.totalIncome, 1234570);
  assert.equal(salary(1234564 + 75000).newRegime.totalIncome, 1234560);
});

test('balance payable and refund round to the nearest 10', () => {
  const r = salary(1800000, { tds: 100000 });
  assert.equal(r.filingRegime, 'new');
  assert.equal(r.balance, 50800);
  assert.equal(salary(1800000, { tds: 200004 }).balance, -49200);
});

test('a tie recommends the new regime', () => {
  const r = salary(300000);
  assert.equal(r.oldRegime.totalTax, 0);
  assert.equal(r.newRegime.totalTax, 0);
  assert.equal(r.recommended, 'new');
});

test('the person can file under the regime that is not recommended', () => {
  const r = salary(1800000, { filingRegime: 'old' });
  assert.equal(r.recommended, 'new');
  assert.equal(r.chosen.regime, 'old');
});

test('a switched-off income source never affects the tax', () => {
  const r = computeTax({
    fy: FY,
    sources: { salary: true, capitalGains: false },
    grossSalary: 1000000,
    stcgEquity: 9000000,
  });
  assert.equal(r.newRegime.specialIncome, 0);
});

test('bad numbers are treated as zero', () => {
  const r = computeTax({ fy: FY, grossSalary: 'abc', sec80C: -5000, tds: NaN });
  assert.equal(r.hasIncome, false);
  assert.equal(r.credits, 0);
});

test('both supported years share slabs', () => {
  assert.equal(computeTax({ fy: '2026-27', grossSalary: 1800000 }).newRegime.totalTax, 150800);
});
