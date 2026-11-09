import { useMemo, useState } from 'react';
import Button from '../Button';
import Card from '../Card';
import ComputationTable from '../ComputationTable';
import { Notice, Segmented } from '../FormControls';
import { SaveAction } from './SummaryRail';
import { breakEvenDeduction, generateSuggestions } from '../../utils/insightsEngine';
import { statementCsv } from '../../utils/statement';
import { getRules } from '../../utils/taxRules';
import { downloadFile, formatDate, inr } from '../../utils/format';

const TABS = [
  { id: 'computation', label: 'Computation' },
  { id: 'checks', label: 'Checks' },
  { id: 'save', label: 'Save tax' },
  { id: 'filing', label: 'Audit and filing' },
  { id: 'documents', label: 'Documents' },
];

function TabButton({ tab, active, badge, onClick }) {
  return (
    <button
      type="button"
      role="tab"
      id={`tab-${tab.id}`}
      aria-selected={active}
      aria-controls={`panel-${tab.id}`}
      onClick={onClick}
      className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
        active ? 'bg-forest text-white' : 'text-muted hover:text-ink hover:bg-black/[0.05]'
      }`}
    >
      {tab.label}
      {badge > 0 && <span className="ml-1.5 figures text-xs text-caution">{badge}</span>}
    </button>
  );
}

function ComputationTab({ result, save }) {
  const exportCsv = () => {
    downloadFile(`taxtrust-computation-FY${result.fy}.csv`, statementCsv(result), 'text/csv;charset=utf-8');
  };

  return (
    <div className="space-y-4">
      <Card className="!p-4 sm:!p-6">
        <ComputationTable result={result} />
      </Card>
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" size="sm" to="/statement/draft">Open printable statement</Button>
        <Button variant="secondary" size="sm" onClick={exportCsv}>Download CSV</Button>
      </div>
      <Card className="lg:hidden">
        <SaveAction save={save} />
      </Card>
    </div>
  );
}

const FLAG_STYLE = {
  error: { label: 'Fix this', tone: 'error' },
  warn: { label: 'Check this', tone: 'warn' },
  info: { label: 'Good to know', tone: 'info' },
};

function ChecksTab({ flags, onGoToStep }) {
  if (flags.length === 0) {
    return (
      <Notice tone="success" title="Nothing to query">
        These figures are consistent with each other. That doesn't prove they're complete, so match them against
        your AIS and Form 26AS before you file.
      </Notice>
    );
  }
  return (
    <ul className="space-y-3">
      {flags.map((flag) => {
        const style = FLAG_STYLE[flag.level];
        const canJump = !['review'].includes(flag.step);
        return (
          <li key={flag.id}>
            <Notice tone={style.tone}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted">{style.label}</p>
                  <p className="font-semibold text-ink">{flag.title}</p>
                  <p className="mt-0.5">{flag.detail}</p>
                </div>
                {canJump && (
                  <button
                    type="button"
                    onClick={() => onGoToStep(flag.step)}
                    className="shrink-0 text-sm text-forest hover:underline whitespace-nowrap"
                  >
                    Go to field
                  </button>
                )}
              </div>
            </Notice>
          </li>
        );
      })}
    </ul>
  );
}

function BudgetLink() {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="font-display font-semibold text-ink">Plan your monthly budget</p>
        <p className="text-sm text-muted">See where your take-home pay goes, and send PPF, ELSS, insurance and rent straight into these deductions.</p>
      </div>
      <Button variant="secondary" size="sm" to="/budget">Open budget planner</Button>
    </Card>
  );
}

function SaveTaxTab({ result }) {
  const suggestions = useMemo(() => generateSuggestions(result), [result]);
  const breakEven = useMemo(() => breakEvenDeduction(result), [result]);
  const showBreakEven = result.recommended === 'new' && result.savings > 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted leading-relaxed">
        Each saving below comes from re-running your computation with that one change, so it's the real difference
        to your best regime. These are rule-based estimates, not personal advice.
      </p>

      {showBreakEven && (
        <Notice title="When would the old regime win?">
          {breakEven === null
            ? 'At this income, no amount of deductions brings the old regime level with the new one.'
            : <>You'd need about <strong className="figures text-ink">{inr(breakEven)}</strong> more in old regime deductions to match the new regime.</>}
        </Notice>
      )}

      {suggestions.length > 0 ? (
        <ul className="space-y-3">
          {suggestions.map((s) => (
            <li key={s.id}>
              <Card className="!p-4 flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-ink">{s.headline}</p>
                  <p className="text-sm text-muted mt-0.5 leading-relaxed">{s.detail}</p>
                </div>
                <p className="shrink-0 text-right">
                  <span className="block figures font-display font-semibold text-forest">{inr(s.saving)}</span>
                  <span className="block text-xs text-muted">saved</span>
                </p>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Notice tone="success" title="No easy wins left">
          None of the common deductions would lower your tax on these figures.
        </Notice>
      )}

      <BudgetLink />
    </div>
  );
}

function InvalidPresumptive({ result }) {
  const { input } = result;
  const isInvalid = input.sources.business && input.bizScheme === 'presumptive' && !result.presumptiveEligible;
  if (!isInvalid) return null;
  return (
    <Notice tone="error" title="Don't rely on the tax figure yet">
      Your receipts are above the presumptive limit, so this tax is based on a method you can't use. Switch to "From
      my books" on the income step and enter your actual expenses.
    </Notice>
  );
}

const AUDIT_TONE = { required: 'error', 'not-required': 'success', none: 'success' };

function FilingTab({ result, review }) {
  const { audit, form, plan, advanceTax } = review;
  const rules = getRules(result.fy);

  return (
    <div className="space-y-4">
      <Notice tone={AUDIT_TONE[audit.status]} title={audit.headline}>
        <ul className="space-y-1">
          {audit.reasons.map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
        {audit.status === 'required' ? (
          <p className="mt-2">
            Only a practising chartered accountant can sign a tax audit report. Take your statement and audit log to them.
          </p>
        ) : audit.status === 'not-required' && (
          <p className="mt-2 text-muted">Checked against {audit.reference}. Other conditions can apply, so confirm with your CA if you're near a limit.</p>
        )}
      </Notice>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="!p-5">
          <p className="text-sm text-muted">Return form</p>
          <p className="font-display text-2xl font-semibold text-ink mt-1">{form.form}</p>
          <p className="text-sm text-muted mt-1 leading-relaxed">{form.reason}</p>
          <p className="text-xs text-muted mt-2 leading-relaxed">
            Foreign assets, unlisted shares or a directorship mean ITR-2 or ITR-3 instead.
          </p>
        </Card>
        <Card className="!p-5">
          <p className="text-sm text-muted">Due date</p>
          <p className="font-display text-2xl font-semibold text-ink mt-1">{formatDate(`${plan.dueDate}T12:00:00`)}</p>
          {plan.isLate ? (
            <p className="text-sm text-caution mt-1">
              {plan.belatedClosed
                ? 'Both this date and the belated window have passed. Ask your CA about an updated return.'
                : `This has passed. You can still file a belated return by ${formatDate(`${plan.belatedDate}T12:00:00`)}.`}
            </p>
          ) : (
            <p className="text-sm text-muted mt-1">Belated returns are accepted until {formatDate(`${plan.belatedDate}T12:00:00`)}.</p>
          )}
          {audit.status === 'required' && (
            <p className={`text-xs mt-2 ${plan.auditReportPassed ? 'text-caution' : 'text-muted'}`}>
              {plan.auditReportDate
                ? `Audit report due ${formatDate(`${plan.auditReportDate}T12:00:00`)}${plan.auditReportPassed ? ', which has passed. Speak to your CA now.' : '.'}`
                : `Confirm the audit report date for ${rules.label} with your CA.`}
            </p>
          )}
        </Card>
      </div>

      {plan.lateCost > 0 && (
        <Card className="!p-5">
          <h3 className="font-display font-semibold text-ink">
            {plan.isLate ? 'Estimated cost of filing today' : 'Estimated interest if you file on the due date'}
          </h3>
          <dl className="mt-3 space-y-1.5 text-sm">
            {plan.lateFee > 0 && <Row label="Late filing fee (234F)" value={inr(plan.lateFee)} />}
            {plan.interest234A > 0 && <Row label="Interest for filing late (234A)" value={inr(plan.interest234A)} />}
            {plan.interest234B > 0 && <Row label="Interest for short advance tax (234B)" value={inr(plan.interest234B)} />}
            <Row label="Total" value={inr(plan.lateCost)} strong />
          </dl>
          <p className="text-xs text-muted mt-3 leading-relaxed">
            An estimate, on top of your tax. It leaves out 234C interest, which depends on the date of each payment.
          </p>
        </Card>
      )}

      <Card className="!p-5">
        <h3 className="font-display font-semibold text-ink">Advance tax</h3>
        {!advanceTax.applies ? (
          <p className="text-sm text-muted mt-2">{advanceTax.reason}</p>
        ) : (
          <>
            <p className="text-sm text-muted mt-1">
              {inr(advanceTax.liability)} is left after TDS and TCS.
              {advanceTax.presumptiveOnly && ' Presumptive income is paid in one instalment.'}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm mt-3 min-w-[420px]">
                <thead>
                  <tr className="text-muted border-b border-black/15">
                    <th scope="col" className="text-left font-medium py-2">Pay by</th>
                    <th scope="col" className="text-right font-medium py-2">Due by then</th>
                    <th scope="col" className="text-right font-medium py-2">Still short</th>
                    <th scope="col" className="text-right font-medium py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {advanceTax.rows.map((row) => {
                    const missed = row.passed && row.shortfall > 0;
                    const isNext = row === advanceTax.next;
                    return (
                      <tr key={row.label} className="border-b border-black/[0.06] last:border-0">
                        <td className="py-2 text-ink">{row.label}</td>
                        <td className="py-2 text-right figures text-ink/85">{inr(row.cumulative)}</td>
                        <td className="py-2 text-right figures text-ink/85">{inr(row.shortfall)}</td>
                        <td className={`py-2 text-right ${missed ? 'text-danger' : isNext ? 'text-forest' : 'text-muted'}`}>
                          {missed ? 'Missed' : isNext ? 'Next' : row.passed ? 'Paid' : 'Upcoming'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function Row({ label, value, strong }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? 'font-semibold text-ink border-t border-black/10 pt-2' : ''}`}>
      <dt className={strong ? '' : 'text-muted'}>{label}</dt>
      <dd className="figures text-ink">{value}</dd>
    </div>
  );
}

