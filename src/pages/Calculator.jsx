import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Button from '../components/Button';
import Footer from '../components/Footer';
import { StepDeductions, StepIncome, StepProfile, StepTaxes } from '../components/calculator/InputSteps';
import ReviewPanel from '../components/calculator/ReviewPanel';
import { MobileBar, SummaryRail } from '../components/calculator/SummaryRail';
import { buildReview } from '../utils/compliance';
import { clearDraft, loadDraft, SAMPLE_INPUT, saveDraft } from '../utils/draft';
import { appendToChain } from '../utils/hashChain';
import { computeTax, EMPTY_INPUT } from '../utils/taxCalculator';
import { getRules } from '../utils/taxRules';

const STEPS = [
  { id: 'profile', label: 'About you', title: 'Tell us about your year' },
  { id: 'income', label: 'Income', title: 'Add your income' },
  { id: 'deductions', label: 'Deductions', title: 'Add your deductions' },
  { id: 'taxes', label: 'Taxes paid', title: 'Add tax you have paid' },
  { id: 'review', label: 'Review', title: 'Review your computation' },
];

function Stepper({ current, onSelect }) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);
  const activeRef = useRef(null);

  // Keep the current step visible when the row scrolls sideways on a phone.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [current]);

  return (
    <nav aria-label="Computation steps" className="overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
      <ol className="flex gap-1 min-w-max">
        {STEPS.map((step, index) => {
          const active = step.id === current;
          const done = index < currentIndex;
          return (
            <li key={step.id}>
              <button
                ref={active ? activeRef : null}
                type="button"
                onClick={() => onSelect(step.id)}
                aria-current={active ? 'step' : undefined}
                className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                  active ? 'bg-forest text-white' : 'text-muted hover:text-ink hover:bg-black/[0.05]'
                }`}
              >
                <span className={`figures h-5 w-5 rounded-full text-xs flex items-center justify-center ${
                  active ? 'bg-lime text-ink' : done ? 'bg-forest/10 text-forest' : 'bg-black/[0.06]'
                }`}>
                  {done ? '✓' : index + 1}
                </span>
                {step.label}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default function Calculator() {
  const [input, setInput] = useState(loadDraft);
  const [saveState, setSaveState] = useState({ status: 'idle', record: null });
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [params, setParams] = useSearchParams();

  const step = STEPS.some((s) => s.id === params.get('step')) ? params.get('step') : 'profile';
  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const onReview = step === 'review';

  const go = useCallback((nextStep, tab) => {
    setParams(tab ? { step: nextStep, tab } : { step: nextStep });
    window.scrollTo({ top: 0 });
  }, [setParams]);

  const set = useCallback((key, value) => {
    setInput((prev) => ({ ...prev, [key]: value }));
    setSaveState({ status: 'idle', record: null });
  }, []);

  const money = useCallback((key) => ({
    value: input[key],
    onChange: (value) => set(key, value),
  }), [input, set]);

  useEffect(() => { saveDraft(input); }, [input]);

  const result = useMemo(() => computeTax(input), [input]);
  const review = useMemo(() => buildReview(result), [result]);
  const rules = getRules(input.fy);

  const save = {
    ...saveState,
    run: async () => {
      setSaveState({ status: 'saving', record: null });
      try {
        const record = await appendToChain(result);
        setSaveState({ status: 'saved', record });
      } catch {
        setSaveState({ status: 'error', record: null });
      }
    },
  };

  const loadSample = () => {
    setInput(SAMPLE_INPUT);
    setSaveState({ status: 'idle', record: null });
    go('income');
  };

  const clearForm = () => {
    clearDraft();
    setInput(EMPTY_INPUT);
    setSaveState({ status: 'idle', record: null });
    setConfirmingClear(false);
    go('profile');
  };

  return (
    <main className="min-h-screen pt-28 lg:pt-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        <header className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-sm font-medium text-forest">{rules.label} · {rules.sublabel}</p>
            <h1 className="font-display text-3xl md:text-[44px] font-medium tracking-tight text-ink mt-1">{STEPS[stepIndex].title}</h1>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {confirmingClear ? (
              <>
                <span className="text-muted">Clear every field?</span>
                <Button size="sm" variant="danger" onClick={clearForm}>Yes, clear</Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmingClear(false)}>Keep</Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={loadSample}>Use sample figures</Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmingClear(true)}>Clear form</Button>
              </>
            )}
          </div>
        </header>

        <Stepper current={step} onSelect={(id) => go(id)} />

        <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-8 mt-6 items-start">
          <div className="min-w-0">
            {step === 'profile' && <StepProfile input={input} set={set} />}
            {step === 'income' && <StepIncome input={input} set={set} money={money} onBack={() => go('profile')} />}
            {step === 'deductions' && <StepDeductions input={input} set={set} money={money} result={result} />}
            {step === 'taxes' && <StepTaxes money={money} />}
            {onReview && (
              <ReviewPanel
                result={result}
                review={review}
                input={input}
                set={set}
                save={save}
                tab={params.get('tab')}
                onTab={(tab) => setParams({ step: 'review', tab })}
                onGoToStep={(id) => go(id)}
              />
            )}

            {!onReview && (
              <div className="flex items-center justify-between gap-3 mt-6">
                {stepIndex > 0
                  ? <Button variant="ghost" size="sm" onClick={() => go(STEPS[stepIndex - 1].id)}>← {STEPS[stepIndex - 1].label}</Button>
                  : <span />}
                <Button onClick={() => go(STEPS[stepIndex + 1].id)}>Next: {STEPS[stepIndex + 1].label}</Button>
              </div>
            )}
          </div>

          <aside className="hidden lg:block lg:sticky lg:top-28 space-y-3" aria-label="Live tax summary">
            <SummaryRail
              result={result}
              review={review}
              save={save}
              onSample={loadSample}
              onOpenChecks={() => go('review', 'checks')}
              onOpenReview={() => go('review')}
              onReview={onReview}
            />
            <p className="text-xs text-muted px-1 leading-relaxed">
              Saved automatically in this browser. This is an estimate to check with a CA before filing, not a filed return.
            </p>
          </aside>
        </div>

        <p className="sr-only" aria-live="polite">
          {result.hasIncome ? `Total tax ${result.chosen.totalTax} rupees under the ${result.filingRegime} regime.` : ''}
        </p>
      </div>

      <div className="pb-20 lg:pb-0">
        <Footer />
      </div>
      <MobileBar result={result} onOpenReview={() => go('review')} onReview={onReview} />
    </main>
  );
}
