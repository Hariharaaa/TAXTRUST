/** Audit applicability, deadlines, advance tax, suggestions, the chain and the statement. */

import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { computeTax } from './taxCalculator.js';
import { advanceTaxPlan, auditCheck, buildReview, filingPlan, itrForm, reviewFlags } from './compliance.js';
import { breakEvenDeduction, generateSuggestions } from './insightsEngine.js';
import { appendToChain, computeHash, exportChain, getHistory, parseChainFile, verifyChain } from './hashChain.js';
import { statementCsv, statementRows } from './statement.js';

const FY = '2025-26';
const biz = (extra) => computeTax({ fy: FY, sources: { salary: false, business: true }, ...extra });

test('no business income means no audit', () => {
  assert.equal(auditCheck(computeTax({ fy: FY, grossSalary: 2000000 })).status, 'none');
});

test('profession: 44ADA up to 75 lakh when cash is 5% or less', () => {
  const result = biz({ bizType: 'profession', bizReceipts: 6000000, bizCashReceipts: 100000 });
  assert.equal(auditCheck(result).status, 'not-required');
});

test('profession: the higher limit does not apply with more cash', () => {
  const result = biz({ bizType: 'profession', bizReceipts: 6000000, bizCashReceipts: 1000000 });
  assert.equal(auditCheck(result).status, 'required');
});

test('profession: declaring below 50% with taxable income needs an audit', () => {
  const result = biz({ bizType: 'profession', bizReceipts: 3000000, bizDeclaredProfit: 1000000 });
  assert.equal(auditCheck(result).status, 'required');
});

test('profession: declaring below 50% under the exemption needs no audit', () => {
  const result = biz({ bizType: 'profession', bizReceipts: 500000, bizDeclaredProfit: 100000 });
  assert.equal(auditCheck(result).status, 'not-required');
});

test('business on books: 1 crore limit, or 10 crore with little cash', () => {
  const common = { bizType: 'business', bizScheme: 'books', bizReceipts: 15000000, bizExpenses: 12000000 };
  assert.equal(auditCheck(biz({ ...common, bizCashReceipts: 3000000 })).status, 'required');
  assert.equal(auditCheck(biz({ ...common, bizCashReceipts: 300000, bizCashPayments: 300000 })).status, 'not-required');
  assert.equal(auditCheck(biz({ ...common, bizCashReceipts: 300000, bizCashPayments: 3000000 })).status, 'required');
});

test('business presumptive: within 3 crore with low cash, no audit', () => {
  const result = biz({ bizType: 'business', bizReceipts: 25000000, bizCashReceipts: 500000 });
  assert.equal(auditCheck(result).status, 'not-required');
});

test('return form follows the income', () => {
  const form = (result) => itrForm(result, auditCheck(result)).form;
  assert.equal(form(computeTax({ fy: FY, grossSalary: 1500000 })), 'ITR-1');
  assert.equal(form(computeTax({ fy: FY, grossSalary: 6000000 })), 'ITR-2');
  assert.equal(form(computeTax({ fy: FY, sources: { salary: true, capitalGains: true }, grossSalary: 900000, stcgEquity: 50000 })), 'ITR-2');
  assert.equal(form(computeTax({ fy: FY, sources: { salary: true, capitalGains: true }, grossSalary: 900000, ltcgEquity: 100000 })), 'ITR-1');
  assert.equal(form(biz({ bizReceipts: 3000000 })), 'ITR-4');
  assert.equal(form(biz({ bizScheme: 'books', bizReceipts: 3000000, bizExpenses: 1000000 })), 'ITR-3');
});

test('deadlines use the extended audit date and the August date for ITR-3/4', () => {
  const today = new Date(2026, 5, 1);
  const review = (result) => buildReview(result, today).plan.dueDate;
  assert.equal(review(computeTax({ fy: FY, grossSalary: 1500000 })), '2026-07-31');
  assert.equal(review(biz({ bizReceipts: 3000000 })), '2026-08-31');
  assert.equal(review(biz({ bizReceipts: 9000000 })), '2026-11-21');
});

test('filing late costs the fee and interest', () => {
  // Due 31 Jul 2026, filing 6 Nov 2026, tax 1,50,800 with 1,00,000 TDS.
  const result = computeTax({ fy: FY, grossSalary: 1800000, tds: 100000 });
  const audit = auditCheck(result);
  const plan = filingPlan(result, audit, itrForm(result, audit), new Date(2026, 10, 6));
  assert.equal(plan.isLate, true);
  assert.equal(plan.lateFee, 5000);
  // 234A: 50,800 for Aug, Sep, Oct, Nov (4 months) = 2,032.
  assert.equal(plan.interest234A, 2032);
  // 234B: 50,800 from 1 Apr to Nov (8 months, part month counted) = 4,064.
  assert.equal(plan.interest234B, 4064);
});

