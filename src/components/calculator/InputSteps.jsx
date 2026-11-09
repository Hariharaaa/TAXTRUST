import Card from '../Card';
import { ChoiceCard, MoneyField, Notice, Segmented, TextField, Toggle } from '../FormControls';
import { presumptiveTest } from '../../utils/taxCalculator';
import { getRules, TAX_YEARS } from '../../utils/taxRules';
import { inr } from '../../utils/format';

const SOURCES = [
  { key: 'salary', title: 'Salary or pension', description: 'You have a Form 16 from an employer.' },
  { key: 'business', title: 'Freelance or business', description: 'Consulting, a practice, a shop or trading.' },
  { key: 'property', title: 'Home loan or rental', description: 'You pay home loan interest or earn rent.' },
  { key: 'capitalGains', title: 'Capital gains', description: 'You sold shares, funds or property.' },
  { key: 'otherIncome', title: 'Interest and other', description: 'Bank interest, dividends and similar.' },
];

const AGE_OPTIONS = [
  { value: 'below60', label: 'Under 60' },
  { value: 'senior', label: '60 to 79' },
  { value: 'superSenior', label: '80 or over' },
];

function Group({ title, description, children }) {
  return (
    <Card className="space-y-5">
      <div>
        <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
        {description && <p className="text-sm text-muted mt-1">{description}</p>}
      </div>
      {children}
    </Card>
  );
}

const Grid = ({ children }) => <div className="grid sm:grid-cols-2 gap-5">{children}</div>;

