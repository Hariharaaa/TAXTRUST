import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import Navbar from './components/Navbar';
import Landing from './pages/Landing';
import Calculator from './pages/Calculator';
import AuditLog from './pages/AuditLog';
import Statement from './pages/Statement';
import Verify from './pages/Verify';
import Budget from './pages/Budget';

/** Scroll to the linked section if there is one, otherwise to the top of a new page. */
function ScrollManager() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    const target = hash ? document.getElementById(hash.slice(1)) : null;
    if (target) target.scrollIntoView({ behavior: 'smooth' });
    else window.scrollTo(0, 0);
  }, [pathname, hash]);

  return null;
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ScrollManager />
      <Navbar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/calculator" element={<Calculator />} />
        <Route path="/audit-log" element={<AuditLog />} />
        <Route path="/statement/:id" element={<Statement />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/budget" element={<Budget />} />
      </Routes>
    </MotionConfig>
  );
}
