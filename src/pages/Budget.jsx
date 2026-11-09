import { useEffect, useMemo, useState } from 'react';
import Button from '../components/Button';
import Card from '../components/Card';
import Footer from '../components/Footer';
import InvestmentProjection from '../components/budget/InvestmentProjection';
import BudgetBuilder from '../components/budget/BudgetBuilder';
import { MoneyField, Notice, Segmented } from '../components/FormControls';
import {
  applyDeductions,
  budgetCsv,
  budgetInsights,
  deductionChanges,
  EMPTY_BUDGET,
  estimateTakeHome,
  GROUPS,
  loadBudget,
  marginalRate,
  monthlyIncome,
  projectInvestments,
  saveBudget,
  summarizeBudget,
  TAX_TAGS,
  taxDeductibleSpending,
} from '../utils/budget';
import { loadDraft, saveDraft } from '../utils/draft';
import { computeTax } from '../utils/taxCalculator';
import { downloadFile, inr } from '../utils/format';

/* Validated with the dataviz palette checker: colourblind-safe and 3:1 on white. */
const GROUP_COLOR = { needs: '#1F8A70', wants: '#C27A1C', savings: '#2F6FB0' };
const LEFTOVER_COLOR = '#D9D9D4';

const pct = (value) => `${Math.round(value * 100)}%`;

function Swatch({ color }) {
  return <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} aria-hidden="true" />;
}

/* ── Income ───────────────────────────────────────── */

function IncomeCard({ budget, update, estimate }) {
  const hasEstimate = estimate.monthly > 0;
  const mode = hasEstimate ? budget.incomeMode : 'manual';
  return (
    <Card className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Money coming in</h2>
        <p className="text-sm text-muted mt-1">Your take-home pay each month, after tax.</p>
      </div>
      {hasEstimate && (
        <Segmented
          value={mode}
          onChange={(v) => update({ incomeMode: v })}
          options={[
            { value: 'estimate', label: 'Use my tax computation' },
            { value: 'manual', label: 'Enter my take-home' },
          ]}
        />
      )}
      {mode === 'estimate' ? (
        <div className="rounded-xl bg-surface px-4 py-3">
          <p className="figures font-display text-2xl font-semibold text-ink">{inr(estimate.monthly)} <span className="text-base font-normal text-muted">a month</span></p>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            Your income for the year less income tax, divided by 12. It doesn't know about PF or other payroll
            deductions, so the net pay on your payslip is more accurate.
          </p>
        </div>
      ) : (
        <>
          <MoneyField
            label="Take-home pay per month"
            value={budget.manualIncome}
            onChange={(v) => update({ manualIncome: v })}
            hint="The net pay on your payslip, plus any other regular income."
          />
          {!hasEstimate && (
            <p className="text-xs text-muted">
              Or{' '}
              <a href="/calculator?step=income" className="text-forest underline underline-offset-2">work out your tax first</a>{' '}
              and we'll estimate it for you.
            </p>
          )}
        </>
      )}
    </Card>
  );
}

/* ── Expense rows ─────────────────────────────────── */

