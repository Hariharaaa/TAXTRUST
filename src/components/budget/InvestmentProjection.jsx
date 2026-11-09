import { useEffect, useRef, useState } from 'react';
import Card from '../Card';
import { Segmented } from '../FormControls';
import { HORIZONS, INFLATION, RETURN_PROFILES, RETURN_TAX, SLAB_CHOICES } from '../../utils/budget';
import { inr, inWords } from '../../utils/format';

/* Validated with the dataviz palette checker against white: colourblind-safe pair. */
const INVESTED = '#2F6FB0';
const GROWTH = '#C2457E';

const pct = (rate, digits = 1) => `${(rate * 100).toFixed(digits).replace(/\.0$/, '')}%`;
const short = (n) => inWords(n) || inr(n);

function niceMax(value) {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((m) => m * power >= value);
  return step * power;
}

/** Round only the top corners, so bars sit flat on the baseline. */
function topRounded(x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + radius}Q${x},${y} ${x + radius},${y}H${x + w - radius}Q${x + w},${y} ${x + w},${y + radius}V${y + h}Z`;
}

/** Draw at the real pixel width so axis text never shrinks below its set size. */
function useWidth(fallback) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

function GrowthChart({ path }) {
  const [active, setActive] = useState(null);
  const [wrapRef, width] = useWidth(640);
  const height = 240;
  const pad = { top: 12, right: 8, bottom: 28, left: 66 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const max = niceMax(path.at(-1)?.value ?? 0);
  const slot = plotW / path.length;
  const barW = Math.min(28, slot * 0.62);
  const y = (v) => pad.top + plotH - (v / max) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const roomPerLabel = slot >= 44 ? 1 : slot >= 22 ? 2 : slot >= 14 ? 3 : 5;
  const labelEvery = Math.max(roomPerLabel, path.length > 15 ? 5 : path.length > 10 ? 3 : 1);
  const point = active === null ? null : path[active];

  return (
    <div className="relative" ref={wrapRef}>
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="block max-w-full h-auto" role="img" aria-label={`Projected value each year, reaching ${inr(path.at(-1).value)} after ${path.length} years`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="#0E0F0E" strokeOpacity={t === 0 ? 0.25 : 0.07} />
            <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="12" fill="#62675F">{t === 0 ? '₹0' : short(t)}</text>
          </g>
        ))}
        {path.map((p, i) => {
          const x = pad.left + i * slot + (slot - barW) / 2;
          const investedTop = y(p.invested);
          const growthTop = y(p.value);
          const dim = active !== null && active !== i;
          return (
            <g key={p.year} opacity={dim ? 0.45 : 1}>
              <rect x={x} y={investedTop} width={barW} height={pad.top + plotH - investedTop} fill={INVESTED} />
              {investedTop - growthTop > 2 && (
                <path d={topRounded(x, growthTop, barW, investedTop - growthTop - 2, 4)} fill={GROWTH} />
              )}
              {(p.year % labelEvery === 0 || (labelEvery > 1 && p.year === 1)) && (
                <text x={x + barW / 2} y={height - 8} textAnchor="middle" fontSize="12" fill="#62675F">Yr {p.year}</text>
              )}
              {/* Hit area wider than the bar. */}
              <rect
                x={pad.left + i * slot}
                y={pad.top}
                width={slot}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
              />
            </g>
          );
        })}
      </svg>
      {point && (
        <div
          className="pointer-events-none absolute top-1 z-10 rounded-xl bg-ink text-white text-xs px-3 py-2 shadow-float whitespace-nowrap"
          style={{ left: `${((pad.left + (active + 0.5) * slot) / width) * 100}%`, transform: `translateX(${active > path.length / 2 ? '-105%' : '5%'})` }}
        >
          <p className="font-semibold mb-1">After {point.year} {point.year === 1 ? 'year' : 'years'}</p>
          <p className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: INVESTED }} />Put in <span className="figures ml-auto pl-3">{inr(point.invested)}</span></p>
          <p className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: GROWTH }} />Growth <span className="figures ml-auto pl-3">{inr(point.growth)}</span></p>
          <p className="flex justify-between border-t border-white/20 mt-1 pt-1 font-semibold">Total <span className="figures pl-3">{inr(point.value)}</span></p>
        </div>
      )}
      <ul className="flex gap-5 mt-2 text-sm text-ink/85">
        <li className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: INVESTED }} aria-hidden="true" />What you put in</li>
        <li className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: GROWTH }} aria-hidden="true" />Estimated growth</li>
      </ul>
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div className="rounded-2xl bg-surface px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="figures font-display text-lg font-semibold text-ink mt-0.5">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

/** Where the slab rate for interest, debt and NPS comes from. */
function TaxRateControl({ taxRate, autoRate, onTaxRate }) {
  const value = taxRate === 'auto' && autoRate !== null ? 'auto' : String(taxRate === 'auto' ? 0.2 : taxRate);
  return (
    <label className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
      <span className="text-ink/90 font-medium">Your tax slab for interest, debt funds and NPS</span>
      <select
        value={value}
        onChange={(e) => onTaxRate(e.target.value === 'auto' ? 'auto' : Number(e.target.value))}
        className="bg-white border border-black/15 rounded-lg px-2 py-1.5 text-sm text-ink focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
      >
        {autoRate !== null && <option value="auto">From my tax computation ({pct(autoRate)} with cess)</option>}
        {SLAB_CHOICES.map((rate) => <option key={rate} value={String(rate)}>{rate === 0 ? 'No tax (0%)' : `${pct(rate, 0)} slab`}</option>)}
      </select>
    </label>
  );
}

export default function InvestmentProjection({ projection, years, onYears, onReturnType, taxRate, autoRate, onTaxRate }) {
  const usedTypes = [...new Set(projection.items.map((i) => i.type))];
  return (
    <Card className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">What your investments could grow to</h2>
          <p className="text-sm text-muted mt-1">If you keep investing the same amounts every month and year.</p>
        </div>
        <div className="w-full sm:w-auto">
          <Segmented
            label="Over"
            value={String(years)}
            onChange={(v) => onYears(Number(v))}
            options={HORIZONS.map((h) => ({ value: String(h), label: `${h} yrs` }))}
          />
        </div>
      </div>

      <div>
        <p className="text-sm text-muted">In {years} years, on average returns, after tax</p>
        <p className="figures font-display text-4xl sm:text-5xl font-medium tracking-tight text-ink mt-1">about {inr(projection.afterTax)}</p>
        <p className="text-sm text-muted mt-1">
          <span className="figures text-ink">{inr(projection.avg)}</span> before{' '}
          <span className="figures text-ink">{inr(projection.tax)}</span> of tax on returns. Rough range after tax{' '}
          <span className="figures text-ink">{short(projection.afterTaxLow)}</span> to{' '}
          <span className="figures text-ink">{short(projection.afterTaxHigh)}</span>, depending on how markets do.
        </p>
      </div>

      <div className="grid grid-cols-2 2xl:grid-cols-4 gap-3">
        <Stat label="You put in" value={inr(projection.invested)} />
        <Stat label="Estimated growth" value={inr(projection.growth)} sub={`About ${pct(projection.blendedRate)} a year across your mix`} />
        <Stat label="Tax on returns" value={inr(projection.tax)} sub="If you take it all out at the end" />
        <Stat label="In today's money" value={`about ${short(projection.todaysMoney)}`} sub={`After tax and ${pct(INFLATION, 0)} yearly inflation`} />
      </div>

      {projection.harvestSaving >= 1000 && (
        <div className="rounded-xl border border-forest/25 bg-forest/[0.05] px-4 py-3 text-sm text-ink/85 leading-relaxed">
          <p className="font-semibold text-ink">Tip: book equity gains every year to cut this tax</p>
          The first ₹1.25 lakh of equity gains each year is tax-free. Selling and reinvesting up to that much every
          year, called tax harvesting,{' '}
          {projection.equityTax - projection.harvestSaving < 1
            ? <>could remove all <span className="figures font-semibold text-ink">{inr(projection.equityTax)}</span> of the tax on your equity gains.</>
            : <>could save about <span className="figures font-semibold text-ink">{inr(projection.harvestSaving)}</span> of the {inr(projection.equityTax)} tax on your equity gains.</>}{' '}
          Ask your CA before you do it, as exit loads and ELSS lock-ins apply.
        </div>
      )}

      <GrowthChart path={projection.path} />

      <TaxRateControl taxRate={taxRate} autoRate={autoRate} onTaxRate={onTaxRate} />

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <caption className="sr-only">Projection for each investment after {years} years</caption>
          <thead>
            <tr className="text-muted border-b border-black/10">
              <th scope="col" className="text-left font-medium py-2">Investment</th>
              <th scope="col" className="text-left font-medium py-2">Treated as</th>
              <th scope="col" className="text-right font-medium py-2">Avg return</th>
              <th scope="col" className="text-right font-medium py-2">You put in</th>
              <th scope="col" className="text-right font-medium py-2">Before tax</th>
              <th scope="col" className="text-right font-medium py-2">Tax</th>
              <th scope="col" className="text-right font-medium py-2">After tax</th>
            </tr>
          </thead>
          <tbody>
            {projection.items.map((item) => (
              <tr key={item.id} className="border-b border-black/[0.05] last:border-0">
                <th scope="row" className="text-left font-normal text-ink py-2 pr-3">{item.label || 'Unnamed'}</th>
                <td className="py-2 pr-3">
                  <select
                    value={item.type}
                    onChange={(e) => onReturnType(item.id, e.target.value)}
                    aria-label={`Type of investment for ${item.label || 'this item'}`}
                    className="bg-white border border-black/15 rounded-lg px-2 py-1.5 text-sm text-ink focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                  >
                    {Object.entries(RETURN_PROFILES).map(([key, profile]) => <option key={key} value={key}>{profile.label}</option>)}
                  </select>
                </td>
                <td className="py-2 pl-3 text-right figures text-muted">{pct(item.rate)}</td>
                <td className="py-2 pl-3 text-right figures text-ink whitespace-nowrap">{inr(item.invested)}</td>
                <td className="py-2 pl-3 text-right figures text-ink whitespace-nowrap">{inr(item.avg)}</td>
                <td className="py-2 pl-3 text-right figures whitespace-nowrap" title={RETURN_TAX[item.type].label}>
                  {item.tax > 0 ? <span className="text-caution">−{inr(item.tax)}</span> : <span className="text-success">Tax-free</span>}
                </td>
                <td className="py-2 pl-3 text-right whitespace-nowrap">
                  <span className="block figures font-semibold text-ink">{inr(item.afterTax)}</span>
                  <span className="block figures text-xs text-muted">
                    {item.low === item.high ? 'Fixed rate' : `${short(item.afterTaxLow)} – ${short(item.afterTaxHigh)}`}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl bg-surface px-4 py-3 text-xs text-muted leading-relaxed space-y-1.5">
        <p className="font-medium text-ink">How these are worked out</p>
        <ul className="space-y-1">
          {usedTypes.map((type) => {
            const p = RETURN_PROFILES[type];
            const range = p.low === p.high ? pct(p.avg) : `${pct(p.low)} low, ${pct(p.avg)} average, ${pct(p.high)} high`;
            return <li key={type}><span className="text-ink">{p.label}:</span> {range} a year. Tax: {RETURN_TAX[type].label}.</li>;
          })}
        </ul>
        <p>
          Tax assumes you withdraw everything at the end, under today's rules (FY 2026-27), with 4% cess and no
          surcharge. FD and savings interest is really taxed every year, so actual growth is a little lower. Since
          December 2025, non-government NPS subscribers can take up to 80% as a lump sum. 60% is tax-free, and
          sources disagree on the extra 20%, so it's treated as taxable here to be safe. The 20% left goes into a
          pension that is taxed as you receive it, which isn't counted here.
        </p>
        <p>
          Returns are rough long-run averages, not promises. Real returns vary year to year, past returns don't
          guarantee future ones, and tax rules can change. This is an estimate for planning, not investment or tax advice.
        </p>
      </div>
    </Card>
  );
}
