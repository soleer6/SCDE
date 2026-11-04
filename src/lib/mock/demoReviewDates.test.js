import { describe, it, expect } from 'vitest';
import { updateDemoReviewDates } from './demoReviewDates.js';
const fixture = () => ({ reviews: [{ id: 'rv-mat-p1', status: 'OPEN', start_date: '2026-10-12T08:00:00.000Z', end_date: '2026-10-24T22:00:00.000Z' }] });
describe('demo review dates', () => {
 it('updates the old persisted fixture without replacing other data and stays stable on reload', () => {
  const d = fixture(); d.custom = ['kept']; const now = Date.parse('2026-11-04T12:00:00Z');
  expect(updateDemoReviewDates(d, now)).toBe(d);
  expect(Date.parse(d.reviews[0].start_date)).toBeLessThan(now);
  expect(Date.parse(d.reviews[0].end_date)).toBeGreaterThan(now);
  expect(d.custom).toEqual(['kept']);
  const end = d.reviews[0].end_date; updateDemoReviewDates(d, now + 999999);
  expect(d.reviews[0].end_date).toBe(end);
 });
 it('preserves edited and closed review windows', () => {
  const a = fixture(); a.reviews[0].end_date = '2026-10-25T22:00:00.000Z';
  const b = fixture(); b.reviews[0].status = 'CLOSED';
  for (const d of [a,b]) { const before = JSON.stringify(d); updateDemoReviewDates(d); expect(JSON.stringify(d)).toBe(before); }
 });
});
