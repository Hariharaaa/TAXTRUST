/**
 * Tax rules for resident individuals, one entry per financial year.
 *
 * Every number the engine uses lives here so a year can be reviewed, or added,
 * without touching calculation logic. Bump ENGINE_VERSION whenever a rule or a
 * formula changes: saved records carry it, so a later recomputation can tell
 * "the numbers were altered" apart from "the rules moved on".
 */

export const ENGINE_VERSION = '2.0.0';

const NEW_SLABS = [
  { min: 0, max: 400000, rate: 0 },
  { min: 400000, max: 800000, rate: 0.05 },
  { min: 800000, max: 1200000, rate: 0.1 },
  { min: 1200000, max: 1600000, rate: 0.15 },
  { min: 1600000, max: 2000000, rate: 0.2 },
  { min: 2000000, max: 2400000, rate: 0.25 },
  { min: 2400000, max: Infinity, rate: 0.3 },
];

/** Old-regime slabs differ only in the basic exemption, which depends on age. */
function oldSlabs(exemption) {
  return [
    { min: 0, max: exemption, rate: 0 },
    ...(exemption < 500000 ? [{ min: exemption, max: 500000, rate: 0.05 }] : []),
    { min: 500000, max: 1000000, rate: 0.2 },
    { min: 1000000, max: Infinity, rate: 0.3 },
  ];
}

const OLD_SLABS_BY_AGE = {
  below60: oldSlabs(250000),
  senior: oldSlabs(300000),
  superSenior: oldSlabs(500000),
};

const SHARED = {
  slabs: { new: () => NEW_SLABS, old: (age) => OLD_SLABS_BY_AGE[age] ?? OLD_SLABS_BY_AGE.below60 },
  standardDeduction: { old: 50000, new: 75000 },
  rebate: {
    old: { incomeLimit: 500000, maxRebate: 12500 },
    new: { incomeLimit: 1200000, maxRebate: 60000 },
  },
  surchargeBands: [
    { above: 5000000, rate: 0.1 },
    { above: 10000000, rate: 0.15 },
    { above: 20000000, rate: 0.25 },
    { above: 50000000, rate: 0.37 },
  ],
  surchargeCap: { new: 0.25, specialIncome: 0.15 },
  cessRate: 0.04,
  caps: {
    sec80C: 150000,
    sec80CCD1B: 50000,
    employerNpsPct: { old: 0.1, new: 0.14 },
    sec80DSelf: { normal: 25000, senior: 50000 },
    sec80DParents: { normal: 25000, senior: 50000 },
    sec80TTA: 10000,
    sec80TTB: 50000,
    selfOccupiedInterest: 200000,
    houseLossSetOff: 200000,
    professionalTax: 5000,
  },
  capitalGains: {
    stcgEquityRate: 0.2,
    ltcgEquityRate: 0.125,
    ltcgOtherRate: 0.125,
    ltcgEquityExempt: 125000,
  },
  presumptive: {
    professionRate: 0.5,
    businessCashRate: 0.08,
    businessDigitalRate: 0.06,
    professionLimit: 5000000,
    professionLimitLowCash: 7500000,
    businessLimit: 20000000,
    businessLimitLowCash: 30000000,
    lowCashShare: 0.05,
  },
  audit: {
    professionReceipts: 5000000,
    businessTurnover: 10000000,
    businessTurnoverLowCash: 100000000,
    lowCashShare: 0.05,
  },
  advanceTax: { threshold: 10000, instalments: [[6, 15, 0.15], [9, 15, 0.45], [12, 15, 0.75], [3, 15, 1]] },
  lateFee: { standard: 5000, small: 1000, smallIncomeLimit: 500000 },
};

const CORE_METROS = ['Delhi', 'Mumbai', 'Kolkata', 'Chennai'];

export const TAX_YEARS = {
  '2025-26': {
    ...SHARED,
    fy: '2025-26',
    ay: '2026-27',
    act: '1961',
    label: 'FY 2025-26',
    sublabel: 'AY 2026-27',
    purpose: 'The return you file for last year',
    metroCities: CORE_METROS,
    dueDates: {
      itr12: '2026-07-31',
      itr34: '2026-08-31',
      // CBDT press release of 28 Sep 2026 moved both audit dates.
      auditReport: '2026-10-21',
      audit: '2026-11-21',
      belated: '2026-12-31',
      revised: '2027-03-31',
    },
  },
  '2026-27': {
    ...SHARED,
    fy: '2026-27',
    ay: '2027-28',
    act: '2025',
    label: 'FY 2026-27',
    sublabel: 'Tax Year 2026-27',
    purpose: 'This year, for planning and advance tax',
    metroCities: [...CORE_METROS, 'Bengaluru', 'Hyderabad', 'Pune', 'Ahmedabad'],
    dueDates: {
      itr12: '2027-07-31',
      itr34: '2027-08-31',
      auditReport: null, // Not confirmed for this year; the UI tells people to ask their CA.
      audit: '2027-10-31',
      belated: '2027-12-31',
      revised: '2028-03-31',
    },
  },
};

export const DEFAULT_FY = '2026-27';

export function getRules(fy) {
  return TAX_YEARS[fy] ?? TAX_YEARS[DEFAULT_FY];
}

/**
 * Section references. The Income-tax Act 2025 replaced the 1961 Act from
 * 1 April 2026, so FY 2026-27 cites the new numbers beside the familiar ones.
 * `a2025: null` means no mapping could be verified: we show only the old
 * reference rather than guess.
 */
const REFS = {
  salary: { a1961: '15–17', a2025: null },
  hra: { a1961: '10(13A)', a2025: '11, Sch. II' },
  standardDeduction: { a1961: '16(ia)', a2025: '19' },
  professionalTax: { a1961: '16(iii)', a2025: '19' },
  houseProperty: { a1961: '22–24', a2025: '21–22' },
  homeLoanInterest: { a1961: '24(b)', a2025: '22' },
  lossSetOff: { a1961: '71', a2025: '109' },
  presumptive: { a1961: '44AD / 44ADA', a2025: '58' },
  profits: { a1961: '28', a2025: null },
  capitalGains: { a1961: '45', a2025: null },
  stcgEquity: { a1961: '111A', a2025: null },
  ltcgEquity: { a1961: '112A', a2025: null },
  ltcgOther: { a1961: '112', a2025: null },
  otherSources: { a1961: '56', a2025: null },
  sec80C: { a1961: '80C', a2025: '123' },
  sec80CCD1B: { a1961: '80CCD(1B)', a2025: '124' },
  sec80CCD2: { a1961: '80CCD(2)', a2025: '124' },
  sec80D: { a1961: '80D', a2025: '126' },
  sec80E: { a1961: '80E', a2025: '129' },
  sec80G: { a1961: '80G', a2025: '133' },
  sec80TTA: { a1961: '80TTA', a2025: '153' },
  sec80TTB: { a1961: '80TTB', a2025: '153' },
  rebate: { a1961: '87A', a2025: '156' },
  rounding: { a1961: '288A', a2025: null },
  roundingTax: { a1961: '288B', a2025: null },
  audit: { a1961: '44AB', a2025: '63' },
  books: { a1961: '44AA', a2025: '62' },
  return: { a1961: '139', a2025: '263' },
};

export function sectionRef(key, rules) {
  const ref = REFS[key];
  if (!ref) return '';
  if (rules.act !== '2025') return `s.${ref.a1961}`;
  return ref.a2025 ? `s.${ref.a2025} (old ${ref.a1961})` : `old s.${ref.a1961}`;
}
