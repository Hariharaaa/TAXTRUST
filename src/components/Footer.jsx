import { Link } from 'react-router-dom';

const footerLinks = [
  {
    title: 'Product',
    links: [
      { label: 'Calculator', to: '/calculator' },
      { label: 'Budget planner', to: '/budget' },
      { label: 'Audit log', to: '/audit-log' },
      { label: 'Verify a file', to: '/verify' },
    ],
  },
  {
    title: 'Learn',
    links: [
      { label: 'How it works', to: '/#how-it-works' },
      { label: 'Features', to: '/#features' },
      { label: 'What we cover', to: '/#coverage' },
    ],
  },
  {
    title: 'Help',
    links: [
      { label: 'Pricing', to: '/#pricing' },
      { label: 'Questions', to: '/#faq' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="no-print bg-surface border-t border-black/[0.06]">
      <div className="max-w-6xl mx-auto px-6 py-14">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10">
          <div className="col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="w-8 h-8 rounded-xl bg-ink flex items-center justify-center">
                <svg width="15" height="15" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <path d="M4 9.5L7.5 13L14 5" stroke="#D6F26E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="font-display font-semibold text-xl text-ink tracking-tight">TaxTrust</span>
            </div>
            <p className="text-muted leading-relaxed max-w-sm">
              Know your tax before you file it. Your figures stay in your browser: there's no account and no server.
            </p>
          </div>

          {footerLinks.map((group) => (
            <div key={group.title}>
              <h4 className="font-display font-semibold text-ink mb-4">{group.title}</h4>
              <ul className="space-y-3">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.to} className="text-muted hover:text-ink transition-colors duration-200">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-black/10 flex flex-col md:flex-row md:items-center justify-between gap-2 text-sm text-muted">
          <p>© {new Date().getFullYear()} TaxTrust. All rights reserved.</p>
          <p>Calculations are estimates. Check them with a CA before filing.</p>
        </div>
      </div>
    </footer>
  );
}
