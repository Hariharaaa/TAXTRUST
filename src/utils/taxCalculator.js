/**
 * Income tax computation for resident individuals, under both regimes.
 *
 * Pure and deterministic: the same input always gives the same result, which is
 * what lets a saved record be recomputed later and compared. Scope and known
 * simplifications are listed in the README.
 */

import { DEFAULT_FY, ENGINE_VERSION, getRules } from './taxRules.js';

export const SOURCE_KEYS = ['salary', 'business', 'property', 'capitalGains', 'otherIncome'];

export const EMPTY_INPUT = {
  fy: DEFAULT_FY,
  name: '',
  pan: '',
  age: 'below60', // below60 | senior | superSenior
  sources: { salary: true, business: false, property: false, capitalGains: false, otherIncome: false },
  filingRegime: 'auto', // auto | old | new

  // Salary
  grossSalary: 0,
  basicSalary: 0,
  hraReceived: 0,
  rentPaid: 0,
  isMetro: false,
  professionalTax: 0,
  employerNps: 0,

  // Freelance or business
  bizType: 'profession', // profession | business
  bizScheme: 'presumptive', // presumptive | books
  bizReceipts: 0,
  bizCashReceipts: 0,
  bizCashPayments: 0,
  bizExpenses: 0,
  bizDeclaredProfit: 0,

  // House property
  homeLoanInterest: 0,
  rentReceived: 0,
  municipalTax: 0,
  letOutInterest: 0,

  // Capital gains
  stcgEquity: 0,
  ltcgEquity: 0,
  stcgOther: 0,
  ltcgOther: 0,

  // Other income
  savingsInterest: 0,
  fdInterest: 0,
  dividends: 0,
  otherIncome: 0,

  // Deductions
  sec80C: 0,
  sec80CCD1B: 0,
  sec80DSelf: 0,
  sec80DParents: 0,
  parentsSenior: false,
  sec80E: 0,
  sec80G: 0,
  otherDeductions: 0,

  // Taxes already paid
  tds: 0,
  tcs: 0,
  advanceTax: 0,
  selfAssessmentTax: 0,
};

const FIELDS_BY_SOURCE = {
  salary: ['grossSalary', 'basicSalary', 'hraReceived', 'rentPaid', 'professionalTax', 'employerNps'],
  business: ['bizReceipts', 'bizCashReceipts', 'bizCashPayments', 'bizExpenses', 'bizDeclaredProfit'],
  property: ['homeLoanInterest', 'rentReceived', 'municipalTax', 'letOutInterest'],
  capitalGains: ['stcgEquity', 'ltcgEquity', 'stcgOther', 'ltcgOther'],
  otherIncome: ['savingsInterest', 'fdInterest', 'dividends', 'otherIncome'],
};

const round10 = (n) => Math.round(n / 10) * 10; // s.288A / 288B
const clampPositive = (n) => {
  const value = Number(n);
  return Number.isFinite(value) && value > 0 ? value : 0;
};

/**
 * Fill defaults, reject bad numbers, and zero any income source the person has
 * switched off, so a hidden field can never quietly change the tax.
 */
export function normalizeInput(raw = {}) {
  const input = { ...EMPTY_INPUT, ...raw, sources: { ...EMPTY_INPUT.sources, ...raw.sources } };
  for (const [key, fallback] of Object.entries(EMPTY_INPUT)) {
    if (typeof fallback === 'number') input[key] = clampPositive(input[key]);
  }
  for (const source of SOURCE_KEYS) {
    if (!input.sources[source]) {
      for (const field of FIELDS_BY_SOURCE[source]) input[field] = 0;
    }
  }
  return input;
}

function slabTax(income, slabs) {
  let tax = 0;
  const breakdown = slabs.map((slab) => {
    const amount = Math.max(0, Math.min(income, slab.max) - slab.min);
    const slabAmount = amount * slab.rate;
    tax += slabAmount;
    return { min: slab.min, max: slab.max, rate: slab.rate, amount, tax: slabAmount };
  });
  return { tax, breakdown };
}

