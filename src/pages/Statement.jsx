import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '../components/Button';
import ComputationTable from '../components/ComputationTable';
import { Notice } from '../components/FormControls';
import { loadDraft } from '../utils/draft';
import { computeHash, getHistory, recomputeRecord } from '../utils/hashChain';
import { computeTax } from '../utils/taxCalculator';
import { getRules } from '../utils/taxRules';
import { statementCsv } from '../utils/statement';
import { downloadFile, formatDateTime, inr } from '../utils/format';

const AGE_LABEL = { below60: 'Under 60', senior: '60 to 79', superSenior: '80 or over' };

function Meta({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-black/55">{label}</dt>
      <dd className="font-medium text-black">{value || '—'}</dd>
    </div>
  );
}

/** The figure the statement exists to answer, set apart so no one has to hunt for it. */
function TotalPayable({ result }) {
  const refund = result.balance < 0;
  const regime = result.filingRegime === 'old' ? 'Old' : 'New';
  return (
    <section aria-label="Total tax payable" className="mt-8 rounded-2xl border-2 border-black/80 p-5 sm:p-6 break-inside-avoid">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-black/60">
            {refund ? 'Refund due to you' : 'Total tax payable'}
          </p>
          <p className="figures font-display text-4xl sm:text-5xl font-semibold tracking-tight text-black mt-1">
            {inr(Math.abs(result.balance))}
          </p>
          <p className="text-sm text-black/65 mt-1">{regime} regime · rounded to the nearest ₹10</p>
        </div>
        <dl className="text-sm min-w-[240px] space-y-1.5">
          <div className="flex justify-between gap-6">
            <dt className="text-black/65">Total tax liability</dt>
            <dd className="figures text-black">{inr(result.chosen.totalTax)}</dd>
          </div>
          <div className="flex justify-between gap-6">
            <dt className="text-black/65">Less: tax already paid</dt>
            <dd className="figures text-black">{result.credits > 0 ? `(${inr(result.credits)})` : inr(0)}</dd>
          </div>
          <div className="flex justify-between gap-6 border-t border-black/30 pt-1.5 font-semibold">
            <dt className="text-black">{refund ? 'Refund due' : 'Payable'}</dt>
            <dd className="figures text-black">{inr(Math.abs(result.balance))}</dd>
          </div>
        </dl>
      </div>
      {!refund && result.balance > 0 && (
        <p className="text-xs text-black/60 mt-4 leading-relaxed">
          Pay this as self-assessment tax before you file. Interest and any late fee are extra if you file after the due date.
        </p>
      )}
    </section>
  );
}

function LegacyStatement({ record }) {
  const { data } = record;
  const isOld = data.recommended === 'old';
  return (
    <main className="min-h-screen pt-32 pb-16 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <Notice title="Saved by an earlier version of TaxTrust">
          This record is sealed and can be verified, but it stored only the totals, under FY 2024-25 rules, so a
          line-by-line statement isn't available.
        </Notice>
        <div className="bg-white border border-black/10 rounded-3xl p-6 space-y-2 text-sm">
          <p className="flex justify-between"><span className="text-muted">Saved</span><span className="text-ink">{formatDateTime(record.timestamp)}</span></p>
          <p className="flex justify-between"><span className="text-muted">Gross salary</span><span className="text-ink figures">{inr(data.inputs?.grossSalary)}</span></p>
          <p className="flex justify-between"><span className="text-muted">Old regime tax</span><span className="text-ink figures">{inr(data.oldRegimeTax)}</span></p>
          <p className="flex justify-between"><span className="text-muted">New regime tax</span><span className="text-ink figures">{inr(data.newRegimeTax)}</span></p>
          <p className="flex justify-between"><span className="text-muted">Recommended</span><span className="text-ink">{isOld ? 'Old regime' : 'New regime'}</span></p>
        </div>
        <Button variant="secondary" size="sm" to="/audit-log">Back to audit log</Button>
      </div>
    </main>
  );
}

