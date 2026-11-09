import { statementRows } from '../utils/statement';
import { inr } from '../utils/format';

/** Negative lines read as "(₹50,000)", the way a computation sheet shows them. */
function Amount({ value }) {
  const rounded = Math.round(value);
  if (rounded < 0) return <>({inr(-rounded)})</>;
  return <>{inr(rounded)}</>;
}

/**
 * The line-by-line computation. `tone` switches colours: app screens,
 * paper for the printable statement.
 */
export default function ComputationTable({ result, tone = 'app' }) {
  const rows = statementRows(result);
  const paper = tone === 'paper';
  const c = paper
    ? { grand: 'border-black/70', head: 'text-black/60 border-black/30', heading: 'text-black', label: 'text-black', ref: 'text-black/55', rule: 'border-black/15', strong: 'text-black', pick: 'bg-black/5', cell: 'text-black' }
    : { grand: 'border-forest/60', head: 'text-muted border-black/15', heading: 'text-ink', label: 'text-ink/85', ref: 'text-muted', rule: 'border-black/10', strong: 'text-ink', pick: 'bg-lime/25', cell: 'text-ink/85' };

  const picked = (regime) => (result.filingRegime === regime ? c.pick : '');

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[520px]">
        <caption className="sr-only">Computation of total income and tax under the old and new regimes</caption>
        <thead>
          <tr className={`border-b ${c.head}`}>
            <th scope="col" className="text-left font-medium py-2 pr-4">Particulars</th>
            <th scope="col" className="text-left font-medium py-2 pr-4 hidden sm:table-cell">Reference</th>
            <th scope="col" className={`text-right font-medium py-2 px-3 whitespace-nowrap ${picked('old')}`}>Old regime</th>
            <th scope="col" className={`text-right font-medium py-2 px-3 whitespace-nowrap ${picked('new')}`}>New regime</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            if (row.kind === 'heading') {
              return (
                <tr key={`${row.label}-${index}`}>
                  <th scope="colgroup" colSpan={4} className={`text-left font-display font-semibold pt-5 pb-1.5 ${c.heading}`}>
                    {row.label}
                  </th>
                </tr>
              );
            }
            const emphasis = row.kind !== 'line';
            const grand = row.kind === 'grand';
            const total = row.kind === 'total' || grand;
            const cellClass = `figures text-right py-1.5 px-3 whitespace-nowrap ${emphasis ? `font-semibold ${c.strong}` : c.cell}`;
            return (
              <tr key={`${row.label}-${index}`} className={grand ? `border-y-2 ${c.grand}` : emphasis ? `border-t ${c.rule}` : ''}>
                <th scope="row" className={`text-left py-1.5 pr-4 ${emphasis ? `font-semibold ${c.strong}` : `font-normal ${c.label}`} ${total ? 'text-base' : ''}`}>
                  {row.label}
                </th>
                <td className={`py-1.5 pr-4 text-xs whitespace-nowrap hidden sm:table-cell ${c.ref}`}>{row.ref}</td>
                <td className={`${cellClass} ${picked('old')}`}><Amount value={row.old} /></td>
                <td className={`${cellClass} ${picked('new')}`}><Amount value={row.new} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
