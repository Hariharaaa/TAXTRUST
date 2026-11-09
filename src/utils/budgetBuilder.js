/**
 * Builds a starting budget from take-home pay. Fixed costs (housing, and any
 * expenses you added yourself) are covered first; the rest is split by a plan
 * such as 50/30/20 and spread across categories with sensible caps. Savings
 * follow your tax position: ELSS only when the old regime is actually better.
 *
 * Every number is a starting point to edit, and each choice comes with a note
 * that says why it was made.
 */

import { getRules } from './taxRules.js';
import { DEFAULT_ITEMS } from './budget.js';

export const PLANS = {
  balanced: { label: 'Balanced', split: { needs: 0.5, wants: 0.3, savings: 0.2 }, description: '50% needs, 30% wants, 20% savings' },
  saver: { label: 'Saver', split: { needs: 0.5, wants: 0.2, savings: 0.3 }, description: '50% needs, 20% wants, 30% savings' },
  essentials: { label: 'Essentials first', split: { needs: 0.6, wants: 0.3, savings: 0.1 }, description: '60% needs, 30% wants, 10% savings' },
};

export const HOUSEHOLDS = {
  single: 'Just me',
  couple: 'Couple',
  family: 'Family with children',
};

export const HOUSING = {
  rent: 'I pay rent',
  loan: 'I pay a home loan',
  own: 'I own it outright',
  family: 'I live with family',
};

export const DEFAULT_BUILDER = { household: 'single', housing: 'rent', housingAmount: 0, plan: 'balanced' };

/* Shares of the needs left after housing, by household. */
const NEEDS_WEIGHTS = {
  single: { groceries: 30, utilities: 12, phone: 6, transport: 18, health: 10, 'health-parents': 6, life: 4, tuition: 0 },
  couple: { groceries: 32, utilities: 13, phone: 7, transport: 16, health: 10, 'health-parents': 7, life: 8, tuition: 0 },
  family: { groceries: 30, utilities: 12, phone: 5, transport: 13, health: 10, 'health-parents': 6, life: 8, tuition: 14 },
};

const WANTS_WEIGHTS = { dining: 35, shopping: 30, subscriptions: 12, travel: 23 };

/*
 * Yearly ceilings. Insurance premiums don't grow with income the way groceries
 * do, so a larger budget shouldn't buy an oversized policy. Money above a
 * ceiling goes to the other categories.
 */
const YEARLY_CAPS = { health: 25000, 'health-parents': 25000, life: 25000 };

const roundDown = (n, step) => Math.max(0, Math.floor(n / step) * step);
const frequencyOf = Object.fromEntries(DEFAULT_ITEMS.map((i) => [i.id, i.frequency]));

/** Split `amount` across weights, respecting monthly caps, passing any excess on. */
function spread(amount, weights, monthlyCaps = {}) {
  const result = Object.fromEntries(Object.keys(weights).map((k) => [k, 0]));
  let open = Object.keys(weights).filter((k) => weights[k] > 0);
  let remaining = amount;
  while (remaining > 0.5 && open.length > 0) {
    const total = open.reduce((t, k) => t + weights[k], 0);
    let excess = 0;
    const stillOpen = [];
    for (const key of open) {
      const share = (remaining * weights[key]) / total;
      const cap = monthlyCaps[key] ?? Infinity;
      const room = cap - result[key];
      if (share >= room) {
        result[key] += room;
        excess += share - room;
      } else {
        result[key] += share;
        stillOpen.push(key);
      }
    }
    remaining = excess;
    if (stillOpen.length === open.length) break;
    open = stillOpen;
  }
  return result;
}

/**
 * @param {object} options
 * @param {number} options.income      monthly take-home
 * @param {object} options.prefs       { household, housing, housingAmount, plan }
 * @param {Array}  options.items       current budget items (custom ones are kept)
 * @param {object} [options.tax]       { recommended: 'old'|'new', fy, senior, parentsSenior } or null
 * @returns {{ amounts: Object<string, number>, totals, notes: string[], warnings: string[] }}
 */