function DocumentsTab({ documents }) {
  const [ticked, setTicked] = useState({});
  const groups = [...new Set(documents.map((d) => d.group))];
  const done = documents.filter((d) => ticked[d.item]).length;

  return (
    <Card>
      <p className="text-sm text-muted mb-4">
        <span className="figures text-ink font-semibold">{done} of {documents.length}</span> ready. Based on the
        income and deductions you've entered.
      </p>
      <div className="space-y-5">
        {groups.map((group) => (
          <fieldset key={group}>
            <legend className="font-display font-semibold text-ink mb-2">{group}</legend>
            <div className="space-y-2">
              {documents.filter((d) => d.group === group).map((doc) => (
                <label key={doc.item} className="flex items-start gap-3 text-sm text-ink/85 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!ticked[doc.item]}
                    onChange={(event) => setTicked((prev) => ({ ...prev, [doc.item]: event.target.checked }))}
                    className="mt-0.5 h-4 w-4 accent-[#1C4640]"
                  />
                  <span>{doc.item}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </Card>
  );
}

export default function ReviewPanel({ result, review, input, set, save, tab, onTab, onGoToStep }) {
  if (!result.hasIncome) {
    return (
      <Notice title="Nothing to review yet">
        <button type="button" onClick={() => onGoToStep('income')} className="underline underline-offset-2 hover:text-ink">
          Add your income
        </button>{' '}
        to see your computation.
      </Notice>
    );
  }

  const activeTab = TABS.some((t) => t.id === tab) ? tab : 'computation';
  const attention = review.flags.filter((f) => f.level !== 'info').length;

  return (
    <div className="space-y-5">
      <InvalidPresumptive result={result} />
      <Segmented
        label="Regime you'll file under"
        value={input.filingRegime}
        onChange={(v) => set('filingRegime', v)}
        options={[
          { value: 'auto', label: `Best for me (${result.recommended})` },
          { value: 'new', label: 'New regime' },
          { value: 'old', label: 'Old regime' },
        ]}
      />

      <div role="tablist" aria-label="Review sections" className="no-print flex gap-1 overflow-x-auto scrollbar-hide -mx-1 px-1">
        {TABS.map((t) => (
          <TabButton
            key={t.id}
            tab={t}
            active={activeTab === t.id}
            badge={t.id === 'checks' ? attention : 0}
            onClick={() => onTab(t.id)}
          />
        ))}
      </div>

      <div role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
        {activeTab === 'computation' && <ComputationTab result={result} save={save} />}
        {activeTab === 'checks' && <ChecksTab flags={review.flags} onGoToStep={onGoToStep} />}
        {activeTab === 'save' && <SaveTaxTab result={result} />}
        {activeTab === 'filing' && <FilingTab result={result} review={review} />}
        {activeTab === 'documents' && <DocumentsTab documents={review.documents} />}
      </div>
    </div>
  );
}