export function StepProfile({ input, set }) {
  const toggleSource = (key) => set('sources', { ...input.sources, [key]: !input.sources[key] });

  return (
    <div className="space-y-6">
      <Group title="Which year?">
        <div className="grid sm:grid-cols-2 gap-3">
          {Object.values(TAX_YEARS).map((year) => (
            <ChoiceCard
              key={year.fy}
              type="radio"
              name="tax-year"
              checked={input.fy === year.fy}
              onChange={() => set('fy', year.fy)}
              title={`${year.label} (${year.sublabel})`}
              description={year.purpose}
            />
          ))}
        </div>
      </Group>

      <Group title="About you" description="Name and PAN only appear on your statement. They stay in this browser.">
        <Grid>
          <TextField label="Name" value={input.name} onChange={(v) => set('name', v)} placeholder="Optional" autoComplete="off" />
          <TextField
            label="PAN"
            value={input.pan}
            onChange={(v) => set('pan', v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
            placeholder="Optional"
            autoComplete="off"
          />
        </Grid>
        <Segmented label="Your age during the year" value={input.age} onChange={(v) => set('age', v)} options={AGE_OPTIONS} />
      </Group>

      <Group title="Where did your income come from?" description="Pick everything that applies. We'll only ask about these.">
        <div className="grid sm:grid-cols-2 gap-3">
          {SOURCES.map((source) => (
            <ChoiceCard
              key={source.key}
              checked={input.sources[source.key]}
              onChange={() => toggleSource(source.key)}
              title={source.title}
              description={source.description}
            />
          ))}
        </div>
      </Group>
    </div>
  );
}

function BusinessGroup({ input, set, money, rules }) {
  const isProfession = input.bizType === 'profession';
  const isBooks = input.bizScheme === 'books';
  const presumptive = presumptiveTest(input, rules);

  return (
    <Group title="Freelance or business" description="Use the totals for the whole year.">
      <Grid>
        <Segmented
          label="Type of work"
          value={input.bizType}
          onChange={(v) => set('bizType', v)}
          options={[{ value: 'profession', label: 'Profession' }, { value: 'business', label: 'Business' }]}
        />
        <Segmented
          label="How profit is worked out"
          value={input.bizScheme}
          onChange={(v) => set('bizScheme', v)}
          options={[{ value: 'presumptive', label: 'Presumptive' }, { value: 'books', label: 'From my books' }]}
        />
      </Grid>
      <p className="text-xs text-muted leading-relaxed">
        {isProfession
          ? 'Professions include consultants, doctors, lawyers, engineers, architects, designers and similar specified work.'
          : 'Business covers trading, shops, services and anything that is not a specified profession.'}
      </p>
      <Grid>
        <MoneyField label={isProfession ? 'Gross receipts' : 'Turnover'} {...money('bizReceipts')} />
        <MoneyField
          label="Of which received in cash"
          {...money('bizCashReceipts')}
          hint="Cheque, card, UPI and bank transfers are not cash. Keeping cash to 5% or less raises your limits."
        />
        {isBooks ? (
          <>
            <MoneyField label="Expenses" {...money('bizExpenses')} />
            {!isProfession && <MoneyField label="Of which paid in cash" {...money('bizCashPayments')} />}
          </>
        ) : (
          <MoneyField
            label="Profit you are declaring"
            {...money('bizDeclaredProfit')}
            tag="Optional"
            hint={`Leave blank to use the presumptive profit of ${inr(presumptive.deemedProfit)}.`}
          />
        )}
      </Grid>
    </Group>
  );
}

export function StepIncome({ input, set, money, onBack }) {
  const rules = getRules(input.fy);
  const { sources } = input;
  const anySource = Object.values(sources).some(Boolean);

  if (!anySource) {
    return (
      <Notice tone="warn" title="No income sources selected">
        <button type="button" onClick={onBack} className="underline underline-offset-2 hover:text-ink">
          Go back and pick at least one
        </button>{' '}
        so we know what to ask.
      </Notice>
    );
  }

  return (
    <div className="space-y-6">
      {sources.salary && (
        <Group title="Salary" description="Take these from Part B of Form 16. If you changed jobs, add the employers together.">
          <Grid>
            <MoneyField
              label="Gross salary"
              {...money('grossSalary')}
              hint="Everything you earned, including HRA and bonus. This is not your CTC: leave out your employer's own PF."
            />
            <MoneyField label="Basic salary and DA" {...money('basicSalary')} hint="Used for the HRA and employer NPS limits." />
            <MoneyField label="HRA received" {...money('hraReceived')} tag="Old regime" />
            <MoneyField label="Rent paid in the year" {...money('rentPaid')} tag="Old regime" />
            <MoneyField label="Professional tax" {...money('professionalTax')} tag="Old regime" />
            <MoneyField label="Employer's NPS contribution" {...money('employerNps')} tag="Both regimes" hint="Should also be included in gross salary." />
          </Grid>
          <Toggle
            label="I rent in a metro city"
            hint={`${rules.metroCities.join(', ')} count for ${rules.label}. They use 50% of basic for HRA; other cities use 40%.`}
            checked={input.isMetro}
            onChange={(v) => set('isMetro', v)}
          />
        </Group>
      )}

      {sources.business && <BusinessGroup input={input} set={set} money={money} rules={rules} />}

      {sources.property && (
        <Group title="Home loan and rental" description="Use your lender's interest certificate. Principal repaid belongs under 80C.">
          <Grid>
            <MoneyField
              label="Home loan interest, home you live in"
              {...money('homeLoanInterest')}
              cap={rules.caps.selfOccupiedInterest}
              tag="Old regime"
            />
            <MoneyField label="Rent received" {...money('rentReceived')} hint="For a home you have let out." />
            <MoneyField label="Municipal tax paid" {...money('municipalTax')} />
            <MoneyField label="Home loan interest, let-out home" {...money('letOutInterest')} />
          </Grid>
        </Group>
      )}

      {sources.capitalGains && (
        <Group title="Capital gains" description="Enter gains after costs, from your broker or fund statements.">
          <Grid>
            <MoneyField label="Short-term, listed shares and equity funds" {...money('stcgEquity')} hint="Held up to 12 months. Taxed at 20%." />
            <MoneyField
              label="Long-term, listed shares and equity funds"
              {...money('ltcgEquity')}
              hint={`Held over 12 months. The first ${inr(rules.capitalGains.ltcgEquityExempt)} is free, then 12.5%.`}
            />
            <MoneyField label="Short-term, other assets" {...money('stcgOther')} hint="Taxed at your slab rate." />
            <MoneyField label="Long-term, other assets" {...money('ltcgOther')} hint="Property and similar. Taxed at 12.5%. Older property may have other options, so check with your CA." />
          </Grid>
        </Group>
      )}

      {sources.otherIncome && (
        <Group title="Interest and other income" description="Your AIS lists most of these.">
          <Grid>
            <MoneyField label="Savings account interest" {...money('savingsInterest')} />
            <MoneyField label="Fixed deposit interest" {...money('fdInterest')} />
            <MoneyField label="Dividends" {...money('dividends')} />
            <MoneyField label="Any other income" {...money('otherIncome')} />
          </Grid>
        </Group>
      )}
    </div>
  );
}

export function StepDeductions({ input, set, money, result }) {
  const rules = getRules(input.fy);
  const caps = rules.caps;
  const isSenior = input.age !== 'below60';
  const newIsBetter = result.hasIncome && result.recommended === 'new';

  return (
    <div className="space-y-6">
      {newIsBetter && (
        <Notice title="These count under the old regime only">
          The new regime is better for you right now. Add what you have anyway: it shows whether the old regime
          overtakes it. Employer NPS, on the salary step, counts in both.
        </Notice>
      )}

      <Group title="Investments">
        <Grid>
          <MoneyField label="Section 80C" {...money('sec80C')} cap={caps.sec80C} hint="EPF, PPF, ELSS, life insurance, tuition fees and home loan principal." />
          <MoneyField label="Your own NPS, extra" {...money('sec80CCD1B')} cap={caps.sec80CCD1B} hint="Section 80CCD(1B). This is on top of 80C." />
        </Grid>
      </Group>

      <Group title="Health insurance">
        <Grid>
          <MoneyField label="You, spouse and children" {...money('sec80DSelf')} cap={isSenior ? caps.sec80DSelf.senior : caps.sec80DSelf.normal} />
          <MoneyField label="Your parents" {...money('sec80DParents')} cap={input.parentsSenior ? caps.sec80DParents.senior : caps.sec80DParents.normal} />
        </Grid>
        <Toggle label="A parent is 60 or over" hint="Raises the limit for parents to ₹50,000." checked={input.parentsSenior} onChange={(v) => set('parentsSenior', v)} />
      </Group>

      <Group title="Other deductions">
        <Grid>
          <MoneyField label="Education loan interest" {...money('sec80E')} hint="Section 80E. No upper limit." />
          <MoneyField label="Eligible donations" {...money('sec80G')} hint="Section 80G. Enter the deductible amount, not the amount given." />
          <MoneyField label="Anything else" {...money('otherDeductions')} hint="80U, 80DD, 80DDB, 80GG and similar. Enter only what you're eligible to claim." />
        </Grid>
      </Group>
    </div>
  );
}

export function StepTaxes({ money }) {
  return (
    <div className="space-y-6">
      <Group title="Tax you've already paid" description="Check these against Form 26AS. Tax that isn't there won't be credited to you.">
        <Grid>
          <MoneyField label="TDS" {...money('tds')} hint="From Form 16, Form 16A or Form 26AS." />
          <MoneyField label="TCS" {...money('tcs')} hint="Collected on things like foreign remittances." />
          <MoneyField label="Advance tax" {...money('advanceTax')} hint="Paid by you during the year." />
          <MoneyField label="Self-assessment tax" {...money('selfAssessmentTax')} hint="Paid by you after the year ended." />
        </Grid>
      </Group>
    </div>
  );
}
