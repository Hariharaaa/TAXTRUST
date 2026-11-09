/** The form in progress, kept in this browser so a refresh never loses work. */

import { EMPTY_INPUT } from './taxCalculator.js';

const DRAFT_KEY = 'taxtrust_draft';

export function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return EMPTY_INPUT;
    const saved = JSON.parse(raw);
    return { ...EMPTY_INPUT, ...saved, sources: { ...EMPTY_INPUT.sources, ...saved.sources } };
  } catch {
    return EMPTY_INPUT;
  }
}

export function saveDraft(input) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(input));
  } catch {
    // Storage can be blocked or full. The calculator still works without it.
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Nothing to clear.
  }
}

export const SAMPLE_INPUT = {
  ...EMPTY_INPUT,
  name: 'Sample taxpayer',
  sources: { ...EMPTY_INPUT.sources, salary: true, otherIncome: true },
  grossSalary: 1800000,
  basicSalary: 720000,
  hraReceived: 360000,
  rentPaid: 300000,
  isMetro: true,
  professionalTax: 2400,
  savingsInterest: 12000,
  fdInterest: 30000,
  sec80C: 150000,
  sec80DSelf: 18000,
  tds: 110000,
};
