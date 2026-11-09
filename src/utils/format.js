/** Shared display helpers. Indian digit grouping everywhere: 12,34,567. */

export function formatNum(n) {
  return Math.round(Number(n) || 0).toLocaleString('en-IN');
}

export function inr(n) {
  const value = Math.round(Number(n) || 0);
  return value < 0 ? `−₹${formatNum(-value)}` : `₹${formatNum(value)}`;
}

/** "₹8.5 lakh", "₹1.2 crore": a read-back that catches a mistyped zero. */
export function inWords(n) {
  const value = Number(n) || 0;
  if (value < 1000) return '';
  const trim = (x) => x.toFixed(2).replace(/\.?0+$/, '');
  if (value >= 10000000) return `₹${trim(value / 10000000)} crore`;
  if (value >= 100000) return `₹${trim(value / 100000)} lakh`;
  return `₹${trim(value / 1000)} thousand`;
}

export function formatDate(iso, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Date(iso).toLocaleDateString('en-IN', options);
}

export function formatDateTime(iso) {
  const date = new Date(iso);
  const time = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return `${formatDate(iso)}, ${time}`;
}

export function shortHash(hash) {
  return hash ? `${hash.slice(0, 10)}…${hash.slice(-6)}` : '';
}

export function maskPan(pan) {
  return pan && pan.length === 10 ? `${pan.slice(0, 2)}•••••${pan.slice(7)}` : pan || '';
}

export function downloadFile(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
