import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Button from './Button';

const navLinks = [
  { label: 'Home', to: '/' },
  { label: 'Features', to: '/#features' },
  { label: 'Pricing', to: '/#pricing' },
  { label: 'FAQ', to: '/#faq' },
  { label: 'Calculator', to: '/calculator' },
  { label: 'Budget', to: '/budget' },
  { label: 'Audit log', to: '/audit-log' },
  { label: 'Verify', to: '/verify' },
];

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5 rounded-lg" aria-label="TaxTrust home">
      <span className="w-9 h-9 rounded-xl bg-lime flex items-center justify-center">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M4 9.5L7.5 13L14 5" stroke="#0E0F0E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="font-display font-semibold text-xl text-white tracking-tight">TaxTrust</span>
    </Link>
  );
}

function isActive(to, location) {
  if (to.includes('#')) return location.pathname === '/' && location.hash === to.slice(1);
  if (to === '/') return location.pathname === '/' && !location.hash;
  return location.pathname === to;
}

function NavLink({ to, label, active, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`px-3.5 py-2 text-sm font-medium rounded-full transition-colors duration-200 whitespace-nowrap ${
        active ? 'bg-white/15 text-white' : 'text-white/70 hover:text-white hover:bg-white/5'
      }`}
    >
      {label}
    </Link>
  );
}

/**
 * Sits transparently over the landing hero, as in the reference, and becomes a
 * solid dark bar once there is light content beneath it.
 */
export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const close = () => setMobileOpen(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const transparent = location.pathname === '/' && !scrolled && !mobileOpen;

  return (
    <nav aria-label="Main" className="no-print fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-6xl">
      <div
        className={`flex items-center justify-between gap-3 pl-3 pr-2 py-2 rounded-full transition-all duration-300 ${
          transparent ? 'bg-transparent' : 'bg-ink/90 backdrop-blur-xl border border-white/10 shadow-float'
        }`}
      >
        <Logo />

        <div className="hidden lg:flex items-center gap-0.5 rounded-full p-1 border border-white/10 bg-white/[0.04]">
          {navLinks.map((link) => (
            <NavLink key={link.to} to={link.to} label={link.label} active={isActive(link.to, location)} />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" to="/calculator" className="hidden sm:inline-flex !px-5 !py-2.5">Calculate my tax</Button>
          <button
            type="button"
            className="lg:hidden flex flex-col justify-center gap-1.5 w-10 h-10 items-center rounded-full"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            <motion.span animate={mobileOpen ? { rotate: 45, y: 8 } : { rotate: 0, y: 0 }} className="block w-5 h-0.5 bg-white" />
            <motion.span animate={mobileOpen ? { opacity: 0 } : { opacity: 1 }} className="block w-5 h-0.5 bg-white" />
            <motion.span animate={mobileOpen ? { rotate: -45, y: -8 } : { rotate: 0, y: 0 }} className="block w-5 h-0.5 bg-white" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden mt-2 rounded-3xl bg-ink border border-white/10 p-3 flex flex-col gap-1"
          >
            {navLinks.map((link) => (
              <NavLink key={link.to} to={link.to} label={link.label} active={isActive(link.to, location)} onClick={close} />
            ))}
            <Button size="sm" to="/calculator" className="mt-2 sm:hidden" onClick={close}>Calculate my tax</Button>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
