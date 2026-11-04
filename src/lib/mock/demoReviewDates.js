// Only the untouched legacy fixture is upgraded; user-edited windows remain intact.
export function updateDemoReviewDates(data, now = Date.now()) {
  const review = data.reviews?.find((r) => r.id === 'rv-mat-p1');
  if (review?.status !== 'OPEN' || review.start_date !== '2026-10-12T08:00:00.000Z'
      || review.end_date !== '2026-10-24T22:00:00.000Z') return data;
  review.start_date = new Date(now - 3 * 86400000).toISOString();
  review.end_date = new Date(now + 14 * 86400000).toISOString();
  const note = data.notifications?.find((n) => n.id === 'n-2' && n.user_id === 'u-elena');
  if (note) note.message = 'El periodo de revisión de Cálculo I · Parcial 1 está abierto.';
  return data;
}