test('late fee is 1,000 at or below 5 lakh and nil below the exemption', () => {
  const planFor = (gross) => {
    const result = computeTax({ fy: FY, grossSalary: gross, filingRegime: 'old' });
    const audit = auditCheck(result);
    return filingPlan(result, audit, itrForm(result, audit), new Date(2026, 10, 6));
  };
  assert.equal(planFor(500000).lateFee, 1000);
  assert.equal(planFor(250000).lateFee, 0);
});

test('advance tax: not needed under 10,000 after TDS', () => {
  const plan = advanceTaxPlan(computeTax({ fy: '2026-27', grossSalary: 1800000, tds: 145000 }), new Date(2026, 10, 6));
  assert.equal(plan.applies, false);
});

test('advance tax: four instalments with what has passed marked', () => {
  const plan = advanceTaxPlan(computeTax({ fy: '2026-27', grossSalary: 1800000, tds: 50000 }), new Date(2026, 10, 6));
  assert.equal(plan.applies, true);
  assert.equal(plan.liability, 100800);
  assert.deepEqual(plan.rows.map((r) => r.cumulative), [15120, 45360, 75600, 100800]);
  assert.deepEqual(plan.rows.map((r) => r.passed), [true, true, false, false]);
  assert.equal(plan.next.cumulative, 75600);
});

test('advance tax: presumptive income has one March instalment', () => {
  const plan = advanceTaxPlan(biz({ fy: '2026-27', bizReceipts: 3000000 }), new Date(2026, 10, 6));
  assert.equal(plan.rows.length, 1);
  assert.equal(plan.rows[0].cumulative, 109200);
});

test('advance tax: above the presumptive limit, the normal instalments apply', () => {
  const plan = advanceTaxPlan(biz({ fy: '2026-27', bizReceipts: 9000000 }), new Date(2026, 10, 6));
  assert.equal(plan.rows.length, 4);
});

test('advance tax: seniors with no business are exempt', () => {
  const plan = advanceTaxPlan(computeTax({ fy: '2026-27', grossSalary: 1800000, age: 'senior' }), new Date(2026, 10, 6));
  assert.equal(plan.applies, false);
});

test('review flags catch inconsistent salary figures', () => {
  const result = computeTax({ fy: FY, grossSalary: 500000, basicSalary: 900000 });
  const titles = reviewFlags(result, auditCheck(result)).map((f) => f.title);
  assert.ok(titles.includes('Basic salary is more than gross salary'));
});

test('review flags surface an audit as an error first', () => {
  const result = biz({ bizReceipts: 9000000 });
  const flags = reviewFlags(result, auditCheck(result));
  assert.equal(flags[0].level, 'error');
});

test('suggestions never promise a saving the person would not get', () => {
  // Low deductions at 30 lakh: the new regime wins even with 80C filled, so no 80C tip.
  const suggestions = generateSuggestions(computeTax({ fy: FY, grossSalary: 3000000 }));
  assert.ok(!suggestions.some((s) => s.id === '80c'));
});

test('suggestions report the real saving from re-running the engine', () => {
  const result = computeTax({ fy: FY, grossSalary: 1000000, sec80C: 0, filingRegime: 'old' });
  for (const suggestion of generateSuggestions(result)) assert.ok(suggestion.saving > 0);
});

test('break-even deduction actually brings the regimes level', () => {
  const result = computeTax({ fy: FY, grossSalary: 2000000 });
  const needed = breakEvenDeduction(result);
  assert.ok(needed > 0);
  const after = computeTax({ fy: FY, grossSalary: 2000000, otherDeductions: needed });
  const before = computeTax({ fy: FY, grossSalary: 2000000, otherDeductions: needed - 1000 });
  assert.ok(after.oldRegime.totalTax <= after.newRegime.totalTax);
  assert.ok(before.oldRegime.totalTax > before.newRegime.totalTax);
});

test('statement rows tie to the engine', () => {
  const result = computeTax({ fy: FY, grossSalary: 1800000, tds: 100000 });
  const rows = statementRows(result);
  const row = (label) => rows.find((r) => r.label === label);
  assert.equal(row('Total tax liability').new, 150800);
  assert.equal(row('Total tax payable / (refund), rounded to ₹10').new, result.balance);
});

test('statement balance matches the rounded balance shown everywhere else', () => {
  const result = computeTax({ fy: FY, grossSalary: 1800000, tds: 100004 });
  const row = statementRows(result).find((r) => r.label.startsWith('Total tax payable'));
  assert.equal(row.new, result.balance);
  assert.equal(row.new % 10, 0);
});