function computeSalary(input, regime, rules) {
  const gross = input.grossSalary;
  const basic = input.basicSalary;

  const hraTest = {
    received: input.hraReceived,
    rentOverTenPct: Math.max(0, input.rentPaid - 0.1 * basic),
    salaryLimit: (input.isMetro ? 0.5 : 0.4) * basic,
  };
  const hraEligible = input.hraReceived > 0 && input.rentPaid > 0;
  const hraExemptAmount = hraEligible
    ? Math.min(hraTest.received, hraTest.rentOverTenPct, hraTest.salaryLimit)
    : 0;

  const hraExempt = regime === 'old' ? hraExemptAmount : 0;
  const standardDeduction = Math.min(gross, rules.standardDeduction[regime]);
  const professionalTax = regime === 'old' ? Math.min(input.professionalTax, rules.caps.professionalTax) : 0;

  return {
    gross,
    hraExempt,
    hraTest,
    standardDeduction,
    professionalTax,
    income: Math.max(0, gross - hraExempt - standardDeduction - professionalTax),
  };
}

function computeHouseProperty(input, regime, rules) {
  const netAnnualValue = Math.max(0, input.rentReceived - input.municipalTax);
  const standardDeduction = 0.3 * netAnnualValue;
  const letOutIncome = netAnnualValue - standardDeduction - input.letOutInterest;

  // The new regime gives no deduction for a self-occupied home and does not
  // let a house property loss reduce other income.
  const selfOccupiedInterest = regime === 'old'
    ? Math.min(input.homeLoanInterest, rules.caps.selfOccupiedInterest)
    : 0;

  const combined = letOutIncome - selfOccupiedInterest;
  const floor = regime === 'old' ? -rules.caps.houseLossSetOff : 0;
  const income = Math.max(combined, floor);

  return {
    rent: input.rentReceived,
    municipalTax: Math.min(input.municipalTax, input.rentReceived),
    standardDeduction,
    letOutInterest: input.letOutInterest,
    selfOccupiedInterest,
    income,
    lossCarriedForward: Math.max(0, income - combined),
  };
}

/** Presumptive eligibility and the deemed profit, shared with the audit check. */
export function presumptiveTest(input, rules) {
  const p = rules.presumptive;
  const receipts = input.bizReceipts;
  const cashShare = receipts > 0 ? Math.min(input.bizCashReceipts, receipts) / receipts : 0;
  const isProfession = input.bizType === 'profession';
  const lowCash = cashShare <= p.lowCashShare;

  const limit = isProfession
    ? (lowCash ? p.professionLimitLowCash : p.professionLimit)
    : (lowCash ? p.businessLimitLowCash : p.businessLimit);

  const cash = Math.min(input.bizCashReceipts, receipts);
  const deemedProfit = isProfession
    ? receipts * p.professionRate
    : cash * p.businessCashRate + (receipts - cash) * p.businessDigitalRate;

  return { limit, lowCash, cashShare, deemedProfit, eligible: receipts <= limit };
}

function computeBusiness(input, rules) {
  if (!input.sources.business || input.bizReceipts === 0) {
    return { income: 0, receipts: 0, deemedProfit: 0, method: 'none', loss: 0 };
  }
  if (input.bizScheme === 'books') {
    const profit = input.bizReceipts - input.bizExpenses;
    return {
      income: Math.max(0, profit),
      receipts: input.bizReceipts,
      deemedProfit: 0,
      method: 'books',
      loss: Math.max(0, -profit),
    };
  }
  const { deemedProfit } = presumptiveTest(input, rules);
  return {
    income: input.bizDeclaredProfit > 0 ? input.bizDeclaredProfit : deemedProfit,
    receipts: input.bizReceipts,
    deemedProfit,
    method: 'presumptive',
    loss: 0,
  };
}

