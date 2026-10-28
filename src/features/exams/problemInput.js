/** Decimal(6, 2), including zero and penalties. Commas are a UI convenience. */
export function problemScore(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value).trim().replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(text)) return null;
  const score = Number(text);
  return Number.isFinite(score) && Math.abs(score) < 10000 ? String(score) : null;
}
