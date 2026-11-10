const key = (userId, instanceId, requestId) => `scde.review-before.v1:${userId}:${instanceId}:${requestId}`;
export function rememberReviewScores(userId, instance, requests) {
  if (!userId || !instance?.id || !Array.isArray(requests)) return;
  for (const request of requests) {
    const grade = instance.grades?.find((g) => g.problem_id === request.problem_id);
    try {
      const storageKey = key(userId, instance.id, request.id);
      if (!localStorage.getItem(storageKey)) localStorage.setItem(storageKey, JSON.stringify({
        score: grade?.score ?? null, total: instance.total_score ?? null, at: Date.now(),
      }));
    } catch { /* No storage: show that the previous score is unavailable. */ }
  }
}
export function previousReviewScores(userId, instanceId, requestId) {
  if (!userId) return null;
  try { return JSON.parse(localStorage.getItem(key(userId, instanceId, requestId))); }
  catch { return null; }
}
