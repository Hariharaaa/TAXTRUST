import { useState } from 'react';
import Button from '../components/Button';
import Card from '../components/Card';
import Footer from '../components/Footer';
import { Notice, TextField } from '../components/FormControls';
import { getHistory, parseChainFile, restoreChain, rowStatus, verifyChain } from '../utils/hashChain';
import { formatDateTime, inr, shortHash } from '../utils/format';

const MAX_FILE_BYTES = 5 * 1024 * 1024;

function Outcome({ report, count, canRestore, onRestore, restored }) {
  const failed = report.total - report.verifiedCount;
  return (
    <div className="space-y-4" aria-live="polite">
      {report.valid ? (
        <Notice tone="success" title={count === 1 ? 'The record verified' : `All ${count} records verified`}>
          Every seal and link is intact and every tax figure recomputes from its inputs.
          {report.headMatches === true && ' The latest hash matches the code you were given, so nothing has been rewritten or removed.'}
          {report.headMatches === null && ' To rule out a full rewrite, compare the latest hash with the one the taxpayer gave you earlier.'}
        </Notice>
      ) : (
        <Notice tone="error" title="This file failed verification">
          {failed > 0 && `${failed} of ${report.total} failed the check. `}
          {report.headMatches === false && 'The latest hash does not match the code you were given, so records have been changed, added or removed since then.'}
        </Notice>
      )}

      <Card className="!p-5">
        <p className="text-sm text-muted">Latest hash in this file</p>
        <code className="block font-mono text-xs text-ink break-all mt-1">{report.head}</code>
      </Card>

      {canRestore && (
        <Card className="!p-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted max-w-md">
            {restored ? 'Restored. These records are now in this browser\'s audit log.' : 'This browser has no audit log yet. You can restore this one here.'}
          </p>
          {!restored && <Button size="sm" variant="secondary" onClick={onRestore}>Restore to this browser</Button>}
        </Card>
      )}
    </div>
  );
}

export default function Verify() {
  const [file, setFile] = useState(null);
  const [expectedHead, setExpectedHead] = useState('');
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [restored, setRestored] = useState(false);

  const check = async (records, head) => {
    setReport(await verifyChain(records, { expectedHead: head }));
  };

  const handleFile = async (event) => {
    const chosen = event.target.files?.[0];
    setError('');
    setReport(null);
    setFile(null);
    setRestored(false);
    if (!chosen) return;
    if (chosen.size > MAX_FILE_BYTES) {
      setError('This file is too large to be a TaxTrust audit log.');
      return;
    }
    try {
      const parsed = parseChainFile(await chosen.text());
      setFile({ name: chosen.name, records: parsed.records });
      await check(parsed.records, expectedHead);
    } catch (problem) {
      setError(problem.message);
    }
  };

  const updateHead = (value) => {
    setExpectedHead(value);
    if (file) check(file.records, value);
  };

  const handleRestore = () => {
    restoreChain(file.records);
    setRestored(true);
  };

  const canRestore = report?.valid && file && (restored || getHistory().length === 0);

  return (
    <main className="min-h-screen pt-28 lg:pt-32">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-16 space-y-5">
        <header>
          <h1 className="font-display text-3xl md:text-[44px] font-medium tracking-tight text-ink">Verify an audit log</h1>
          <p className="text-muted mt-2">
            For CAs and reviewers. Upload a TaxTrust log to check that its records are unaltered and that each tax
            figure recomputes from its inputs. The file is read in your browser and isn't uploaded anywhere.
          </p>
        </header>

        <Card className="space-y-5">
          <div>
            <label htmlFor="chain-file" className="block text-sm font-medium text-ink/90 mb-1.5">Audit log file (.json)</label>
            <input
              id="chain-file"
              type="file"
              accept=".json,application/json"
              onChange={handleFile}
              className="block w-full text-sm text-muted file:mr-3 file:rounded-full file:border-0 file:bg-lime file:px-4 file:py-2 file:font-semibold file:text-ink file:cursor-pointer"
            />
          </div>
          <TextField
            label="Latest hash you were given"
            value={expectedHead}
            onChange={updateHead}
            placeholder="Optional, but it's what proves nothing was rewritten"
            autoComplete="off"
            spellCheck={false}
          />
        </Card>

        {error && <Notice tone="error" title="We couldn't read that file">{error}</Notice>}

        {report && <Outcome report={report} count={file.records.length} canRestore={canRestore} onRestore={handleRestore} restored={restored} />}

        {report && (
          <Card className="!p-0 overflow-hidden">
            <ul className="divide-y divide-black/[0.07]">
              {file.records.map((record, index) => {
                const status = rowStatus(report.records[index]);
                const summary = record.data?.summary;
                return (
                  <li key={record.id ?? index} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                    <span className="min-w-0">
                      <span className="block text-ink truncate">
                        {record.data?.input?.name || `Record ${index + 1}`}
                        {summary && <span className="figures text-muted"> · {inr(summary.totalTax)}</span>}
                      </span>
                      <span className="block font-mono text-xs text-muted truncate">
                        {record.timestamp ? `${formatDateTime(record.timestamp)} · ` : ''}{shortHash(record.hash)}
                      </span>
                    </span>
                    <span className={`shrink-0 font-medium ${status.className}`}>{status.label}</span>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </div>
      <Footer />
    </main>
  );
}
