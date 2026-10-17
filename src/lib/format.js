/* Formatting helpers. Backend decimals arrive as strings ("7.50"). */

export const toNumber = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

export function formatScore(v, digits = 2) {
  const n = toNumber(v);
  if (n === null || Number.isNaN(n)) return '—';
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

export function formatDate(v, opts = { day: '2-digit', month: 'short', year: 'numeric' }) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString(undefined, opts);
}

export function formatDateTime(v) {
  if (!v) return '—';
  return new Date(v).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export const fullName = (u) => [u?.first_name ?? u?.firstName, u?.last_name ?? u?.lastName].filter(Boolean).join(' ');
