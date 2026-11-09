# TaxTrust

Indian income tax computation for people who would otherwise pay an auditor to work out their numbers. It produces a line-by-line statement under both regimes, checks whether a tax audit applies, and seals each saved computation so a CA can verify it. A budget planner shows where take-home pay goes, and can send tax-deductible spending, such as PPF, ELSS, insurance and rent, into the computation.

It runs entirely in the browser. There is no backend or account, and figures are stored in `localStorage`.

## Run it

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

`npm test` uses Node's built-in test runner, so it needs no extra dependencies. `npm run build` makes a static site, and `npm run lint` runs oxlint.

## How the code is organised

| Path | What it does |
| --- | --- |
| `src/utils/taxRules.js` | Every rate, limit and date, per financial year, plus section references |
| `src/utils/taxCalculator.js` | The computation. Pure: same input, same result |
| `src/utils/compliance.js` | Tax audit check, ITR form, due dates, advance tax, late cost, review flags, documents |
| `src/utils/insightsEngine.js` | Tax-saving suggestions, each measured by re-running the engine |
| `src/utils/statement.js` | Statement rows shared by screen, print and CSV |
| `src/utils/hashChain.js` | The sealed audit log, export, import and verification |
| `src/utils/budgetBuilder.js` | Builds a starting budget from take-home pay, household, housing and a 50/30/20-style plan |
| `src/utils/budget.js` | Monthly budget: totals, 50/30/20, take-home estimate, tax-deductible spending, investment returns and the tax due on them |

## Coverage

Resident individuals for FY 2025-26 and FY 2026-27: salary, house property, business or profession (44AD, 44ADA or actual profit), capital gains, other sources, Chapter VI-A deductions, age-based slabs, rebate and its marginal relief, surcharge and its marginal relief, cess, rounding under 288A and 288B, and taxes paid.

Known simplifications, which a CA should check when they matter:

- Business losses are treated as nil, not set off or carried forward.
- Loss on a let-out house beyond ₹2 lakh is reported, but carry-forward schedules are not tracked.
- Excess house property loss does not reduce capital gains.
- Surcharge on dividends is not capped at 15%, so tax can be slightly overstated above ₹2 crore. The app flags this.
- Employer NPS uses the 10% old regime limit. Government employees get 14%.
- Older property sales that can choose indexation are taxed at 12.5% only.
- 234A and 234B are estimates that treat self-assessment tax as unpaid. 234C is left out because it needs payment dates.
- Business and professional income are entered as one source.
- Multi-client management and Form 16 import are not built yet.

## Updating for a new tax year

1. Add an entry to `TAX_YEARS` in `src/utils/taxRules.js`, and update `DEFAULT_FY`.
2. Bump `ENGINE_VERSION` if any rule or formula changes. Saved records keep the version they were made with, so verification reports "older rules" instead of "altered".
3. Add golden cases to `src/utils/taxCalculator.test.js`. Work the expected figures by hand from the rates, never from the engine's output.

## Rule sources

Rates, limits and dates were checked in November 2026 against published guides, not the primary text of the Acts, so a CA should confirm them before you rely on this in production:

- Slabs, rebate and standard deduction: Budget 2026 left them unchanged for FY 2026-27.
- Metro HRA: the four extra cities apply from FY 2026-27 only, under the Income-tax Rules 2026.
- Audit dates for AY 2026-27: 21 October and 21 November 2026, from a CBDT press release of 28 September 2026 as reported by several secondary sources.
- Income-tax Act 2025 section numbers come mainly from one mapping table. Provisions with no verified mapping show their old 1961 number, marked "old". Check all of them against the CBDT concordance table before relying on them.

## What the seal proves

A verified record is unchanged since it was saved, and its tax still recomputes from its inputs. It says nothing about whether the inputs were true.

`localStorage` is under the user's control, so someone could rewrite the entire chain and recompute every hash. Only a head hash held by someone else, such as the CA, can detect that. The app prompts users to share it, and the Verify page checks it.
