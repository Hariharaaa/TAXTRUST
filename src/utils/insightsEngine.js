/**
 * Tax-saving suggestions.
 *
 * Rule-based, with no AI and no external calls. Each figure comes from re-running
 * the real engine with the change applied, so a suggestion only appears when it
 * would lower the tax this person actually pays: an unused 80C limit is worth
 * nothing to someone better off in the new regime.
 */

import { computeTax } from './taxCalculator.js';
import { getRules } from './taxRules.js';
import { inr } from './format.js';

const bestTax = (result) => Math.min(result.oldRegime.totalTax, result.newRegime.totalTax);

/** Smallest extra old-regime deduction that makes the old regime at least as good. */
export function breakEvenDeduction(result) {
  const { input } = result;
  if (result.oldRegime.totalTax <= result.newRegime.totalTax) return 0;

  const oldTaxWith = (extra) => computeTax({ ...input, otherDeductions: input.otherDeductions + extra }).oldRegime.totalTax;
  let high = result.oldRegime.grossTotalIncome;
  if (oldTaxWith(high) > result.newRegime.totalTax) return null;

  let low = 0;
  while (high - low > 100) {
    const mid = (low + high) / 2;
    if (oldTaxWith(mid) > result.newRegime.totalTax) low = mid;
    else high = mid;
  }
  return Math.ceil(high / 100) * 100;
}

export function generateSuggestions(result) {
  if (!result?.hasIncome) return [];

  const { input } = result;
  const rules = getRules(result.fy);
  const caps = rules.caps;
  const current = bestTax(result);
  const isSenior = input.age !== 'below60';
  const suggestions = [];

  const trySaving = (changes) => current - bestTax(computeTax({ ...input, ...changes }));
  const offer = (id, headline, detail, changes) => {
    const saving = trySaving(changes);
    if (saving > 0) suggestions.push({ id, headline, detail, saving });
  };

  const gap80C = caps.sec80C - Math.min(input.sec80C, caps.sec80C);
  if (gap80C > 0) {
    offer('80c', `Use the remaining ${inr(gap80C)} of 80C`, 'PPF, ELSS, EPF, life insurance, tuition fees and home loan principal all count. Old regime only.', { sec80C: caps.sec80C });
  }

  const gapNps = caps.sec80CCD1B - Math.min(input.sec80CCD1B, caps.sec80CCD1B);
  if (gapNps > 0) {
    offer('nps', `Add ${inr(gapNps)} to your own NPS`, 'This sits on top of the 80C limit. Old regime only.', { sec80CCD1B: caps.sec80CCD1B });
  }

  const capSelf = isSenior ? caps.sec80DSelf.senior : caps.sec80DSelf.normal;
  const gapHealth = capSelf - Math.min(input.sec80DSelf, capSelf);
  if (gapHealth > 0) {
    offer('80d', `Health insurance: ${inr(gapHealth)} of limit unused`, 'Premiums for you, your spouse and children count. Old regime only.', { sec80DSelf: capSelf });
  }

  const capParents = input.parentsSenior ? caps.sec80DParents.senior : caps.sec80DParents.normal;
  const gapParents = capParents - Math.min(input.sec80DParents, capParents);
  if (gapParents > 0 && input.sec80DParents === 0) {
    offer('80d-parents', 'Parents\' health insurance has its own limit', `Up to ${inr(capParents)} on top of your own cover. Old regime only.`, { sec80DParents: capParents });
  }

  if (input.sources.salary && input.basicSalary > 0) {
    const npsCap = caps.employerNpsPct.new * input.basicSalary;
    const gapEmployer = npsCap - Math.min(input.employerNps, npsCap);
    if (gapEmployer > 0) {
      offer(
        'employer-nps',
        'Ask your employer about NPS',
        `Up to ${inr(npsCap)} of your salary can go through employer NPS, and this works in both regimes. It assumes the amount moves from taxable pay into NPS, with gross salary unchanged.`,
        { employerNps: npsCap },
      );
    }
  }

  suggestions.sort((a, b) => b.saving - a.saving);
  return suggestions;
}