export default function Statement() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isDraft = id === 'draft';
  const record = useMemo(() => (isDraft ? null : getHistory().find((r) => r.id === id) ?? null), [id, isDraft]);
  const [hashValid, setHashValid] = useState(null);

  useEffect(() => {
    if (!record) return undefined;
    let active = true;
    computeHash(record, record.previousHash).then((hash) => {
      if (active) setHashValid(hash === record.hash);
    });
    return () => { active = false; };
  }, [record]);

  const result = useMemo(() => {
    if (isDraft) return computeTax(loadDraft());
    return record?.v === 2 ? computeTax(record.data.input) : null;
  }, [isDraft, record]);

  if (!isDraft && !record) {
    return (
      <main className="min-h-screen pt-32 px-4">
        <div className="max-w-xl mx-auto space-y-4">
          <Notice tone="warn" title="We can't find that record">
            It isn't in this browser's audit log. Records are stored per browser, so it may have been saved on another device.
          </Notice>
          <Button variant="secondary" size="sm" to="/audit-log">Open audit log</Button>
        </div>
      </main>
    );
  }
  if (!isDraft && record.v !== 2) return <LegacyStatement record={record} />;
  if (isDraft && !result.hasIncome) {
    return (
      <main className="min-h-screen pt-32 px-4">
        <div className="max-w-xl mx-auto space-y-4">
          <Notice title="Nothing to print yet">Add your income in the calculator first.</Notice>
          <Button size="sm" to="/calculator?step=income">Add my income</Button>
        </div>
      </main>
    );
  }

  const rules = getRules(result.fy);
  const { input } = result;
  const recompute = record ? recomputeRecord(record).status : null;
  const tampered = hashValid === false || recompute === 'mismatch';

  const exportCsv = () => {
    const stem = record ? record.hash.slice(0, 10) : 'draft';
    downloadFile(`taxtrust-statement-${stem}.csv`, statementCsv(result, record), 'text/csv;charset=utf-8');
  };

  return (
    <main className="min-h-screen pt-28 lg:pt-32 pb-16 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="no-print flex flex-wrap items-center justify-between gap-3 mb-5">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>← Back</Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={exportCsv}>Download CSV</Button>
            <Button size="sm" onClick={() => window.print()}>Print or save as PDF</Button>
          </div>
        </div>

        {isDraft && (
          <Notice tone="warn" title="Draft, not sealed" className="no-print mb-5">
            Save it to your audit log to seal it and give it a verifiable hash.
          </Notice>
        )}
        {tampered && (
          <Notice tone="error" title="This record doesn't match its seal" className="mb-5">
            It was changed after it was saved. Don't rely on these figures.
          </Notice>
        )}
        {recompute === 'rules-changed' && (
          <Notice tone="warn" title="Tax rules have changed since this was sealed" className="no-print mb-5">
            The figures below use the current rules, so they can differ from what was saved.
          </Notice>
        )}

        <article className="statement-paper bg-cream text-black rounded-3xl p-6 sm:p-10">
          <header className="flex items-start justify-between gap-4 border-b border-black/20 pb-5">
            <div>
              <p className="font-display font-semibold text-sm">TaxTrust</p>
              <h1 className="font-display text-2xl sm:text-3xl font-semibold mt-1 text-black">Statement of computation of total income</h1>
            </div>
            <p className={`text-xs font-semibold shrink-0 px-2.5 py-1 rounded-full border ${tampered ? 'border-red-700 text-red-700' : 'border-black/30'}`}>
              {tampered ? 'Altered' : record ? 'Sealed' : 'Draft'}
            </p>
          </header>

          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-5 text-sm">
            <Meta label="Name" value={input.name} />
            <Meta label="PAN" value={input.pan} />
            <Meta label="Year" value={`${rules.label} (${rules.sublabel})`} />
            <Meta label="Age" value={AGE_LABEL[input.age]} />
            <Meta label="Status" value="Resident individual" />
            <Meta label="Filing under" value={`${result.filingRegime === 'old' ? 'Old' : 'New'} regime`} />
            <Meta label="Total tax" value={inr(result.chosen.totalTax)} />
            <Meta label={result.balance < 0 ? 'Refund due' : 'Total tax payable'} value={inr(Math.abs(result.balance))} />
          </dl>

          <ComputationTable result={result} tone="paper" />

          <TotalPayable result={result} />

          <footer className="mt-8 pt-5 border-t border-black/20 text-xs text-black/70 space-y-3 leading-relaxed">
            {record && (
              <p className="break-all">
                <strong className="text-black">{tampered ? 'Seal does not match.' : `Sealed ${formatDateTime(record.timestamp)}.`}</strong> SHA-256: <span className="font-mono">{record.hash}</span>
              </p>
            )}
            <p>
              Prepared from figures entered by the taxpayer, using TaxTrust engine {result.engineVersion}. A seal shows
              the record hasn't changed since it was saved. It isn't a certificate, a tax audit report or an opinion
              on the figures.
            </p>
            <div className="grid sm:grid-cols-2 gap-8 pt-6">
              <p className="border-t border-black/40 pt-1.5">Taxpayer's signature and date</p>
              <p className="border-t border-black/40 pt-1.5">Reviewed by (CA name, membership no.) and date</p>
            </div>
          </footer>
        </article>
      </div>
    </main>
  );
}