function computeDeductions(input, regime, rules, normalIncome) {
  const c = rules.caps;
  const isSenior = input.age !== 'below60';
  const npsPct = c.employerNpsPct[regime];
  const employerNpsCap = npsPct * input.basicSalary;

  const row = (key, refKey, label, claimed, cap) => ({
    key,
    refKey,
    label,
    claimed,
    cap,
    allowed: Math.min(claimed, cap),
  });

  // Employer NPS is the one Chapter VI-A deduction the new regime keeps.
  const items = [row('sec80CCD2', 'sec80CCD2', `Employer NPS (up to ${npsPct * 100}% of basic)`, input.employerNps, employerNpsCap)];

  if (regime === 'old') {
    const interestForRelief = isSenior ? input.savingsInterest + input.fdInterest : input.savingsInterest;
    items.push(
      row('sec80C', 'sec80C', 'Section 80C investments', input.sec80C, c.sec80C),
      row('sec80CCD1B', 'sec80CCD1B', 'Own NPS, extra', input.sec80CCD1B, c.sec80CCD1B),
      row('sec80DSelf', 'sec80D', 'Health insurance: self and family', input.sec80DSelf, isSenior ? c.sec80DSelf.senior : c.sec80DSelf.normal),
      row('sec80DParents', 'sec80D', 'Health insurance: parents', input.sec80DParents, input.parentsSenior ? c.sec80DParents.senior : c.sec80DParents.normal),
      row('sec80E', 'sec80E', 'Education loan interest', input.sec80E, Infinity),
      row('sec80G', 'sec80G', 'Eligible donations', input.sec80G, Infinity),
      isSenior
        ? row('sec80TTB', 'sec80TTB', 'Interest income (senior citizens)', interestForRelief, c.sec80TTB)
        : row('sec80TTA', 'sec80TTA', 'Savings account interest', interestForRelief, c.sec80TTA),
      row('otherDeductions', null, 'Other deductions', input.otherDeductions, Infinity),
    );
  }

  const requested = items.reduce((sum, item) => sum + item.allowed, 0);
  // Chapter VI-A deductions cannot reduce income taxed at special rates.
  return { items, requested, total: Math.min(requested, normalIncome) };
}

/** Tax before cess on a given split of income, ignoring rebate. */
function taxOnIncome(normalIncome, specialTax, slabs) {
  return slabTax(normalIncome, slabs).tax + specialTax;
}

function computeSurcharge({ regime, rules, totalIncome, normalTax, specialTax, specialIncome, slabs }) {
  const capNew = rules.surchargeCap.new;
  const capSpecial = rules.surchargeCap.specialIncome;
  const rateFor = (band) => (regime === 'new' ? Math.min(band.rate, capNew) : band.rate);

  const bands = rules.surchargeBands.filter((band) => regime === 'old' || band.rate <= capNew);
  const index = bands.findLastIndex((band) => totalIncome > band.above);
  if (index === -1) return { rate: 0, gross: 0, relief: 0, net: 0 };

  const rate = rateFor(bands[index]);
  const surchargeAt = (normal, special, r) => normal * r + special * Math.min(r, capSpecial);
  const gross = surchargeAt(normalTax, specialTax, rate);

  // Marginal relief: crossing a band must not cost more than the extra income.
  const threshold = bands[index].above;
  const lowerRate = index > 0 ? rateFor(bands[index - 1]) : 0;
  const normalAtThreshold = Math.max(0, threshold - specialIncome);
  const normalTaxAtThreshold = slabTax(normalAtThreshold, slabs).tax;
  const totalAtThreshold = taxOnIncome(normalAtThreshold, specialTax, slabs)
    + surchargeAt(normalTaxAtThreshold, specialTax, lowerRate);
  const ceiling = totalAtThreshold + (totalIncome - threshold) - (normalTax + specialTax);
  const relief = Math.max(0, gross - Math.max(0, ceiling));

  return { rate, gross, relief, net: gross - relief };
}

