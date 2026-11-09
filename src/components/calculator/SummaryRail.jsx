import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMotionValue, useReducedMotion, useSpring } from 'framer-motion';
import Button from '../Button';
import Card from '../Card';
import { formatNum, inr, shortHash } from '../../utils/format';

function AnimatedRupees({ value }) {
  const reduced = useReducedMotion();
  const target = useMotionValue(value);
  const spring = useSpring(target, { stiffness: 140, damping: 22, mass: 0.5 });
  const [display, setDisplay] = useState(value);

  useEffect(() => { target.set(value); }, [value, target]);
  useEffect(() => spring.on('change', (v) => setDisplay(Math.round(v))), [spring]);

  return <>₹{formatNum(reduced ? value : display)}</>;
}

function RegimeBar({ label, tax, max, best, chosen }) {
  const width = max > 0 ? Math.max(2, (tax / max) * 100) : 2;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm mb-1">
        <span className="text-white/65">
          {label}
          {chosen && <span className="ml-1.5 text-xs text-white/70">(filing)</span>}
        </span>
        <span className={`figures font-semibold ${best ? 'text-lime' : 'text-white'}`}>{inr(tax)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden" aria-hidden="true">
        <div className={`h-full rounded-full transition-all duration-300 ${best ? 'bg-lime' : 'bg-white/40'}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function balanceText(result) {
  if (result.balance > 0) return { label: 'Still to pay', value: inr(result.balance), className: 'text-white' };
  if (result.balance < 0) return { label: 'Refund due', value: inr(-result.balance), className: 'text-lime' };
  return { label: 'Still to pay', value: '₹0', className: 'text-white' };
}

export function SaveAction({ save, className = '', onDark = false }) {
  if (save.status === 'saved') {
    return (
      <div className={`rounded-xl border p-3 text-sm ${onDark ? 'border-lime/30 bg-lime/10' : 'border-success/25 bg-success/10'} ${className}`}>
        <p className={`font-semibold ${onDark ? 'text-white' : 'text-ink'}`}>Sealed in your audit log</p>
        <p className={`font-mono text-xs mt-0.5 break-all ${onDark ? 'text-white/65' : 'text-muted'}`}>{shortHash(save.record.hash)}</p>
        <Link to="/audit-log" className={`hover:underline text-sm font-medium mt-1 inline-block ${onDark ? 'text-lime' : 'text-forest'}`}>
          Open audit log
        </Link>
      </div>
    );
  }
  return (
    <>
      <Button onClick={save.run} disabled={save.status === 'saving'} className={`w-full ${className}`}>
        {save.status === 'saving' ? 'Sealing…' : 'Save and seal this computation'}
      </Button>
      {save.status === 'error' && (
        <p role="alert" className={`text-sm mt-2 ${onDark ? 'text-lime' : 'text-danger'}`}>
          Couldn't save. Your browser may be blocking storage for this site.
        </p>
      )}
    </>
  );
}

export function SummaryRail({ result, review, save, onSample, onOpenChecks, onOpenReview, onReview }) {
  if (!result.hasIncome) {
    return (
      <Card variant="forest">
        <h2 className="font-display text-lg font-semibold text-white">Your tax appears here</h2>
        <p className="text-sm text-white/65 mt-2 leading-relaxed">
          Enter your income and both regimes update as you type. Nothing is sent anywhere.
        </p>
        <Button variant="secondary" size="sm" onClick={onSample} className="mt-4">
          Fill with sample figures
        </Button>
      </Card>
    );
  }

  const { oldRegime, newRegime, recommended, filingRegime, chosen, savings } = result;
  const max = Math.max(oldRegime.totalTax, newRegime.totalTax);
  const balance = balanceText(result);
  const attention = review.flags.filter((f) => f.level !== 'info').length;
  const tied = savings === 0;

  return (
    <Card variant="forest" className="space-y-5">
      <div>
        <p className="text-sm text-white/65">
          {tied ? 'Both regimes cost the same' : `${recommended === 'new' ? 'New' : 'Old'} regime saves you more`}
        </p>
        <p className="font-display text-[40px] leading-tight font-medium tracking-tight text-white mt-1 figures">
          <AnimatedRupees value={chosen.totalTax} />
        </p>
        <p className="text-sm text-white/65 mt-1">
          Total tax, {filingRegime} regime
          {!tied && recommended === filingRegime && <span className="text-lime"> · saves {inr(savings)}</span>}
        </p>
      </div>

      <div className="space-y-3">
        <RegimeBar label="New regime" tax={newRegime.totalTax} max={max} best={recommended === 'new'} chosen={filingRegime === 'new'} />
        <RegimeBar label="Old regime" tax={oldRegime.totalTax} max={max} best={recommended === 'old' && !tied} chosen={filingRegime === 'old'} />
      </div>

      <dl className="border-t border-white/10 pt-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-white/65">Total income</dt>
          <dd className="figures text-white">{inr(chosen.totalIncome)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-white/65">Tax already paid</dt>
          <dd className="figures text-white">{inr(result.credits)}</dd>
        </div>
        <div className="flex justify-between font-semibold">
          <dt className="text-white">{balance.label}</dt>
          <dd className={`figures ${balance.className}`}>{balance.value}</dd>
        </div>
      </dl>

      {attention > 0 && (
        <button
          type="button"
          onClick={onOpenChecks}
          className="w-full flex items-center justify-between gap-2 text-sm rounded-xl border border-lime/30 bg-lime/10 px-3 py-2.5 text-white hover:bg-lime/15 transition-colors"
        >
          <span>{attention} {attention === 1 ? 'item needs' : 'items need'} a look</span>
          <span aria-hidden="true">→</span>
        </button>
      )}

      {onReview ? <SaveAction save={save} onDark /> : <Button onClick={onOpenReview} className="w-full">See full computation</Button>}
    </Card>
  );
}

export function MobileBar({ result, onOpenReview, onReview }) {
  if (!result.hasIncome) return null;
  const balance = balanceText(result);
  return (
    <div className="no-print lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-white/10 bg-forest shadow-float px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0 flex gap-5">
        <div>
          <p className="text-xs text-white/65 capitalize">{result.filingRegime} regime tax</p>
          <p className="figures font-display font-semibold text-white">{inr(result.chosen.totalTax)}</p>
        </div>
        <div>
          <p className="text-xs text-white/65">{balance.label}</p>
          <p className={`figures font-display font-semibold ${balance.className}`}>{balance.value}</p>
        </div>
      </div>
      {!onReview && <Button size="sm" onClick={onOpenReview} className="shrink-0">Review</Button>}
    </div>
  );
}
