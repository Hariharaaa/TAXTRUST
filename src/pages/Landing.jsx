import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Button from '../components/Button';
import SectionReveal from '../components/SectionReveal';
import Footer from '../components/Footer';
import { computeTax } from '../utils/taxCalculator';
import { auditCheck, buildReview } from '../utils/compliance';
import { SAMPLE_INPUT } from '../utils/draft';
import { getRules } from '../utils/taxRules';
import { formatDate, inr } from '../utils/format';

/* Every figure on this page comes from the real engine run on sample inputs. */
function useSamples() {
  return useMemo(() => {
    const salaried = computeTax(SAMPLE_INPUT);
    const freelancer = computeTax({
      fy: '2025-26',
      sources: { salary: false, business: true },
      bizType: 'profession',
      bizReceipts: 4200000,
      bizCashReceipts: 80000,
    });
    return { salaried, freelancer, freelancerReview: buildReview(freelancer, new Date('2026-06-01T12:00:00')) };
  }, []);
}

function SectionTitle({ title, subtitle, light = false }) {
  return (
    <SectionReveal className="text-center max-w-2xl mx-auto mb-12">
      <h2 className={`font-display text-4xl md:text-5xl font-medium tracking-tight text-balance ${light ? 'text-white' : 'text-ink'}`}>{title}</h2>
      {subtitle && <p className={`mt-4 leading-relaxed ${light ? 'text-white/75' : 'text-muted'}`}>{subtitle}</p>}
    </SectionReveal>
  );
}

/* ── Hero ─────────────────────────────────────────── */

