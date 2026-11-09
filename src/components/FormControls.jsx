import { useId, useLayoutEffect, useRef } from 'react';
import { formatNum, inr, inWords } from '../utils/format';

/**
 * Rupee input with live Indian grouping. A native number input cannot show
 * "8,00,000", which is why the old form's placeholders could not be typed.
 * Keeps the caret in place as commas appear, and accepts pasted "₹8,00,000.50".
 */
export function MoneyField({ label, value, onChange, hint, cap, tag, hideLabel = false, compact = false }) {
  const id = useId();
  const inputRef = useRef(null);
  const digitsBeforeCaret = useRef(null);

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (digitsBeforeCaret.current === null || !el) return;
    let seen = 0;
    let position = 0;
    while (position < el.value.length && seen < digitsBeforeCaret.current) {
      if (/\d/.test(el.value[position])) seen += 1;
      position += 1;
    }
    el.setSelectionRange(position, position);
    digitsBeforeCaret.current = null;
  });

  const handleChange = (event) => {
    const text = event.target.value;
    const caret = event.target.selectionStart ?? text.length;
    digitsBeforeCaret.current = text.slice(0, caret).replace(/\D/g, '').length;
    const digits = text.split('.')[0].replace(/\D/g, '').slice(0, 13);
    onChange(digits ? Number(digits) : 0);
  };

  const hasCap = Number.isFinite(cap) && cap > 0;
  const overCap = hasCap && value > cap;
  const words = compact ? '' : inWords(value);

  return (
    <div>
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'flex items-center justify-between gap-2 text-sm font-medium text-ink/90 mb-1.5'}>
        <span>{label}</span>
        {tag && <span className="text-xs font-normal text-muted whitespace-nowrap">{tag}</span>}
      </label>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true">₹</span>
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value ? formatNum(value) : ''}
          onChange={handleChange}
          placeholder="0"
          aria-describedby={hint ? `${id}-hint` : undefined}
          className={`figures w-full bg-white border border-black/15 rounded-xl pl-8 ${compact ? 'pr-3 py-2.5' : 'pr-24 py-3'} text-ink placeholder-black/35 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest transition-colors`}
        />
        {words && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-muted pointer-events-none" aria-hidden="true">
            {words}
          </span>
        )}
      </div>
      {hasCap && value > 0 && (
        <div className="mt-2">
          <div className="h-1 rounded-full bg-black/[0.06] overflow-hidden" aria-hidden="true">
            <div
              className={`h-full rounded-full ${overCap ? 'bg-caution' : 'bg-forest'}`}
              style={{ width: `${Math.min(100, (value / cap) * 100)}%` }}
            />
          </div>
          <p className={`figures text-xs mt-1 ${overCap ? 'text-caution' : 'text-muted'}`}>
            {overCap ? `Only ${inr(cap)} counts. The rest won't reduce your tax.` : `${inr(value)} of ${inr(cap)} limit used`}
          </p>
        </div>
      )}
      {hint && <p id={`${id}-hint`} className="text-xs text-muted mt-1.5 leading-relaxed">{hint}</p>}
    </div>
  );
}

export function TextField({ label, value, onChange, hint, placeholder, ...props }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink/90 mb-1.5">{label}</label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full bg-white border border-black/15 rounded-xl px-3.5 py-3 text-ink placeholder-black/35 focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest transition-colors"
        {...props}
      />
      {hint && <p className="text-xs text-muted mt-1.5 leading-relaxed">{hint}</p>}
    </div>
  );
}

export function Toggle({ label, hint, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink/90">{label}</span>
        {hint && <span className="block text-xs text-muted mt-0.5 leading-relaxed">{hint}</span>}
      </span>
      <span className="relative shrink-0">
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span className="block h-6 w-11 rounded-full bg-black/15 peer-checked:bg-forest transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-forest peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-white" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white peer-checked:bg-white peer-checked:translate-x-5 transition-transform" />
      </span>
    </label>
  );
}

/** Radio group styled as a segmented control. Native radios give arrow-key support. */
export function Segmented({ label, value, onChange, options }) {
  const name = useId();
  return (
    <fieldset>
      {label && <legend className="text-sm font-medium text-ink/90 mb-1.5">{label}</legend>}
      <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-white border border-black/15">
        {options.map((option) => (
          <label key={option.value} className="flex-1 min-w-fit cursor-pointer">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <span className="block text-center text-sm px-3 py-2 rounded-lg text-muted peer-checked:bg-forest peer-checked:text-white peer-checked:font-semibold peer-focus-visible:ring-2 peer-focus-visible:ring-forest hover:text-ink peer-checked:hover:text-white transition-colors">
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** A selectable card: a native checkbox or radio underneath. */
export function ChoiceCard({ type = 'checkbox', name, checked, onChange, title, description }) {
  return (
    <label className="block cursor-pointer">
      <input type={type} name={name} checked={checked} onChange={onChange} className="peer sr-only" />
      <span className="flex items-start gap-3 h-full p-4 rounded-xl border border-black/15 bg-white peer-checked:border-forest peer-checked:bg-forest/[0.04] peer-focus-visible:ring-2 peer-focus-visible:ring-forest hover:border-black/25 transition-colors">
        <span className={`mt-0.5 h-5 w-5 shrink-0 ${type === 'radio' ? 'rounded-full' : 'rounded-md'} border flex items-center justify-center ${checked ? 'bg-forest border-forest' : 'border-black/25'}`} aria-hidden="true">
          {checked && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6.5L5 9L9.5 3.5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <span className="min-w-0">
          <span className="block font-medium text-ink">{title}</span>
          {description && <span className="block text-sm text-muted mt-0.5 leading-relaxed">{description}</span>}
        </span>
      </span>
    </label>
  );
}

const NOTICE_STYLES = {
  info: 'bg-black/[0.04] border-black/10 text-ink/80',
  success: 'bg-success/10 border-success/25 text-ink/90',
  warn: 'bg-caution/10 border-caution/25 text-ink/90',
  error: 'bg-danger/10 border-danger/30 text-ink/90',
};

export function Notice({ tone = 'info', title, children, className = '' }) {
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${NOTICE_STYLES[tone]} ${className}`}>
      {title && <p className="font-semibold text-ink mb-0.5">{title}</p>}
      {children}
    </div>
  );
}
