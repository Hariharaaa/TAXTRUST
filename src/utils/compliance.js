/**
 * The checks a CA runs around the computation itself: does a tax audit apply,
 * which return form fits, what is due when, and what looks wrong in the numbers.
 * Everything here reads a computeTax() result and never changes it.
 */

import { presumptiveTest } from './taxCalculator.js';
import { getRules, sectionRef } from './taxRules.js';
import { formatDate, inr } from './format.js';

const hasFlag = (level, title, detail, step) => ({ id: title, level, title, detail, step });

function basicExemption(result, rules) {
  return rules.slabs[result.filingRegime](result.input.age)[0].max;
}

/** Whether a statutory tax audit applies. */
export function auditCheck(result) {
  const { input, chosen } = result;
  const rules = getRules(result.fy);
  const a = rules.audit;
  const ref = sectionRef('audit', rules);

  if (!input.sources.business || input.bizReceipts === 0) {
    return {
      status: 'none',
      headline: 'No tax audit needed',
      reasons: ['A tax audit applies to business or professional income, and you have not entered any.'],
    };
  }

  const receipts = input.bizReceipts;
  const isProfession = input.bizType === 'profession';
  const presumptive = presumptiveTest(input, rules);
  const reasons = [];
  let required = false;

  const usesPresumptive = input.bizScheme === 'presumptive';
  if (usesPresumptive && presumptive.eligible) {
    const declared = chosen.business.income;
    const belowDeemed = declared < presumptive.deemedProfit;
    if (belowDeemed && chosen.totalIncome > basicExemption(result, rules)) {
      required = true;
      reasons.push(`You declared ${inr(declared)}, below the presumptive ${inr(presumptive.deemedProfit)}, and your income is above the basic exemption.`);
    } else {
      reasons.push(`Receipts of ${inr(receipts)} are within the ${inr(presumptive.limit)} presumptive limit, and the declared profit meets the presumptive rate.`);
    }
  } else {
    if (usesPresumptive) {
      reasons.push(`Receipts of ${inr(receipts)} are above the ${inr(presumptive.limit)} presumptive limit, so the presumptive scheme is not available.`);
    }
    if (isProfession) {
      required = receipts > a.professionReceipts;
      reasons.push(required
        ? `Professional receipts are above ${inr(a.professionReceipts)}.`
        : `Professional receipts are within ${inr(a.professionReceipts)}.`);
    } else {
      const cashReceiptsShare = input.bizCashReceipts / receipts;
      const cashPaymentsBase = Math.max(input.bizExpenses, 1);
      const cashPaymentsShare = input.bizExpenses > 0 ? input.bizCashPayments / cashPaymentsBase : 0;
      const lowCash = cashReceiptsShare <= a.lowCashShare && cashPaymentsShare <= a.lowCashShare;
      const limit = lowCash ? a.businessTurnoverLowCash : a.businessTurnover;
      required = receipts > limit;
      reasons.push(required
        ? `Turnover is above the ${inr(limit)} limit that applies to you.`
        : `Turnover is within the ${inr(limit)} limit${lowCash ? ', which applies because cash is 5% or less of both receipts and payments' : ''}.`);
    }
  }

  return {
    status: required ? 'required' : 'not-required',
    headline: required ? 'A tax audit is required' : 'No tax audit needed on these numbers',
    reasons,
    reference: ref,
    presumptiveEligible: presumptive.eligible,
  };
}

/** The return form that fits, with what would change the answer. */
export function itrForm(result, audit) {
  const { input, chosen } = result;
  const totalIncome = chosen.totalIncome;
  const hasBusiness = input.sources.business && input.bizReceipts > 0;
  const complexGains = input.stcgEquity > 0 || input.stcgOther > 0 || input.ltcgOther > 0
    || input.ltcgEquity > getRules(result.fy).capitalGains.ltcgEquityExempt;
  const hasLossCarry = chosen.houseProperty.lossCarriedForward > 0;

  if (hasBusiness) {
    const presumptive = input.bizScheme === 'presumptive' && audit.presumptiveEligible && audit.status !== 'required';
    if (presumptive && totalIncome <= 5000000 && !complexGains && !hasLossCarry) {
      return { form: 'ITR-4', reason: 'Presumptive income, with total income up to ₹50 lakh.' };
    }
    return { form: 'ITR-3', reason: 'Business or professional income that does not fit ITR-4.' };
  }
  if (totalIncome > 5000000) return { form: 'ITR-2', reason: 'Total income is above ₹50 lakh.' };
  if (complexGains) return { form: 'ITR-2', reason: 'You have capital gains that ITR-1 cannot report.' };
  if (hasLossCarry) return { form: 'ITR-2', reason: 'You have a house property loss to carry forward.' };
  return { form: 'ITR-1', reason: 'Income is from salary, up to two house properties and interest, within ₹50 lakh.' };
}

