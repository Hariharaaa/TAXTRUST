import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/Button';
import Card from '../components/Card';
import Footer from '../components/Footer';
import { Notice } from '../components/FormControls';
import { clearChain, exportChain, getHistory, rowStatus, verifyChain } from '../utils/hashChain';
import { getRules } from '../utils/taxRules';
import { downloadFile, formatDateTime, inr, shortHash } from '../utils/format';

/** Figures for a record, whichever version of the app saved it. */
function describe(record) {
  if (record.v === 2) {
    const { summary, input, fy } = record.data;
    return { name: input.name || 'Unnamed', year: getRules(fy).label, regime: summary.filingRegime, tax: summary.totalTax };
  }
  const regime = record.data?.recommended === 'old' ? 'old' : 'new';
  return {
    name: 'Unnamed',
    year: 'FY 2024-25',
    regime,
    tax: regime === 'old' ? record.data?.oldRegimeTax : record.data?.newRegimeTax,
  };
}

function HeadHash({ head, count }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(head);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Card className="!p-5">
      <h2 className="font-display font-semibold text-ink">Share this with your CA</h2>
      <p className="text-sm text-muted mt-1 leading-relaxed">
        This code stands for {count === 1 ? 'your record' : `all ${count} records`}. Send it to your CA after each save. If
        anyone later changes or deletes a record here, even with access to this browser, the code they have
        will no longer match.
      </p>
      <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
        <code className="flex-1 min-w-0 font-mono text-xs text-forest bg-black/[0.04] border border-black/10 rounded-lg p-3 break-all">{head}</code>
        <Button variant="secondary" size="sm" onClick={copy} className="shrink-0">{copied ? 'Copied' : 'Copy'}</Button>
      </div>
    </Card>
  );
}

function ClearControl({ onExport, onClear }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>Delete all records</Button>;
  }
  return (
    <Notice tone="error" title="Delete your whole audit trail?" className="w-full">
      This can't be undone. Download a copy first if you may need these records.
      <div className="flex flex-wrap gap-2 mt-3">
        <Button size="sm" variant="secondary" onClick={onExport}>Download a copy</Button>
        <Button size="sm" variant="danger" onClick={onClear}>Delete everything</Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Keep records</Button>
      </div>
    </Notice>
  );
}

function resultBanner(report) {
  const failed = report.total - report.verifiedCount;
  if (report.valid) {
    return (
      <Notice tone="success" title={report.total === 1 ? 'Your record is verified' : `All ${report.total} records verified`}>
        Each record matches its seal, links to the one before it, and its tax still recomputes from its inputs.
      </Notice>
    );
  }
  return (
    <Notice tone="error" title={`${failed} ${failed === 1 ? 'record has' : 'records have'} been altered`}>
      The first problem is at record {report.brokenAt + 1}. Don't rely on the marked records.
    </Notice>
  );
}

export default function AuditLog() {
  const [history, setHistory] = useState(getHistory);
  const [report, setReport] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const verifiedRows = useMemo(() => new Map(report?.records.map((r) => [r.id, r])), [report]);
  const resultRef = useRef(null);

  const handleVerify = async () => {
    setVerifying(true);
    const outcome = await verifyChain(history);
    setReport(outcome);
    setVerifying(false);
    resultRef.current?.focus();
  };

  const handleExport = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(`taxtrust-audit-log-${stamp}.json`, exportChain(history), 'application/json');
  };

  const handleClear = () => {
    clearChain();
    setHistory([]);
    setReport(null);
  };

  const newestFirst = [...history].reverse();

  return (
    <main className="min-h-screen pt-28 lg:pt-32">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
        <header className="mb-6">
          <h1 className="font-display text-3xl md:text-[44px] font-medium tracking-tight text-ink">Audit log</h1>
          <p className="text-muted mt-2 max-w-2xl">
            Every computation you save is sealed with a hash linked to the one before it, so a later change shows up.
          </p>
        </header>

        {history.length === 0 ? (
          <Card className="text-center py-14">
            <h2 className="font-display text-xl font-semibold text-ink">No saved computations yet</h2>
            <p className="text-muted mt-2 max-w-md mx-auto">
              Finish a computation and save it to start your audit trail. Got a file from someone else? You can check it too.
            </p>
            <div className="flex flex-wrap justify-center gap-3 mt-6">
              <Button to="/calculator">Calculate my tax</Button>
              <Button variant="secondary" to="/verify">Verify a file</Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={handleVerify} disabled={verifying}>{verifying ? 'Verifying…' : 'Verify integrity'}</Button>
              <Button variant="secondary" onClick={handleExport}>Download log</Button>
            </div>

            <div ref={resultRef} tabIndex={-1} aria-live="polite" className="focus:outline-none">
              {report && resultBanner(report)}
            </div>

            <HeadHash head={history.at(-1).hash} count={history.length} />

            <Card className="!p-0 overflow-hidden">
              <ul className="divide-y divide-black/[0.07]">
                {newestFirst.map((record) => {
                  const position = history.indexOf(record) + 1;
                  const info = describe(record);
                  const status = rowStatus(verifiedRows.get(record.id));
                  return (
                    <li key={record.id}>
                      <Link
                        to={`/statement/${record.id}`}
                        className="grid grid-cols-2 md:grid-cols-[3rem_minmax(0,1.2fr)_minmax(0,1.2fr)_10rem_9.5rem] gap-x-4 gap-y-1 items-center px-5 py-4 hover:bg-black/[0.04] transition-colors focus:outline-none focus-visible:bg-black/[0.04]"
                      >
                        <span className="hidden md:block figures text-sm text-muted">#{position}</span>
                        <span className="min-w-0">
                          <span className="block font-medium text-ink truncate">{info.name}</span>
                          <span className="block text-sm text-muted">{formatDateTime(record.timestamp)}</span>
                        </span>
                        <span className="text-right md:text-left">
                          <span className="block figures font-semibold text-ink">{inr(info.tax)}</span>
                          <span className="block text-sm text-muted capitalize">{info.year}, {info.regime} regime</span>
                        </span>
                        <span className="font-mono text-xs text-muted truncate" title={record.hash}>{shortHash(record.hash)}</span>
                        <span className={`text-sm font-medium text-right whitespace-nowrap ${status.className}`}>{status.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>

            <div className="flex justify-end">
              <ClearControl onExport={handleExport} onClear={handleClear} />
            </div>
          </div>
        )}
      </div>
      <Footer />
    </main>
  );
}