function HeroCard({ result }) {
  const rules = getRules(result.fy);
  return (
    <div className="animate-float">
      <div className="glass-card w-full max-w-[380px] mx-auto rounded-[28px] p-6 shadow-float text-ink">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-display font-semibold text-lg leading-tight">TaxTrust</p>
            <p className="text-[11px] font-medium tracking-wide text-ink/70 uppercase">Computation of total income</p>
          </div>
          <span className="text-[11px] font-semibold rounded-full bg-ink/10 px-2.5 py-1">Sample</span>
        </div>
        <p className="font-mono text-xl sm:text-2xl tracking-[0.12em] mt-8 text-ink/90" aria-label="Seal a4f8 c91d">
          a4f8 •••• •••• c91d
        </p>
        <div className="flex items-end justify-between mt-6">
          <div>
            <p className="text-[11px] text-ink/60">Total tax, {result.recommended} regime</p>
            <p className="figures font-display font-semibold text-2xl">{inr(result.chosen.totalTax)}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-ink/60">Year</p>
            <p className="font-medium">{rules.label}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const documents = ['Form 16', 'Form 26AS', 'AIS', 'Broker statements', 'Interest certificates', 'Rent receipts'];

function Hero({ result }) {
  return (
    <section className="hero-backdrop relative overflow-hidden pt-32 pb-16">
      <div className="absolute inset-0 grid-tiles pointer-events-none" aria-hidden="true" />
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {/* A few lit tiles, like the reference's grid. */}
        <div className="absolute left-[23%] top-[92px] w-[92px] h-[92px] bg-white/[0.035]" />
        <div className="absolute left-[56%] top-[184px] w-[92px] h-[92px] bg-white/[0.03]" />
        <div className="absolute left-[8%] top-[276px] w-[184px] h-[92px] bg-white/[0.025]" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-[1.25fr_1fr] gap-12 items-center lg:min-h-[520px]">
          {/* Slides in but never fades: the headline must show even if animation stalls. */}
          <motion.div initial={{ y: 16 }} animate={{ y: 0 }} transition={{ duration: 0.6 }}>
            <h1 className="font-display text-[44px] leading-[1.04] sm:text-6xl lg:text-[76px] font-medium tracking-[-0.04em] text-white">
              Know your tax
              <br />
              before you file it
            </h1>
            <p className="text-white/75 text-lg mt-6 max-w-lg leading-relaxed">
              A line-by-line computation under both regimes, a check on whether you need a tax audit, and records your
              CA can verify.
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4 mt-9">
              <Button to="/calculator" arrow size="lg">Calculate my tax</Button>
              <Button to="/verify" variant="ghostDark" size="md" className="!px-2">I'm a CA: verify a file</Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30, rotate: -10 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="px-4"
          >
            <HeroCard result={result} />
          </motion.div>
        </div>

        <div className="mt-20">
          <p className="text-ink/80 text-lg">Start from the documents you already have</p>
          <ul className="flex flex-wrap gap-x-8 gap-y-3 mt-4">
            {documents.map((name) => (
              <li key={name} className="font-display font-semibold text-lg text-ink/70 tracking-tight">{name}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ── Icons for tiles ──────────────────────────────── */

const ICONS = {
  briefcase: <path d="M8 7V5.5A1.5 1.5 0 019.5 4h5A1.5 1.5 0 0116 5.5V7M4 9a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V9zm0 3h16" />,
  coins: <path d="M12 7c4.4 0 8-1.1 8-2.5S16.4 2 12 2 4 3.1 4 4.5 7.6 7 12 7zM4 4.5v5C4 10.9 7.6 12 12 12s8-1.1 8-2.5v-5M4 9.5v5c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5v-5" />,
  shield: <path d="M12 21s7-3.5 7-9V6l-7-3-7 3v6c0 5.5 7 9 7 9zm-3-9l2 2 4-4" />,
  table: <path d="M4 5h16v14H4zM4 10h16M10 10v9" />,
  search: <path d="M11 18a7 7 0 100-14 7 7 0 000 14zm5-2l4 4M8 11h6" />,
  calendar: <path d="M5 6h14v14H5zM5 10h14M9 3v5M15 3v5" />,
  scale: <path d="M12 4v16M5 20h14M6 8h12M6 8l-3 6h6L6 8zm12 0l-3 6h6l-3-6z" />,
  lock: <path d="M7 11V8a5 5 0 0110 0v3M5 11h14v9H5z" />,
};

function IconTile({ icon, color }) {
  return (
    <span className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: color }}>
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {ICONS[icon]}
      </svg>
    </span>
  );
}

/* ── How it works: the two large cards ────────────── */

function RegimeCards({ result }) {
  return (
    <div className="relative h-56 sm:h-64 mt-8" aria-hidden="true">
      <div className="absolute left-0 bottom-0 w-[78%] rounded-2xl p-5 bg-gradient-to-br from-[#E4E7DD] via-[#DCE4D2] to-[#EAF3CC] shadow-soft text-ink">
        <p className="font-display font-semibold text-lg">Old regime</p>
        <p className="text-xs uppercase tracking-wide text-ink/60">Sample computation</p>
        <p className="figures font-display text-3xl font-medium mt-6">{inr(result.oldRegime.totalTax)}</p>
        <p className="text-xs text-ink/60 mt-1">Total income {inr(result.oldRegime.totalIncome)}</p>
      </div>
      <div className="absolute right-0 top-0 w-[72%] rounded-2xl p-5 bg-gradient-to-br from-[#1C4640] via-[#2B5A3A] to-[#5C8A2A] text-white shadow-float">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-display font-semibold text-lg">New regime</p>
            <p className="text-xs uppercase tracking-wide text-white/70">Better for this person</p>
          </div>
          <span className="text-[11px] font-semibold rounded-full bg-lime text-ink px-2.5 py-1">Saves {inr(result.savings)}</span>
        </div>
        <p className="figures font-display text-3xl font-medium mt-6">{inr(result.newRegime.totalTax)}</p>
        <p className="text-xs text-white/70 mt-1">Total income {inr(result.newRegime.totalIncome)}</p>
      </div>
    </div>
  );
}

function SourceTiles({ result }) {
  const { input, oldRegime } = result;
  const tiles = [
    { icon: 'briefcase', color: '#4CA866', title: 'Salary', note: 'From Form 16', amount: input.grossSalary, offset: 'mt-0' },
    { icon: 'coins', color: '#7B4FC4', title: 'Interest', note: 'From your AIS', amount: input.savingsInterest + input.fdInterest, offset: 'mt-10' },
    { icon: 'shield', color: '#B8467F', title: 'Deductions', note: '80C, 80D, 80TTA', amount: oldRegime.deductions.total, offset: 'mt-20' },
  ];
  return (
    <div className="grid grid-cols-3 gap-3 mt-8" aria-hidden="true">
      {tiles.map((tile) => (
        <div key={tile.title} className={`${tile.offset} bg-white rounded-2xl p-4 shadow-soft`}>
          <IconTile icon={tile.icon} color={tile.color} />
          <p className="font-medium text-ink mt-4">{tile.title}</p>
          <p className="text-xs text-muted">{tile.note}</p>
          <p className="figures font-display text-lg sm:text-xl text-ink mt-2">{inr(tile.amount)}</p>
        </div>
      ))}
    </div>
  );
}

function HowItWorks({ result }) {
  return (
    <section id="how-it-works" className="py-24 scroll-mt-24">
      <div className="max-w-6xl mx-auto px-6">
        <SectionTitle
          title="Simple, fast and audit-ready"
          subtitle="Enter your figures once. See every line under both regimes, then seal the result for your CA."
        />
        <div className="grid md:grid-cols-2 gap-6">
          <SectionReveal>
            <div className="h-full bg-surface rounded-[28px] p-7 sm:p-9 overflow-hidden">
              <h3 className="font-display text-2xl sm:text-3xl font-medium tracking-tight text-ink">Both regimes, worked out line by line.</h3>
              <p className="text-muted mt-4 leading-relaxed">
                Age-based slabs, rebate and marginal relief, surcharge, cess and rounding. You see what each regime costs
                and exactly why.
              </p>
              <RegimeCards result={result} />
            </div>
          </SectionReveal>
          <SectionReveal delay={0.08}>
            <div className="h-full bg-surface rounded-[28px] p-7 sm:p-9 overflow-hidden">
              <h3 className="font-display text-2xl sm:text-3xl font-medium tracking-tight text-ink">Only asks about the income you have.</h3>
              <p className="text-muted mt-4 leading-relaxed">
                Salary, freelance work, rent, capital gains or interest. Pick what applies and copy the figures from the
                documents you already have.
              </p>
              <SourceTiles result={result} />
            </div>
          </SectionReveal>
        </div>
        <p className="text-center text-xs text-muted mt-5">Figures shown are a sample run through the calculator.</p>
      </div>
    </section>
  );
}

/* ── Audit check panel ────────────────────────────── */

function AuditPanel({ freelancer, review }) {
  const audit = auditCheck(freelancer);
  const rows = [
    ['Professional receipts', inr(freelancer.input.bizReceipts)],
    ['Received in cash', `${((freelancer.input.bizCashReceipts / freelancer.input.bizReceipts) * 100).toFixed(0)}%`],
    ['Return form', review.form.form],
    ['Due date', formatDate(`${review.plan.dueDate}T12:00:00`)],
  ];
  return (
    <section className="pb-24">
      <div className="max-w-6xl mx-auto px-6">
        <SectionReveal>
          <div className="bg-surface rounded-[28px] p-7 sm:p-12 grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className="font-display text-3xl sm:text-4xl font-medium tracking-tight text-ink">
                Do you need a tax audit? Find out in a minute.
              </h2>
              <p className="text-muted text-lg mt-5 leading-relaxed">
                TaxTrust checks your receipts, cash share and declared profit against the limits, then tells you which
                return form fits and when it's due.
              </p>
              <Button to="/calculator" arrow className="mt-8">Check my numbers</Button>
            </div>
            <div className="bg-white rounded-3xl shadow-soft p-6 max-w-md w-full lg:ml-auto" aria-label="Sample audit check">
              <div className="flex items-center justify-between">
                <p className="font-medium text-ink">Audit check</p>
                <span className="text-xs rounded-full bg-black/[0.05] px-3 py-1 text-ink/70">Sample · {getRules(freelancer.fy).label}</span>
              </div>
              <dl className="mt-5 divide-y divide-black/[0.06]">
                {rows.map(([label, value]) => (
                  <div key={label} className="flex justify-between py-3 text-sm">
                    <dt className="text-muted">{label}</dt>
                    <dd className="figures font-medium text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 rounded-2xl bg-forest text-white px-4 py-3 flex items-center justify-between">
                <span className="font-medium">{audit.headline}</span>
                <span className="w-7 h-7 rounded-full bg-lime text-ink flex items-center justify-center" aria-hidden="true">✓</span>
              </div>
            </div>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}

/* ── Features ─────────────────────────────────────── */

const features = [
  { icon: 'table', color: '#1C4640', title: 'Line-by-line computation', text: 'A statement of total income with section references. Print it, save it as PDF or open it in Excel.' },
  { icon: 'search', color: '#4CA866', title: 'A reviewer\'s eye', text: 'Flags what a CA would query: figures that don\'t add up, missing TDS and deductions over the limit.' },
  { icon: 'scale', color: '#7B4FC4', title: 'When the old regime wins', text: 'Shows how much more you\'d need to deduct for the old regime to beat the new one.' },
  { icon: 'calendar', color: '#C27A1C', title: 'Deadlines and advance tax', text: 'Your due date, instalment schedule and an estimate of what filing late would cost.' },
  { icon: 'coins', color: '#B8467F', title: 'Savings you\'d actually get', text: 'Every suggestion is re-calculated on your figures, so it only appears if it lowers your tax.' },
  { icon: 'lock', color: '#2F6FB0', title: 'Tamper-evident audit log', text: 'Each saved computation is sealed and chained. Your CA can verify the file and recompute it.' },
];

function Features() {
  return (
    <section id="features" className="py-24 bg-white scroll-mt-24">
      <div className="max-w-6xl mx-auto px-6">
        <SectionTitle
          title="The groundwork an auditor would do"
          subtitle="Before you pay for a CA's time, arrive with numbers they can check in minutes."
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <SectionReveal key={f.title} delay={i * 0.05}>
              <div className="h-full bg-surface rounded-3xl p-6">
                <IconTile icon={f.icon} color={f.color} />
                <h3 className="font-display text-xl font-medium tracking-tight text-ink mt-5">{f.title}</h3>
                <p className="text-muted mt-2 leading-relaxed">{f.text}</p>
              </div>
            </SectionReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Coverage ─────────────────────────────────────── */

const covered = [
  'Resident individuals, FY 2025-26 and FY 2026-27',
  'Salary, HRA, house property and interest income',
  'Freelancers and small businesses: 44ADA, 44AD or actual profit',
  'Equity and other capital gains at their special rates',
  'Rebate, marginal relief, surcharge, cess and rounding',
];

const notCovered = [
  'A tax audit report: only a practising CA can sign one',
  'Filing your return: TaxTrust doesn\'t connect to the e-filing portal',
  'NRIs, HUFs, firms and companies',
  'Business losses, carry-forward schedules, foreign income and 234C interest',
];

function Coverage() {
  return (
    <section id="coverage" className="py-24 scroll-mt-24">
      <div className="max-w-6xl mx-auto px-6">
        <SectionTitle title="Clear about where we stop" subtitle="TaxTrust prepares and checks your numbers. Some things still need a chartered accountant." />
        <div className="grid md:grid-cols-2 gap-6">
          <SectionReveal>
            <div className="h-full bg-white rounded-[28px] p-8 shadow-soft">
              <h3 className="font-display text-2xl font-medium text-ink">TaxTrust handles</h3>
              <ul className="mt-5 space-y-3">
                {covered.map((item) => (
                  <li key={item} className="flex gap-3 text-ink/85">
                    <span className="mt-1 w-5 h-5 rounded-full bg-lime flex items-center justify-center shrink-0 text-[11px] text-ink" aria-hidden="true">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </SectionReveal>
          <SectionReveal delay={0.08}>
            <div className="h-full bg-forest rounded-[28px] p-8 text-white">
              <h3 className="font-display text-2xl font-medium">You'll still need a CA for</h3>
              <ul className="mt-5 space-y-3">
                {notCovered.map((item) => <li key={item} className="text-white/80 leading-relaxed">{item}</li>)}
              </ul>
            </div>
          </SectionReveal>
        </div>
      </div>
    </section>
  );
}

/* ── Pricing ──────────────────────────────────────── */

const tiers = [
  {
    name: 'Free',
    price: '₹0',
    period: 'forever',
    description: 'For checking your tax once a year.',
    features: [{ text: 'Old vs new regime comparison' }, { text: 'Line-by-line computation' }, { text: 'Tax audit check' }, { text: 'Monthly budget planner' }],
  },
  {
    name: 'Plus',
    price: '₹499',
    period: '/year',
    description: 'For anyone who wants records they can rely on.',
    recommended: true,
    features: [
      { text: 'Tamper-evident audit log' },
      { text: 'Printable statement and CSV' },
      { text: 'Tax-saving suggestions' },
      { text: 'Shareable verification link', planned: true },
      { text: 'Email support', planned: true },
    ],
  },
  {
    name: 'Pro',
    price: '₹1,499',
    period: '/year',
    description: 'For freelancers, and CAs with many clients.',
    features: [
      { text: 'Everything in Plus' },
      { text: 'Presumptive tax, 44AD and 44ADA' },
      { text: 'Verify client audit logs' },
      { text: 'Multi-client management', planned: true },
      { text: 'Import from Form 16', planned: true },
    ],
  },
];

function Pricing() {
  return (
    <section id="pricing" className="py-24 bg-white scroll-mt-24">
      <div className="max-w-6xl mx-auto px-6">
        <SectionTitle title="Simple, transparent pricing" subtitle="Payments aren't live yet, so everything that's built is free to use today." />
        <div className="grid md:grid-cols-3 gap-6 items-stretch">
          {tiers.map((tier, i) => {
            const dark = tier.recommended;
            return (
              <SectionReveal key={tier.name} delay={i * 0.06}>
                <div className={`h-full flex flex-col rounded-[28px] p-8 ${dark ? 'bg-forest text-white' : 'bg-surface text-ink'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-2xl font-medium">{tier.name}</h3>
                    {dark && <span className="bg-lime text-ink text-xs font-semibold px-3 py-1 rounded-full">Recommended</span>}
                  </div>
                  <p className={`text-sm mt-2 ${dark ? 'text-white/75' : 'text-muted'}`}>{tier.description}</p>
                  <p className="mt-6">
                    <span className="font-display text-5xl font-medium tracking-tight">{tier.price}</span>
                    <span className={`text-sm ml-1 ${dark ? 'text-white/70' : 'text-muted'}`}>{tier.period}</span>
                  </p>
                  <ul className="space-y-3 mt-8 mb-8 flex-1">
                    {tier.features.map((feature) => (
                      <li key={feature.text} className={`flex gap-3 text-sm ${feature.planned ? (dark ? 'text-white/55' : 'text-muted') : ''}`}>
                        <span className={`mt-0.5 w-4 shrink-0 ${feature.planned ? 'opacity-0' : dark ? 'text-lime' : 'text-forest'}`} aria-hidden="true">✓</span>
                        <span>
                          {feature.text}
                          {feature.planned && <span className={`ml-1.5 text-xs ${dark ? 'text-lime' : 'text-caution'}`}>Planned</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Button to="/calculator" variant={dark ? 'primary' : 'secondary'} className="w-full">Calculate my tax</Button>
                </div>
              </SectionReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── FAQ ──────────────────────────────────────────── */

const faqs = [
  {
    q: 'Are my figures sent anywhere?',
    a: 'No. TaxTrust runs entirely in your browser and has no server or account. Your figures stay on this device until you download or print them.',
  },
  {
    q: 'Can TaxTrust replace my CA?',
    a: 'It does the groundwork: the computation, the checks a reviewer would run, and a record your CA can verify. If you need a tax audit, only a practising CA can sign the report.',
  },
  {
    q: 'How do I know which regime to choose?',
    a: 'TaxTrust computes both and recommends the cheaper one. It also tells you how much more you would need to deduct for the old regime to win.',
  },
  {
    q: 'What does "sealed" mean?',
    a: 'Each saved computation gets a cryptographic hash linked to the one before it. If a figure changes later, the seal no longer matches. Share the latest hash with your CA so a full rewrite can be caught too.',
  },
  {
    q: 'Which years and taxpayers are covered?',
    a: 'Resident individuals for FY 2025-26 and FY 2026-27. NRIs, HUFs, firms and companies are not covered yet.',
  },
];

function Faq() {
  const [open, setOpen] = useState(1);
  return (
    <section id="faq" className="py-24 scroll-mt-24">
      <div className="max-w-3xl mx-auto px-6">
        <SectionTitle title="Frequently asked questions" subtitle="Quick answers about privacy, accuracy and what TaxTrust can and can't do." />
        <ul className="space-y-3">
          {faqs.map((item, index) => {
            const isOpen = open === index;
            const id = `faq-${index}`;
            return (
              <li key={item.q} className={`rounded-2xl transition-colors ${isOpen ? 'bg-forest text-white' : 'bg-white text-ink shadow-soft'}`}>
                <h3>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={id}
                    onClick={() => setOpen(isOpen ? -1 : index)}
                    className="w-full flex items-center gap-5 text-left px-6 py-5"
                  >
                    <span className={`figures text-sm ${isOpen ? 'text-white/70' : 'text-muted'}`}>{String(index + 1).padStart(2, '0')}</span>
                    <span className="flex-1 font-medium">{item.q}</span>
                    <span className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </span>
                  </button>
                </h3>
                <div id={id} hidden={!isOpen} className="px-6 pb-6 pl-[3.75rem] text-white/80 leading-relaxed max-w-2xl">
                  {item.a}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ── Closing call to action ───────────────────────── */

function ClosingBand({ result }) {
  const total = result.oldRegime.totalTax + result.newRegime.totalTax;
  const newShare = Math.round((result.newRegime.totalTax / total) * 100);
  return (
    <section className="pb-24">
      <div className="max-w-6xl mx-auto px-6">
        <SectionReveal>
          <div className="relative overflow-hidden rounded-[32px] bg-forest text-white">
            <div className="absolute inset-0 grid-tiles-flat pointer-events-none" aria-hidden="true" />
            <div className="relative grid lg:grid-cols-2 gap-10 items-center p-8 sm:p-14">
              <div>
                <h2 className="font-display text-4xl sm:text-5xl font-medium tracking-tight leading-[1.05]">
                  Take control of your tax today
                </h2>
                <p className="text-white/75 text-lg mt-5 max-w-md">
                  Free, private and ready in minutes. No account, no upload.
                </p>
                <Button to="/calculator" arrow className="mt-8">Get started</Button>
              </div>
              <div className="space-y-4 max-w-sm w-full lg:ml-auto" aria-label="Sample regime comparison">
                <div className="bg-white text-ink rounded-3xl p-5 shadow-float">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted">Sample · tax by regime</p>
                    <span className="text-xs text-muted">{getRules(result.fy).label}</span>
                  </div>
                  <p className="figures font-display text-3xl font-medium mt-2">{inr(result.savings)}</p>
                  <p className="text-sm text-muted">saved by choosing the {result.recommended} regime</p>
                  <div className="flex h-8 rounded-full overflow-hidden mt-4 text-xs font-semibold">
                    <div className="bg-lime text-ink flex items-center justify-center" style={{ width: `${newShare}%` }}>New {inr(result.newRegime.totalTax)}</div>
                    <div className="bg-forest text-white flex items-center justify-center flex-1">Old {inr(result.oldRegime.totalTax)}</div>
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-3xl p-5 border border-white/15 ml-8">
                  <p className="text-sm text-white/70">Sealed record</p>
                  <p className="font-mono text-sm mt-1 text-lime">a4f8e1…6c91d · verified</p>
                </div>
              </div>
            </div>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}

export default function Landing() {
  const { salaried, freelancer, freelancerReview } = useSamples();
  return (
    <main className="bg-canvas">
      <Hero result={salaried} />
      <HowItWorks result={salaried} />
      <AuditPanel freelancer={freelancer} review={freelancerReview} />
      <Features />
      <Coverage />
      <Pricing />
      <Faq />
      <ClosingBand result={salaried} />
      <Footer />
    </main>
  );
}