function ExpenseRow({ entry, onChange, onRemove }) {
  const field = (key) => (value) => onChange({ ...entry, [key]: value });
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.25rem] sm:grid-cols-[minmax(0,1fr)_7rem_8.5rem_2.25rem] xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_7rem_8.5rem_2.25rem] gap-2 items-center py-2.5">
      <input
        type="text"
        value={entry.label}
        onChange={(e) => field('label')(e.target.value)}
        aria-label="Expense name"
        placeholder="Name this expense"
        className="col-span-2 sm:col-span-3 xl:col-span-1 min-w-0 font-medium bg-transparent border border-transparent hover:border-black/10 focus:border-forest focus:ring-1 focus:ring-forest rounded-lg px-2 py-2 text-ink placeholder-black/35 focus:outline-none"
      />
      <div className="col-span-3 sm:col-span-1 min-w-0">
        <MoneyField label={`${entry.label || 'Expense'} amount`} hideLabel compact value={entry.amount} onChange={field('amount')} />
      </div>
      <select
        value={entry.frequency}
        onChange={(e) => field('frequency')(e.target.value)}
        aria-label={`How often you pay ${entry.label || 'this'}`}
        className="min-w-0 bg-white border border-black/15 rounded-xl px-2.5 py-2.5 text-sm text-ink focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
      >
        <option value="monthly">Monthly</option>
        <option value="yearly">Yearly</option>
      </select>
      <select
        value={entry.tax ?? ''}
        onChange={(e) => field('tax')(e.target.value || null)}
        aria-label={`Tax deduction for ${entry.label || 'this'}`}
        className={`col-span-2 sm:col-span-1 min-w-0 bg-white border rounded-xl px-2.5 py-2.5 text-sm focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest ${entry.tax ? 'border-forest/40 text-forest font-medium' : 'border-black/15 text-muted'}`}
      >
        <option value="">No tax benefit</option>
        {Object.entries(TAX_TAGS).map(([key, tag]) => <option key={key} value={key}>{tag.label}</option>)}
      </select>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${entry.label || 'this expense'}`}
        className="col-start-3 row-start-1 sm:col-start-4 xl:col-start-auto xl:row-start-auto justify-self-end w-9 h-9 rounded-full text-muted hover:text-danger hover:bg-danger/10 flex items-center justify-center"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
      </button>
    </li>
  );
}

function GroupCard({ group, items, summary, onChangeItem, onRemove, onAdd }) {
  const total = summary.totals[group.id];
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink flex items-center gap-2">
            <Swatch color={GROUP_COLOR[group.id]} />
            {group.label}
          </h2>
          <p className="text-sm text-muted mt-1">{group.description}</p>
        </div>
        <p className="text-right">
          <span className="block figures font-display text-xl font-semibold text-ink">{inr(total)}</span>
          <span className="block text-xs text-muted">a month{summary.income > 0 ? ` · ${pct(total / summary.income)} of income` : ''}</span>
        </p>
      </div>
      <div className="hidden xl:grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_7rem_8.5rem_2.25rem] gap-2 mt-5 px-2 text-xs text-muted" aria-hidden="true">
        <span>Expense</span><span>Amount</span><span>How often</span><span>Tax deduction</span><span />
      </div>
      <ul className="divide-y divide-black/[0.06] mt-1">
        {items.map((entry) => (
          <ExpenseRow key={entry.id} entry={entry} onChange={onChangeItem} onRemove={() => onRemove(entry.id)} />
        ))}
      </ul>
      <Button variant="secondary" size="sm" onClick={() => onAdd(group.id)} className="mt-3">+ Add an expense</Button>
    </Card>
  );
}

/* ── Charts ───────────────────────────────────────── */

/** One stacked bar: where each rupee of income goes. */
function IncomeSplit({ summary }) {
  const base = Math.max(summary.income, summary.outflow);
  const segments = [
    ...summary.groups.map((g) => ({ id: g.id, label: g.label, amount: g.amount, color: GROUP_COLOR[g.id] })),
    ...(summary.leftover > 0 ? [{ id: 'left', label: 'Left over', amount: summary.leftover, color: LEFTOVER_COLOR }] : []),
  ].filter((s) => s.amount > 0);

  return (
    <div>
      <div className="flex h-10 rounded-lg overflow-hidden gap-[2px] bg-white" role="img" aria-label={segments.map((s) => `${s.label} ${inr(s.amount)}`).join(', ')}>
        {segments.map((s) => (
          <div
            key={s.id}
            title={`${s.label}: ${inr(s.amount)} a month (${pct(s.amount / base)})`}
            className="h-full first:rounded-l-lg last:rounded-r-lg transition-[width] duration-300"
            style={{ width: `${(s.amount / base) * 100}%`, background: s.color }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-2 mt-3 text-sm">
        {segments.map((s) => (
          <li key={s.id} className="flex items-center gap-2 text-ink/85">
            <Swatch color={s.color} />
            {s.label} <span className="figures text-muted">{pct(s.amount / base)}</span>
          </li>
        ))}
      </ul>
      {summary.overspending && (
        <p className="text-sm text-danger mt-3 flex items-center gap-1.5">
          <span aria-hidden="true">▲</span> Spending is {inr(-summary.leftover)} more than income, so the bar is scaled to spending.
        </p>
      )}
    </div>
  );
}

/** Table with inline bars: a chart and its own accessible table view at once. */
function WhereItGoes({ summary }) {
  const top = summary.categories[0]?.monthly ?? 0;
  const groupLabel = Object.fromEntries(GROUPS.map((g) => [g.id, g.label]));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[460px]">
        <caption className="sr-only">Monthly spending by item, largest first</caption>
        <thead>
          <tr className="text-muted border-b border-black/10">
            <th scope="col" className="text-left font-medium py-2">Item</th>
            <th scope="col" className="text-left font-medium py-2 w-[40%]"><span className="sr-only">Share of largest item</span></th>
            <th scope="col" className="text-right font-medium py-2">Per month</th>
            <th scope="col" className="text-right font-medium py-2">Of income</th>
          </tr>
        </thead>
        <tbody>
          {summary.categories.map((c) => (
            <tr key={c.id} className="border-b border-black/[0.05] last:border-0" title={`${c.label}: ${inr(c.monthly)} a month, ${groupLabel[c.group]}`}>
              <th scope="row" className="text-left font-normal text-ink py-2 pr-3">
                <span className="flex items-center gap-2"><Swatch color={GROUP_COLOR[c.group]} />{c.label || 'Unnamed'}</span>
              </th>
              <td className="py-2 pr-3">
                <div className="h-2.5 rounded-r bg-transparent">
                  <div className="h-full rounded-r" style={{ width: `${(c.monthly / top) * 100}%`, background: GROUP_COLOR[c.group] }} />
                </div>
              </td>
              <td className="py-2 text-right figures text-ink">{inr(c.monthly)}</td>
              <td className="py-2 text-right figures text-muted">{summary.income > 0 ? pct(c.share) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Summary rail ─────────────────────────────────── */

function TaxLink({ deductible, onApplied }) {
  const [confirming, setConfirming] = useState(false);
  const [applied, setApplied] = useState(false);
  const changes = deductionChanges(loadDraft(), deductible);

  if (deductible.length === 0) {
    return (
      <p className="text-sm text-white/65">
        Tag spending such as PPF, ELSS, insurance or rent with its tax deduction, and we'll total it for your tax computation.
      </p>
    );
  }

  const apply = () => {
    saveDraft(applyDeductions(loadDraft(), changes));
    setApplied(true);
    setConfirming(false);
    onApplied?.();
  };

  return (
    <div className="space-y-3">
      <ul className="space-y-1.5 text-sm">
        {deductible.map((d) => (
          <li key={d.field} className="flex justify-between gap-3">
            <span className="text-white/70">{d.name}</span>
            <span className="figures text-white">{inr(d.amount)}<span className="text-white/60">/yr</span></span>
          </li>
        ))}
      </ul>
      {applied ? (
        <p className="text-sm text-lime">
          Added to your tax computation. <a href="/calculator?step=review" className="underline underline-offset-2">See the result</a>
        </p>
      ) : changes.length === 0 ? (
        <p className="text-sm text-white/65">Your tax computation already uses these figures.</p>
      ) : confirming ? (
        <div className="rounded-xl bg-white/10 p-3 text-sm space-y-2">
          <p className="text-white font-medium">This will change your tax computation:</p>
          <ul className="space-y-1">
            {changes.map((c) => (
              <li key={c.field} className="flex justify-between gap-3 text-white/80">
                <span>{c.name}</span>
                <span className="figures">{inr(c.from)} → <span className="text-lime">{inr(c.to)}</span></span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={apply}>Update it</Button>
            <Button size="sm" variant="ghostDark" onClick={() => setConfirming(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" onClick={() => setConfirming(true)} className="w-full">Use these in my tax computation</Button>
      )}
    </div>
  );
}

function SummaryCard({ summary, deductible, onApplied, projection }) {
  const empty = summary.outflow === 0;
  return (
    <Card variant="forest" className="space-y-5">
      <div>
        <p className="text-sm text-white/65">{summary.overspending ? 'Overspending each month' : 'Left over each month'}</p>
        <p className={`figures font-display text-[40px] leading-tight font-medium tracking-tight mt-1 ${summary.overspending ? 'text-[#FFB4A8]' : 'text-white'}`}>
          {inr(Math.abs(summary.leftover))}
        </p>
        <p className="text-sm text-white/65 mt-1">
          {summary.income > 0 ? `Savings rate ${pct(summary.savingsRate)}` : 'Add your take-home pay to see this'}
        </p>
      </div>

      <dl className="border-t border-white/10 pt-4 space-y-2 text-sm">
        <div className="flex justify-between"><dt className="text-white/65">Take-home pay</dt><dd className="figures text-white">{inr(summary.income)}</dd></div>
        <div className="flex justify-between"><dt className="text-white/65">Spending</dt><dd className="figures text-white">{inr(summary.spending)}</dd></div>
        <div className="flex justify-between"><dt className="text-white/65">Saving and investing</dt><dd className="figures text-white">{inr(summary.totals.savings)}</dd></div>
        {projection.afterTax > 0 && (
          <div className="flex justify-between gap-3">
            <dt className="text-white/65">Could grow to, in {projection.years} yrs, after tax</dt>
            <dd className="figures text-lime whitespace-nowrap">about {inr(projection.afterTax)}</dd>
          </div>
        )}
      </dl>

      {!empty && summary.income > 0 && (
        <div className="border-t border-white/10 pt-4">
          <p className="text-sm text-white/65 mb-2">Against the 50/30/20 guideline</p>
          <ul className="space-y-1.5 text-sm">
            {summary.groups.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3">
                <span className="text-white/85">{g.label}</span>
                <span className="figures">
                  <span className="text-white">{pct(g.share)}</span>
                  <span className="text-white/55"> / {pct(g.target)}</span>
                  {g.offTarget && <span className="ml-1.5 text-lime" aria-label="off target">●</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-white/10 pt-4">
        <p className="text-sm font-medium text-white mb-2">Spending that can lower your tax</p>
        <TaxLink deductible={deductible} onApplied={onApplied} />
        <p className="text-xs text-white/55 mt-2">These deductions count under the old regime only.</p>
      </div>
    </Card>
  );
}

/* ── Page ─────────────────────────────────────────── */

export default function Budget() {
  const [budget, setBudget] = useState(loadBudget);
  // Re-read after "Use these in my tax computation" changes the tax draft.
  const [taxResult, setTaxResult] = useState(() => computeTax(loadDraft()));
  const [confirmingReset, setConfirmingReset] = useState(false);

  useEffect(() => { saveBudget(budget); }, [budget]);

  const estimate = estimateTakeHome(taxResult);
  const effectiveBudget = estimate.monthly > 0 ? budget : { ...budget, incomeMode: 'manual' };
  const income = monthlyIncome(effectiveBudget, taxResult);
  const summary = useMemo(() => summarizeBudget(budget, income), [budget, income]);
  const deductible = useMemo(() => taxDeductibleSpending(budget), [budget]);
  const insights = useMemo(() => budgetInsights(summary, budget, taxResult.fy), [summary, budget, taxResult.fy]);
  const horizon = budget.horizon ?? 10;
  // Tax on interest, debt funds and NPS follows your slab: read it from your tax
  // computation unless you pick one. 20% plus cess when there's nothing to read.
  const autoRate = useMemo(() => marginalRate(taxResult), [taxResult]);
  const taxRate = budget.taxRate ?? 'auto';
  const slabRate = taxRate === 'auto' ? (autoRate ?? 0.2 * 1.04) : taxRate * 1.04;
  const projection = useMemo(() => projectInvestments(budget, horizon, { slabRate }), [budget, horizon, slabRate]);

  const update = (changes) => setBudget((prev) => ({ ...prev, ...changes }));
  const changeItem = (next) => setBudget((prev) => ({ ...prev, items: prev.items.map((e) => (e.id === next.id ? next : e)) }));
  const removeItem = (id) => setBudget((prev) => ({ ...prev, items: prev.items.filter((e) => e.id !== id) }));
  const addItem = (group) => setBudget((prev) => ({
    ...prev,
    items: [...prev.items, { id: crypto.randomUUID(), group, label: '', amount: 0, frequency: 'monthly', tax: null }],
  }));

  const setReturnType = (id, returnType) => setBudget((prev) => ({ ...prev, items: prev.items.map((e) => (e.id === id ? { ...e, returnType } : e)) }));

  const exportCsv = () => downloadFile('taxtrust-budget.csv', budgetCsv(budget, summary), 'text/csv;charset=utf-8');
  const reset = () => {
    setBudget(EMPTY_BUDGET);
    setConfirmingReset(false);
  };

  return (
    <main className="min-h-screen pt-28 lg:pt-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-sm font-medium text-forest">Budget planner</p>
            <h1 className="font-display text-3xl md:text-[44px] font-medium tracking-tight text-ink mt-1">Where does your money go?</h1>
            <p className="text-muted mt-2 max-w-2xl">
              Add what you spend in a typical month. Enter yearly bills, like insurance, as yearly and we'll spread them out.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {confirmingReset ? (
              <>
                <span className="text-muted">Clear every amount?</span>
                <Button size="sm" variant="danger" onClick={reset}>Yes, clear</Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmingReset(false)}>Keep</Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="secondary" onClick={exportCsv} disabled={summary.outflow === 0}>Download CSV</Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmingReset(true)}>Start over</Button>
              </>
            )}
          </div>
        </header>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-8 items-start">
          <aside className="order-first lg:order-none lg:col-start-2 lg:row-start-1 lg:sticky lg:top-28" aria-label="Budget summary">
            <SummaryCard summary={summary} deductible={deductible} projection={projection} onApplied={() => setTaxResult(computeTax(loadDraft()))} />
          </aside>

          <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-1">
            <IncomeCard budget={effectiveBudget} update={update} estimate={estimate} />

            <BudgetBuilder
              income={income}
              budget={budget}
              taxResult={taxResult}
              onApply={(items, builder) => update({ items, builder })}
            />

            {GROUPS.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                items={budget.items.filter((e) => e.group === group.id)}
                summary={summary}
                onChangeItem={changeItem}
                onRemove={removeItem}
                onAdd={addItem}
              />
            ))}

            {projection.items.length > 0 && (
              <InvestmentProjection
                projection={projection}
                years={horizon}
                onYears={(years) => update({ horizon: years })}
                onReturnType={setReturnType}
                taxRate={taxRate}
                autoRate={autoRate}
                onTaxRate={(rate) => update({ taxRate: rate })}
              />
            )}

            {summary.outflow > 0 && (
              <>
                <Card className="space-y-6">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-ink">How your income is split</h2>
                    <div className="mt-4"><IncomeSplit summary={summary} /></div>
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-semibold text-ink">Where your money goes</h2>
                    <div className="mt-3"><WhereItGoes summary={summary} /></div>
                  </div>
                </Card>

                <section aria-label="Budget observations" className="space-y-3">
                  {insights.map((insight) => (
                    <Notice key={insight.title} tone={insight.tone} title={insight.title}>{insight.detail}</Notice>
                  ))}
                  <p className="text-xs text-muted">General guidance from simple rules, not personal financial advice.</p>
                </section>
              </>
            )}

            <p className="text-xs text-muted">Your budget is saved in this browser only.</p>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}