function computeRegime(input, regime, rules) {
  const slabs = regime === 'old' ? rules.slabs.old(input.age) : rules.slabs.new();
  const cg = rules.capitalGains;

  const salary = computeSalary(input, regime, rules);
  const houseProperty = computeHouseProperty(input, regime, rules);
  const business = computeBusiness(input, rules);
  const otherSources = input.savingsInterest + input.fdInterest + input.dividends + input.otherIncome;

  // Equity gains above the annual exemption, and other long-term gains, sit
  // outside the slabs. Short-term gains on other assets are taxed at slab rates.
  const ltcgEquityTaxable = Math.max(0, input.ltcgEquity - cg.ltcgEquityExempt);
  const specialGross = { stcgEquity: input.stcgEquity, ltcgOther: input.ltcgOther, ltcgEquity: ltcgEquityTaxable };
  const specialIncome = specialGross.stcgEquity + specialGross.ltcgOther + specialGross.ltcgEquity;

  const normalHeads = Math.max(0, salary.income + houseProperty.income + business.income + input.stcgOther + otherSources);
  const grossTotalIncome = normalHeads + specialIncome;

  const deductions = computeDeductions(input, regime, rules, normalHeads);
  const totalIncome = round10(Math.max(0, grossTotalIncome - deductions.total));
  const normalIncome = Math.max(0, totalIncome - specialIncome);

  // Slab tax, then special-rate tax after using any unused basic exemption.
  // The exemption goes against the highest-taxed gains first.
  const { tax: normalTax, breakdown } = slabTax(normalIncome, slabs);
  let unusedExemption = Math.max(0, slabs[0].max - normalIncome);
  const consume = (amount) => {
    const used = Math.min(amount, unusedExemption);
    unusedExemption -= used;
    return amount - used;
  };
  const stcgTaxable = consume(specialGross.stcgEquity);
  const ltcgOtherTaxable = consume(specialGross.ltcgOther);
  const ltcgEquityAfterExemption = consume(specialGross.ltcgEquity);

  const specialTaxes = {
    stcgEquity: stcgTaxable * cg.stcgEquityRate,
    ltcgOther: ltcgOtherTaxable * cg.ltcgOtherRate,
    ltcgEquity: ltcgEquityAfterExemption * cg.ltcgEquityRate,
  };
  const specialTax = specialTaxes.stcgEquity + specialTaxes.ltcgOther + specialTaxes.ltcgEquity;
  const taxBeforeRebate = normalTax + specialTax;

  // Section 87A. The old regime allows it against everything but s.112A tax;
  // the new regime allows it only against slab tax.
  const rebateRule = rules.rebate[regime];
  let rebate = 0;
  let rebateMarginalRelief = 0;
  if (totalIncome <= rebateRule.incomeLimit) {
    const rebateable = regime === 'old' ? taxBeforeRebate - specialTaxes.ltcgEquity : normalTax;
    rebate = Math.min(rebateable, rebateRule.maxRebate);
  } else if (regime === 'new') {
    const excess = totalIncome - rebateRule.incomeLimit;
    rebateMarginalRelief = Math.min(normalTax, Math.max(0, taxBeforeRebate - excess));
  }

  const taxAfterRebate = taxBeforeRebate - rebate - rebateMarginalRelief;
  const surcharge = computeSurcharge({
    regime,
    rules,
    totalIncome,
    normalTax: Math.max(0, normalTax - rebate - rebateMarginalRelief),
    specialTax,
    specialIncome,
    slabs,
  });
  const cess = (taxAfterRebate + surcharge.net) * rules.cessRate;
  const totalTax = Math.round(taxAfterRebate + surcharge.net + cess);

  return {
    regime,
    salary,
    houseProperty,
    business,
    capitalGains: {
      stcgEquity: input.stcgEquity,
      stcgOther: input.stcgOther,
      ltcgOther: input.ltcgOther,
      ltcgEquityGross: input.ltcgEquity,
      ltcgEquityExempt: Math.min(input.ltcgEquity, cg.ltcgEquityExempt),
      ltcgEquityTaxable,
      taxes: specialTaxes,
    },
    otherSources,
    grossTotalIncome,
    deductions,
    totalIncome,
    normalIncome,
    specialIncome,
    breakdown,
    normalTax,
    specialTax,
    taxBeforeRebate,
    rebate,
    rebateMarginalRelief,
    taxAfterRebate,
    surcharge,
    cess,
    totalTax,
    effectiveRate: grossTotalIncome > 0 ? (totalTax / grossTotalIncome) * 100 : 0,
  };
}

export function computeTax(rawInput) {
  const input = normalizeInput(rawInput);
  const rules = getRules(input.fy);

  const oldRegime = computeRegime(input, 'old', rules);
  const newRegime = computeRegime(input, 'new', rules);

  // On a tie, prefer the new regime: it is the default and needs no opt-in.
  const recommended = oldRegime.totalTax < newRegime.totalTax ? 'old' : 'new';
  const filingRegime = input.filingRegime === 'auto' ? recommended : input.filingRegime;
  const chosen = filingRegime === 'old' ? oldRegime : newRegime;

  const credits = input.tds + input.tcs + input.advanceTax + input.selfAssessmentTax;
  const balance = round10(chosen.totalTax - credits);

  return {
    engineVersion: ENGINE_VERSION,
    fy: input.fy,
    input,
    oldRegime,
    newRegime,
    recommended,
    filingRegime,
    chosen,
    savings: Math.abs(oldRegime.totalTax - newRegime.totalTax),
    credits,
    balance, // positive: pay this. negative: refund.
    presumptiveEligible: presumptiveTest(input, rules).eligible,
    hasIncome: oldRegime.grossTotalIncome > 0 || newRegime.grossTotalIncome > 0,
  };
}
