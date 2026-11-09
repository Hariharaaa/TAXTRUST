import { useMemo, useState } from 'react';
import Button from '../Button';
import Card from '../Card';
import { ChoiceCard, MoneyField, Notice, Segmented } from '../FormControls';
import { DEFAULT_ITEMS, GROUPS } from '../../utils/budget';
import { applyBuiltBudget, buildBudget, DEFAULT_BUILDER, HOUSEHOLDS, HOUSING, PLANS } from '../../utils/budgetBuilder';
import { inr } from '../../utils/format';

/* Same validated group colours as the rest of the budget page. */
const GROUP_COLOR = { needs: '#1F8A70', wants: '#C27A1C', savings: '#2F6FB0' };
const DEFAULT_IDS = new Set(DEFAULT_ITEMS.map((i) => i.id));

const options = (map) => Object.entries(map).map(([value, label]) => ({ value, label }));

function Preview({ built, income }) {
  const base = Math.max(income, built.totals.needs + built.totals.wants + built.totals.savings);
  return (
    <div className="rounded-2xl bg-surface p-4 space-y-3">
      <div className="flex h-3 rounded-full overflow-hidden gap-[2px] bg-white" aria-hidden="true">
        {GROUPS.map((g) => (
          <div key={g.id} style={{ width: `${(built.totals[g.id] / base) * 100}%`, background: GROUP_COLOR[g.id] }} />
        ))}
      </div>
      <dl className="grid grid-cols-3 gap-3 text-sm">
        {GROUPS.map((g) => (
          <div key={g.id}>
            <dt className="flex items-center gap-1.5 text-muted">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: GROUP_COLOR[g.id] }} aria-hidden="true" />
              {g.id === 'savings' ? 'Savings' : g.label}
            </dt>
            <dd className="figures font-display text-lg font-semibold text-ink">{inr(built.totals[g.id])}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function BudgetBuilder({ income, budget, taxResult, onApply }) {
  const [prefs, setPrefs] = useState(() => ({ ...DEFAULT_BUILDER, ...budget.builder }));
  const [open, setOpen] = useState(() => budget.items.every((i) => !(Number(i.amount) > 0)));
  const [undo, setUndo] = useState(null);
  const set = (key) => (value) => setPrefs((prev) => ({ ...prev, [key]: value }));

  const tax = useMemo(() => (taxResult?.hasIncome
    ? { recommended: taxResult.recommended, fy: taxResult.fy, senior: taxResult.input.age !== 'below60', parentsSenior: taxResult.input.parentsSenior }
    : null), [taxResult]);
  const built = useMemo(() => buildBudget({ income, prefs, items: budget.items, tax }), [income, prefs, budget.items, tax]);
  const replacing = budget.items.some((i) => DEFAULT_IDS.has(i.id) && Number(i.amount) > 0);
  const needsAmount = prefs.housing === 'rent' || prefs.housing === 'loan';

  const apply = () => {
    setUndo(budget.items);
    onApply(applyBuiltBudget(budget.items, built.amounts), prefs);
    setOpen(false);
  };
  const restore = () => {
    onApply(undo, prefs);
    setUndo(null);
  };

  if (!open) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Build my budget automatically</h2>
          <p className="text-sm text-muted mt-1">
            {undo ? 'Done. Every line below is filled in, and you can change any of them.' : 'Fill every line from your take-home pay in a few clicks.'}
          </p>
        </div>
        <div className="flex gap-2">
          {undo && <Button variant="ghost" size="sm" onClick={restore}>Undo</Button>}
          <Button variant={undo ? 'secondary' : 'forest'} size="sm" onClick={() => setOpen(true)}>{undo ? 'Rebuild' : 'Build it for me'}</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-6 ring-2 ring-forest/15">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Build my budget automatically</h2>
          <p className="text-sm text-muted mt-1">
            Answer three questions and we'll fill in every line from your{' '}
            <span className="figures text-ink font-medium">{inr(income)}</span> a month. You can change anything afterwards.
          </p>
        </div>
        {!(budget.items.every((i) => !(Number(i.amount) > 0))) && (
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Close</Button>
        )}
      </div>

      {income <= 0 ? (
        <Notice tone="warn" title="Add your take-home pay first">The builder splits your income, so it needs to know it.</Notice>
      ) : (
        <>
          <Segmented label="Who's in your household?" value={prefs.household} onChange={set('household')} options={options(HOUSEHOLDS)} />

          <div className="space-y-3">
            <Segmented label="Your home" value={prefs.housing} onChange={set('housing')} options={options(HOUSING)} />
            {needsAmount && (
              <div className="max-w-xs">
                <MoneyField
                  label={prefs.housing === 'rent' ? 'Rent per month' : 'Home loan EMI per month'}
                  value={prefs.housingAmount}
                  onChange={set('housingAmount')}
                />
              </div>
            )}
          </div>

          <fieldset>
            <legend className="text-sm font-medium text-ink/90 mb-1.5">How do you want to split it?</legend>
            <div className="grid sm:grid-cols-3 gap-3">
              {Object.entries(PLANS).map(([key, plan]) => (
                <ChoiceCard
                  key={key}
                  type="radio"
                  name="budget-plan"
                  checked={prefs.plan === key}
                  onChange={() => set('plan')(key)}
                  title={plan.label}
                  description={plan.description}
                />
              ))}
            </div>
          </fieldset>

          <Preview built={built} income={income} />

          {built.warnings.map((w) => <Notice key={w} tone="warn">{w}</Notice>)}
          {built.notes.length > 0 && (
            <ul className="text-sm text-muted space-y-1.5 list-disc pl-5">
              {built.notes.map((n) => <li key={n}>{n}</li>)}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="forest" onClick={apply}>{replacing ? 'Replace my amounts' : 'Fill in my budget'}</Button>
            {replacing && <p className="text-xs text-muted">This replaces the standard lines. Lines you added yourself stay as they are.</p>}
          </div>
        </>
      )}
    </Card>
  );
}