/** Whole months counted the way sections 234A and 234B count them: part months are full. */
function monthsOrPart(from, to) {
  if (to <= from) return 0;
  const months = (to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth();
  return to.getDate() > from.getDate() ? months + 1 : Math.max(months, 1);
}

/** Deadlines, and the estimated cost of being late as of `today`. */
export function filingPlan(result, audit, form, today = new Date()) {
  const rules = getRules(result.fy);
  const { input, chosen } = result;
  const dates = rules.dueDates;

  const audited = audit.status === 'required';
  const dueIso = audited ? dates.audit : ['ITR-3', 'ITR-4'].includes(form.form) ? dates.itr34 : dates.itr12;
  const due = new Date(`${dueIso}T23:59:59`);
  const belated = new Date(`${dates.belated}T23:59:59`);
  const isLate = today > due;
  const belatedClosed = today > belated;

  const paidInYear = input.tds + input.tcs + input.advanceTax;
  const assessed = chosen.totalTax - input.tds - input.tcs;

  // 234B runs from 1 April of the assessment year until filing.
  const ayStart = new Date(Number(rules.ay.slice(0, 4)), 3, 1);
  const asOf = isLate ? today : due;
  let interest234B = 0;
  if (assessed >= rules.advanceTax.threshold && input.advanceTax < 0.9 * assessed) {
    const shortfall = Math.floor(Math.max(0, chosen.totalTax - paidInYear) / 100) * 100;
    interest234B = shortfall * 0.01 * monthsOrPart(ayStart, asOf);
  }

  // 234A runs from the due date until filing, on tax still unpaid.
  const unpaid = Math.floor(Math.max(0, chosen.totalTax - paidInYear) / 100) * 100;
  const interest234A = isLate ? unpaid * 0.01 * monthsOrPart(due, today) : 0;

  const exemption = basicExemption(result, rules);
  let lateFee = 0;
  if (isLate && chosen.totalIncome > exemption) {
    lateFee = chosen.totalIncome <= rules.lateFee.smallIncomeLimit ? rules.lateFee.small : rules.lateFee.standard;
  }

  return {
    dueDate: dueIso,
    auditReportDate: audited ? dates.auditReport : null,
    auditReportPassed: audited && dates.auditReport ? today > new Date(`${dates.auditReport}T23:59:59`) : false,
    belatedDate: dates.belated,
    revisedDate: dates.revised,
    isLate,
    belatedClosed,
    interest234A,
    interest234B,
    lateFee,
    lateCost: interest234A + interest234B + lateFee,
  };
}

/** Advance tax instalments for the year, against what has been paid. */
export function advanceTaxPlan(result, today = new Date()) {
  const rules = getRules(result.fy);
  const { input, chosen } = result;
  const liability = chosen.totalTax - input.tds - input.tcs;
  const hasBusiness = input.sources.business && input.bizReceipts > 0;

  if (liability < rules.advanceTax.threshold) {
    return { applies: false, liability, reason: `Tax left after TDS and TCS is under ${inr(rules.advanceTax.threshold)}, so advance tax does not apply.` };
  }
  if (input.age !== 'below60' && !hasBusiness) {
    return { applies: false, liability, reason: 'Resident senior citizens with no business income do not pay advance tax.' };
  }

  const startYear = Number(result.fy.slice(0, 4));
  const presumptiveOnly = hasBusiness && input.bizScheme === 'presumptive' && presumptiveTest(input, rules).eligible;
  const instalments = presumptiveOnly ? [[3, 15, 1]] : rules.advanceTax.instalments;

  const rows = instalments.map(([month, day, share]) => {
    const year = month >= 4 ? startYear : startYear + 1;
    const date = new Date(year, month - 1, day, 23, 59, 59);
    const cumulative = Math.round(liability * share);
    return {
      date: date.toISOString(),
      label: formatDate(new Date(year, month - 1, day, 12)),
      share,
      cumulative,
      shortfall: Math.max(0, cumulative - input.advanceTax),
      passed: today > date,
    };
  });

  return { applies: true, liability, presumptiveOnly, rows, next: rows.find((row) => !row.passed) ?? null };
}

/** What a reviewer would query. Errors change the answer; warnings need a look. */
export function reviewFlags(result, audit) {
  const flags = [];
  const { input, chosen } = result;
  const rules = getRules(result.fy);
  const caps = rules.caps;
  const add = (...args) => flags.push(hasFlag(...args));

  if (input.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(input.pan)) {
    add('warn', 'PAN looks wrong', 'A PAN is five letters, four digits, then one letter.', 'profile');
  }

  if (input.sources.salary) {
    if (input.basicSalary > input.grossSalary) {
      add('error', 'Basic salary is more than gross salary', 'Gross salary should include basic, HRA and every allowance. Check both against Form 16.', 'income');
    }
    if (input.hraReceived > input.grossSalary) {
      add('error', 'HRA is more than gross salary', 'HRA is part of gross salary, so it cannot be larger.', 'income');
    }
    if (input.hraReceived > 0 && input.rentPaid > 0 && input.basicSalary === 0) {
      add('error', 'HRA exemption needs your basic salary', 'Without it the exemption stays at ₹0, which may overstate your old regime tax.', 'income');
    }
    if (input.hraReceived > 0 && input.rentPaid === 0) {
      add('warn', 'HRA received but no rent entered', 'If you pay rent, add it. If you do not, the whole HRA is taxable, which is what this computation assumes.', 'income');
    }
    if (input.rentPaid > 100000) {
      add('info', 'Keep your landlord\'s PAN', 'Rent above ₹1 lakh a year needs the landlord\'s PAN to claim HRA.', 'income');
    }
    if (input.rentPaid > 600000) {
      add('warn', 'Check TDS on rent', 'Individuals paying rent above ₹50,000 a month generally have to deduct TDS. Ask your CA whether this applies to you.', 'income');
    }
    if (input.employerNps > 0 && input.basicSalary === 0) {
      add('error', 'Employer NPS needs your basic salary', 'The limit is a percentage of basic salary, so the deduction stays at ₹0 until you enter it.', 'income');
    }
    if (input.grossSalary > rules.standardDeduction.new && input.tds === 0) {
      add('warn', 'No TDS entered', 'Most employers deduct TDS. Take the figure from Form 16 or Form 26AS, otherwise the balance due is overstated.', 'taxes');
    }
  }

  const overCap = chosen.regime === 'old'
    ? chosen.deductions.items.filter((item) => item.claimed > item.allowed && item.claimed > 0)
    : [];
  for (const item of overCap) {
    add('warn', `${item.label}: only ${inr(item.allowed)} counts`, `You entered ${inr(item.claimed)}. The rest does not reduce your tax.`, 'deductions');
  }
  if (result.oldRegime.deductions.requested > result.oldRegime.deductions.total) {
    add('info', 'Some deductions go unused', 'Deductions cannot reduce income taxed at special rates, so part of them has no effect.', 'deductions');
  }

  if (input.sec80G > 0) {
    add('info', 'Enter donations after the qualifying limit', 'Donation deductions are often 50% of the amount, and cash above ₹2,000 does not qualify. Enter only the eligible amount.', 'deductions');
  }

  if (input.sources.business && input.bizReceipts > 0) {
    const presumptive = presumptiveTest(input, rules);
    if (input.bizScheme === 'presumptive' && !presumptive.eligible) {
      add('error', 'Receipts are above the presumptive limit', `The limit for you is ${inr(presumptive.limit)}, so the tax shown here isn't valid. Switch to "From my books" and enter your actual expenses.`, 'income');
    }
    if (input.bizScheme === 'presumptive' && input.bizDeclaredProfit > 0 && input.bizDeclaredProfit < presumptive.deemedProfit) {
      add('warn', 'Declared profit is below the presumptive rate', `The presumptive profit is ${inr(presumptive.deemedProfit)}. Declaring less can trigger a tax audit.`, 'income');
    }
    if (input.bizScheme === 'presumptive' && input.bizType === 'business') {
      add('info', 'Leaving 44AD has a lock-in', 'If you stop using 44AD after opting in, you generally cannot return to it for five years.', 'income');
    }
    if (result.filingRegime === 'old') {
      add('warn', 'Old regime has a one-time switch for business income', 'With business income you can move back to the new regime only once. Discuss this before filing Form 10-IEA.', 'review');
    }
    if (chosen.business.loss > 0) {
      add('warn', 'Business loss is not set off here', `This computation treats the ${inr(chosen.business.loss)} loss as nil. A CA can set it off and carry it forward.`, 'income');
    }
    if (input.bizScheme === 'books') {
      add('info', 'Keep books of account', 'Without the presumptive scheme you generally have to maintain books. Ask your CA what applies at your turnover.', 'income');
    }
  }

  if (chosen.houseProperty.lossCarriedForward > 0) {
    add('info', 'House property loss to carry forward', `${inr(chosen.houseProperty.lossCarriedForward)} cannot be used this year. File on time so it carries forward.`, 'income');
  }
  if (input.sources.property && input.homeLoanInterest > caps.selfOccupiedInterest) {
    add('warn', 'Home loan interest is above the limit', `Only ${inr(caps.selfOccupiedInterest)} counts for a self-occupied home, and only under the old regime.`, 'income');
  }
  if (input.sources.property && input.letOutInterest > 0 && input.rentReceived === 0) {
    add('warn', 'Let-out interest with no rent', 'Enter the rent received. If the home is self-occupied, move the interest to the home loan field.', 'income');
  }

  if (input.sources.otherIncome && input.dividends > 0 && chosen.totalIncome > 20000000) {
    add('warn', 'Surcharge on dividends may be lower', 'Surcharge on dividend income is capped at 15%. This computation applies the full rate, so it may overstate the tax.', 'review');
  }
  if (result.savings > 0 && result.savings < 5000 && result.hasIncome) {
    add('info', 'The two regimes are nearly equal', `Only ${inr(result.savings)} separates them, so a small correction could change the better choice.`, 'review');
  }
  if (input.filingRegime !== 'auto' && result.filingRegime !== result.recommended) {
    add('warn', 'You chose the costlier regime', `Filing under the ${result.filingRegime} regime costs ${inr(result.savings)} more on these numbers.`, 'review');
  }
  if (result.balance < 0) {
    add('info', 'Check your refund against Form 26AS', 'Refunds are paid only on TDS and tax that appear against your PAN.', 'taxes');
  }
  if (audit.status === 'required') {
    add('error', 'Have a CA audit your accounts', 'A tax audit report must be signed by a practising CA. TaxTrust can prepare your numbers but cannot replace this.', 'review');
  }

  const order = { error: 0, warn: 1, info: 2 };
  return flags.sort((a, b) => order[a.level] - order[b.level]);
}

/** Paperwork to collect, based only on what this person actually has. */
export function documentChecklist(result) {
  const { input } = result;
  const docs = [
    { group: 'Everyone', item: 'Form 26AS and Annual Information Statement (AIS), to match every figure here' },
    { group: 'Everyone', item: 'Bank statements for the year, and your Aadhaar-linked PAN' },
  ];
  const push = (group, condition, item) => {
    if (condition) docs.push({ group, item });
  };

  push('Salary', input.sources.salary, 'Form 16 from every employer this year');
  push('Salary', input.rentPaid > 0, 'Rent receipts and rent agreement');
  push('Salary', input.rentPaid > 100000, 'Landlord\'s PAN');
  push('Business', input.sources.business, 'Invoices and receipts register for the year');
  push('Business', input.sources.business && input.bizScheme === 'books', 'Profit and loss account, balance sheet and expense bills');
  push('Property', input.homeLoanInterest > 0 || input.letOutInterest > 0, 'Home loan interest certificate');
  push('Property', input.rentReceived > 0, 'Rent received records and municipal tax receipts');
  push('Gains', input.sources.capitalGains, 'Capital gains statements from your broker and mutual funds');
  push('Other income', input.sources.otherIncome, 'Interest certificates and dividend statements');
  push('Deductions', input.sec80C > 0, 'Proofs for 80C: PPF, ELSS, life insurance, tuition fees or principal repaid');
  push('Deductions', input.sec80CCD1B > 0 || input.employerNps > 0, 'NPS statement');
  push('Deductions', input.sec80DSelf > 0 || input.sec80DParents > 0, 'Health insurance premium receipts');
  push('Deductions', input.sec80E > 0, 'Education loan interest certificate');
  push('Deductions', input.sec80G > 0, 'Donation receipts showing the donee\'s PAN and registration');
  push('Taxes paid', input.advanceTax > 0 || input.selfAssessmentTax > 0, 'Challan receipts for tax you paid yourself');
  return docs;
}

/** One call for the Review screen. */
export function buildReview(result, today = new Date()) {
  const audit = auditCheck(result);
  const form = itrForm(result, audit);
  return {
    audit,
    form,
    plan: filingPlan(result, audit, form, today),
    advanceTax: advanceTaxPlan(result, today),
    flags: reviewFlags(result, audit),
    documents: documentChecklist(result),
  };
}
