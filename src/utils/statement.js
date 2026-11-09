/**
 * The Statement of Computation of Total Income: one row per line, with both
 * regimes side by side. Screen, print and CSV all read these rows, so they
 * cannot drift apart.
 */

import { getRules, sectionRef } from './taxRules.js';

export function statementRows(result) {
  const { oldRegime: o, newRegime: n, input } = result;
  const rules = getRules(result.fy);
  const ref = (key) => (key ? sectionRef(key, rules) : '');
  const rows = [];

  const heading = (label) => rows.push({ kind: 'heading', label });
  const line = (label, oldValue, newValue, refKey, kind = 'line') => {
    rows.push({ kind, label, ref: ref(refKey), old: oldValue, new: newValue });
  };
  /** Skip lines that are zero in both regimes: a statement should not list what does not apply. */
  const lineIf = (label, oldValue, newValue, refKey, kind) => {
    if (oldValue !== 0 || newValue !== 0) line(label, oldValue, newValue, refKey, kind);
  };

  if (input.sources.salary) {
    heading('Income from salary');
    line('Gross salary', o.salary.gross, n.salary.gross, 'salary');
    lineIf('Less: HRA exemption', -o.salary.hraExempt, -n.salary.hraExempt, 'hra');
    line('Less: standard deduction', -o.salary.standardDeduction, -n.salary.standardDeduction, 'standardDeduction');
    lineIf('Less: professional tax', -o.salary.professionalTax, -n.salary.professionalTax, 'professionalTax');
    line('Income from salary', o.salary.income, n.salary.income, null, 'subtotal');
  }

  if (input.sources.property) {
    heading('Income from house property');
    if (input.rentReceived > 0) {
      line('Rent received', o.houseProperty.rent, n.houseProperty.rent, 'houseProperty');
      lineIf('Less: municipal taxes', -o.houseProperty.municipalTax, -n.houseProperty.municipalTax, 'houseProperty');
      line('Less: 30% standard deduction', -o.houseProperty.standardDeduction, -n.houseProperty.standardDeduction, 'houseProperty');
      lineIf('Less: interest on let-out property', -o.houseProperty.letOutInterest, -n.houseProperty.letOutInterest, 'homeLoanInterest');
    }
    lineIf('Less: interest on self-occupied home', -o.houseProperty.selfOccupiedInterest, -n.houseProperty.selfOccupiedInterest, 'homeLoanInterest');
    lineIf('Add back: loss carried forward', o.houseProperty.lossCarriedForward, n.houseProperty.lossCarriedForward, 'lossSetOff');
    line('Income from house property', o.houseProperty.income, n.houseProperty.income, null, 'subtotal');
  }

  if (input.sources.business) {
    const presumptive = o.business.method === 'presumptive';
    heading('Profits from business or profession');
    line('Gross receipts', o.business.receipts, n.business.receipts, presumptive ? 'presumptive' : 'profits');
    if (!presumptive) line('Less: expenses', -input.bizExpenses, -input.bizExpenses, 'profits');
    line(presumptive ? 'Profit declared' : 'Business income', o.business.income, n.business.income, null, 'subtotal');
  }

  if (input.sources.capitalGains) {
    heading('Capital gains');
    lineIf('Short-term, equity (20%)', o.capitalGains.stcgEquity, n.capitalGains.stcgEquity, 'stcgEquity');
    lineIf('Short-term, other (slab rate)', o.capitalGains.stcgOther, n.capitalGains.stcgOther, 'capitalGains');
    lineIf('Long-term, equity, gross', o.capitalGains.ltcgEquityGross, n.capitalGains.ltcgEquityGross, 'ltcgEquity');
    lineIf('Less: annual equity exemption', -o.capitalGains.ltcgEquityExempt, -n.capitalGains.ltcgEquityExempt, 'ltcgEquity');
    lineIf('Long-term, other (12.5%)', o.capitalGains.ltcgOther, n.capitalGains.ltcgOther, 'ltcgOther');
    const gains = (r) => r.capitalGains.stcgOther + r.specialIncome;
    line('Capital gains', gains(o), gains(n), null, 'subtotal');
  }

  if (input.sources.otherIncome) {
    heading('Income from other sources');
    lineIf('Savings account interest', input.savingsInterest, input.savingsInterest, 'otherSources');
    lineIf('Fixed deposit interest', input.fdInterest, input.fdInterest, 'otherSources');
    lineIf('Dividends', input.dividends, input.dividends, 'otherSources');
    lineIf('Other income', input.otherIncome, input.otherIncome, 'otherSources');
    line('Income from other sources', o.otherSources, n.otherSources, null, 'subtotal');
  }

  line('Gross total income', o.grossTotalIncome, n.grossTotalIncome, null, 'total');

  const newByKey = Object.fromEntries(n.deductions.items.map((item) => [item.key, item]));
  const deductions = o.deductions.items.filter((item) => item.allowed > 0 || (newByKey[item.key]?.allowed ?? 0) > 0);
  if (deductions.length > 0) {
    heading('Deductions from gross total income');
    for (const item of deductions) {
      line(item.label, -item.allowed, -(newByKey[item.key]?.allowed ?? 0), item.refKey);
    }
    const unused = o.deductions.requested - o.deductions.total;
    const unusedNew = n.deductions.requested - n.deductions.total;
    lineIf('Add back: deductions beyond eligible income', unused, unusedNew, null);
  }

  line('Total income (rounded to ₹10)', o.totalIncome, n.totalIncome, 'rounding', 'total');

  heading('Tax computation');
  line('Tax at slab rates', o.normalTax, n.normalTax, null);
  lineIf('Tax on special-rate income', o.specialTax, n.specialTax, null);
  lineIf('Less: rebate', -o.rebate, -n.rebate, 'rebate');
  lineIf('Less: marginal relief on rebate', -o.rebateMarginalRelief, -n.rebateMarginalRelief, 'rebate');
  lineIf('Add: surcharge', o.surcharge.gross, n.surcharge.gross, null);
  lineIf('Less: marginal relief on surcharge', -o.surcharge.relief, -n.surcharge.relief, null);
  line(`Add: health and education cess (${rules.cessRate * 100}%)`, o.cess, n.cess, null);
  line('Total tax liability', o.totalTax, n.totalTax, null, 'total');

  const balanceFor = (regime) => Math.round((regime.totalTax - result.credits) / 10) * 10;
  if (result.credits > 0) {
    heading('Taxes already paid');
    lineIf('Less: TDS', -input.tds, -input.tds, null);
    lineIf('Less: TCS', -input.tcs, -input.tcs, null);
    lineIf('Less: advance tax', -input.advanceTax, -input.advanceTax, null);
    lineIf('Less: self-assessment tax', -input.selfAssessmentTax, -input.selfAssessmentTax, null);
  }

  // Always end on the figure the person actually has to pay, or gets back.
  const payableLabel = result.credits > 0 ? 'Total tax payable / (refund)' : 'Total tax payable';
  line(`${payableLabel}, rounded to ₹10`, balanceFor(o), balanceFor(n), 'roundingTax', 'grand');

  return rows;
}

/** Stop a spreadsheet treating a typed name as a formula. */
function csvCell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function statementCsv(result, sealed = null) {
  const rules = getRules(result.fy);
  const meta = [
    ['Statement of computation of total income'],
    ['Assessee', result.input.name],
    ['PAN', result.input.pan],
    ['Year', `${rules.label} (${rules.sublabel})`],
    ['Filing under', `${result.filingRegime === 'old' ? 'Old' : 'New'} regime`],
    ['Status', sealed ? `Sealed, hash ${sealed.hash}` : 'Draft, not sealed'],
    [result.balance < 0 ? 'Refund due (₹)' : 'Total tax payable (₹)', Math.abs(result.balance)],
    [],
    ['Particulars', 'Reference', 'Old regime (₹)', 'New regime (₹)'],
  ];
  const body = statementRows(result).map((row) => (
    row.kind === 'heading' ? [row.label] : [row.label, row.ref, Math.round(row.old), Math.round(row.new)]
  ));
  return [...meta, ...body]
    .map((row) => row.map((cell, i) => (typeof cell === 'number' && i > 0 ? cell : csvCell(cell))).join(','))
    .join('\n');
}