export function buildBudget({ income, prefs, items, tax = null }) {
  const plan = PLANS[prefs.plan] ?? PLANS.balanced;
  const household = NEEDS_WEIGHTS[prefs.household] ? prefs.household : 'single';
  const notes = [];
  const warnings = [];
  if (!(income > 0)) return { amounts: {}, totals: { needs: 0, wants: 0, savings: 0 }, notes, warnings: ['Add your take-home pay first.'] };

  const target = {
    needs: income * plan.split.needs,
    wants: income * plan.split.wants,
    savings: income * plan.split.savings,
  };

  // Expenses you added yourself stay as they are and come out of their group first.
  const defaultIds = new Set(DEFAULT_ITEMS.map((i) => i.id));
  const custom = { needs: 0, wants: 0, savings: 0 };
  for (const entry of items) {
    if (defaultIds.has(entry.id)) continue;
    const monthly = entry.frequency === 'yearly' ? (Number(entry.amount) || 0) / 12 : Number(entry.amount) || 0;
    if (entry.group in custom) custom[entry.group] += Math.max(0, monthly);
  }
  if (custom.needs + custom.wants + custom.savings > 0) notes.push('Expenses you added yourself are kept as they are.');

  const housing = ['rent', 'loan'].includes(prefs.housing) ? Math.max(0, Number(prefs.housingAmount) || 0) : 0;
  const fixedNeeds = housing + custom.needs;

  // When fixed costs don't fit in needs, take the shortfall from wants, then savings.
  let needsRoom = target.needs - fixedNeeds;
  let wantsBudget = target.wants - custom.wants;
  let savingsBudget = target.savings - custom.savings;
  if (needsRoom < 0) {
    let shortfall = -needsRoom;
    const fromWants = Math.min(shortfall, Math.max(0, wantsBudget));
    wantsBudget -= fromWants;
    shortfall -= fromWants;
    const fromSavings = Math.min(shortfall, Math.max(0, savingsBudget));
    savingsBudget -= fromSavings;
    shortfall -= fromSavings;
    needsRoom = 0;
    warnings.push(shortfall > 0
      ? 'Your fixed costs are more than your take-home pay. Look at housing first.'
      : 'Housing and fixed costs are more than the needs share of your plan, so wants and savings were cut to make room.');
  }
  if (housing / income > 0.35) {
    warnings.push(`Housing takes ${Math.round((housing / income) * 100)}% of your take-home. Many planners suggest keeping it under 30–35%.`);
  }

  const amounts = Object.fromEntries(DEFAULT_ITEMS.map((i) => [i.id, 0]));
  if (prefs.housing === 'rent') amounts.rent = housing;
  if (prefs.housing === 'loan') amounts['home-emi'] = housing;

  // Needs after housing.
  const rules = getRules(tax?.fy);
  const caps = {
    ...YEARLY_CAPS,
    health: tax?.senior ? rules.caps.sec80DSelf.senior : YEARLY_CAPS.health,
    'health-parents': tax?.parentsSenior ? rules.caps.sec80DParents.senior : YEARLY_CAPS['health-parents'],
  };
  const monthlyCaps = Object.fromEntries(Object.entries(caps).map(([k, v]) => [k, v / 12]));
  Object.assign(amounts, spread(Math.max(0, needsRoom), NEEDS_WEIGHTS[household], monthlyCaps));
  if (household === 'family') notes.push('Children\'s tuition fees are included. They also count under 80C.');

  // Wants.
  Object.assign(amounts, spread(Math.max(0, wantsBudget), WANTS_WEIGHTS));

  // Savings: an emergency fund first, then retirement, then long-term growth.
  // 40% goes to the emergency fund so it's built in a few years, not a decade.
  const savings = Math.max(0, savingsBudget);
  amounts.emergency = savings * 0.4;
  amounts.nps = Math.min(savings * 0.1, rules.caps.sec80CCD1B / 12);
  let rest = savings - amounts.emergency - amounts.nps;

  if (tax?.recommended === 'old') {
    const committed80C = (amounts.life + amounts.tuition) * 12;
    const room80C = Math.max(0, rules.caps.sec80C - committed80C) / 12;
    amounts.elss = Math.min(rest * 0.5, room80C);
    rest -= amounts.elss;
    notes.push('The old regime is better for you, so part of your savings goes to ELSS. It counts under 80C and cuts your tax.');
  } else {
    amounts.ppf = rest * 0.25;
    rest -= amounts.ppf;
    notes.push(tax
      ? 'The new regime is better for you, so 80C doesn\'t lower your tax. Savings go to PPF for safety and SIPs for growth.'
      : 'Savings are split between PPF for safety and SIPs for growth. Work out your tax to check if ELSS would help.');
  }
  amounts.sip = rest;

  const emergencyTarget = (target.needs) * 6;
  if (amounts.emergency > 0) {
    const months = Math.ceil(emergencyTarget / amounts.emergency);
    const time = months <= 24 ? `${months} months` : `about ${Math.round(months / 12)} years`;
    notes.push(`Emergency fund: ${time} to build six months of needs (₹${Math.round(emergencyTarget).toLocaleString('en-IN')}). Once it's built, move that amount to your SIP.`);
  }

  // Store each amount the way the item is entered, rounded down so the total
  // never goes over income.
  for (const id of Object.keys(amounts)) {
    amounts[id] = frequencyOf[id] === 'yearly' ? roundDown(amounts[id] * 12, 1000) : roundDown(amounts[id], 100);
  }

  const monthly = (id) => (frequencyOf[id] === 'yearly' ? amounts[id] / 12 : amounts[id]);
  const groupOf = Object.fromEntries(DEFAULT_ITEMS.map((i) => [i.id, i.group]));
  const totals = { needs: custom.needs, wants: custom.wants, savings: custom.savings };
  for (const id of Object.keys(amounts)) totals[groupOf[id]] += monthly(id);

  return { amounts, totals, notes, warnings, unassigned: Math.max(0, income - totals.needs - totals.wants - totals.savings) };
}

/** Apply built amounts: default items get new amounts, your own items are untouched. */
export function applyBuiltBudget(items, amounts) {
  return items.map((entry) => (entry.id in amounts ? { ...entry, amount: amounts[entry.id] } : entry));
}