test('an advance tax instalment stays open through its due date', () => {
  const result = computeTax({ fy: '2026-27', grossSalary: 1800000, tds: 50000 });
  const onTheDay = advanceTaxPlan(result, new Date(2026, 11, 15, 18, 0));
  assert.equal(onTheDay.next.cumulative, 75600);
  const dayAfter = advanceTaxPlan(result, new Date(2026, 11, 16, 9, 0));
  assert.equal(dayAfter.next.cumulative, 100800);
});

test('statement always ends on total tax payable, even with nothing paid yet', () => {
  const result = computeTax({ fy: FY, grossSalary: 1800000 });
  const rows = statementRows(result);
  const last = rows.at(-1);
  assert.equal(last.label, 'Total tax payable, rounded to ₹10');
  assert.equal(last.kind, 'grand');
  assert.equal(last.new, 150800);
  assert.equal(last.new, result.balance);
});

test('CSV carries the total tax payable', () => {
  const csv = statementCsv(computeTax({ fy: FY, grossSalary: 1800000, tds: 100000 }));
  assert.ok(csv.includes('Total tax payable (₹),50800'));
});

test('statement lines add up from gross total income to total income', () => {
  const result = computeTax({ fy: FY, grossSalary: 1800000, sec80C: 150000 });
  const rows = statementRows(result);
  const gti = rows.find((r) => r.label === 'Gross total income');
  const start = rows.indexOf(gti);
  const end = rows.findIndex((r) => r.label.startsWith('Total income'));
  const adjustments = rows.slice(start + 1, end).filter((r) => r.kind === 'line').reduce((sum, r) => sum + r.old, 0);
  assert.equal(gti.old + adjustments, rows[end].old);
});

test('FY 2026-27 statement cites the 2025 Act', () => {
  const rows = statementRows(computeTax({ fy: '2026-27', grossSalary: 1800000, sec80C: 100000 }));
  assert.ok(rows.find((r) => r.label === 'Section 80C investments').ref.includes('s.123'));
});

test('CSV neutralises a formula typed as a name', () => {
  const csv = statementCsv(computeTax({ fy: FY, grossSalary: 1000000, name: '=HYPERLINK("x")' }));
  assert.ok(csv.includes(`"'=HYPERLINK(""x"")"`));
});

/* ── Audit chain ─────────────────────────────────── */

beforeEach(() => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
  };
});

async function chainOfThree() {
  for (const gross of [1000000, 1500000, 2000000]) {
    await appendToChain(computeTax({ fy: FY, grossSalary: gross }));
  }
  return getHistory();
}

test('an untouched chain verifies', async () => {
  const report = await verifyChain(await chainOfThree());
  assert.equal(report.valid, true);
  assert.equal(report.verifiedCount, 3);
});

test('editing a saved figure breaks exactly that record', async () => {
  const chain = await chainOfThree();
  chain[1].data.summary.totalTax = 1;
  const report = await verifyChain(chain);
  assert.equal(report.valid, false);
  assert.equal(report.brokenAt, 1);
  assert.equal(report.records[1].hashOk, false);
  assert.equal(report.records[0].hashOk, true);
  assert.equal(report.records[2].hashOk, true);
});

test('re-hashing a forged figure still fails the recomputation and the link', async () => {
  const chain = await chainOfThree();
  chain[1].data.summary.newTax = 1;
  chain[1].hash = await computeHash(chain[1], chain[1].previousHash);
  const report = await verifyChain(chain);
  assert.equal(report.valid, false);
  assert.equal(report.records[1].recompute, 'mismatch');
  assert.equal(report.records[2].linkOk, false);
});

test('the shared head hash catches deleted records and a fully rewritten chain', async () => {
  const chain = await chainOfThree();
  const head = chain.at(-1).hash;
  const truncated = chain.slice(0, 2);
  const alone = await verifyChain(truncated);
  assert.equal(alone.valid, true); // Shows why the head hash matters.
  const anchored = await verifyChain(truncated, { expectedHead: head });
  assert.equal(anchored.valid, false);
  assert.equal(anchored.headMatches, false);
});

test('records from the first app version still verify', async () => {
  const data = { inputs: { grossSalary: 800000 }, oldRegimeTax: 1, newRegimeTax: 2, recommended: 'old' };
  const record = { id: 'legacy', timestamp: '2025-07-12T00:00:00.000Z', data };
  const previousHash = '0'.repeat(64);
  const hash = await computeHash(record, previousHash);
  const report = await verifyChain([{ ...record, hash, previousHash }]);
  assert.equal(report.valid, true);
  assert.equal(report.records[0].recompute, 'legacy');
});

test('export round-trips and rejects other files', async () => {
  const chain = await chainOfThree();
  const parsed = parseChainFile(exportChain(chain));
  assert.equal(parsed.count, 3);
  assert.equal((await verifyChain(parsed.records)).valid, true);
  assert.throws(() => parseChainFile('{"hello":1}'), /not a TaxTrust/);
  assert.throws(() => parseChainFile('not json'), /not valid JSON/);
});
