import { api, asList } from '../../lib/api/client.js';
import { useEffect } from 'react';
import { useApi } from '../../lib/hooks.js';
import { useAuth } from '../../lib/auth/AuthProvider.jsx';
import { decodeJwt, tokenStore } from '../../lib/api/tokens.js';

/* GET /my-subjects/ -> MySubject[] (role is per subject) */
export const getMySubjects = () => api.get('/my-subjects/').then(asList);
/* GET /subjects/{id}/ -> SubjectDetail */
export const getSubject = (id) => api.get(`/subjects/${id}/`);
/* GET /subjects/{id}/exams/ -> ExamBasic | ExamTeacher | ExamFull (by role) */
export const getSubjectExams = (id) => api.get(`/subjects/${id}/exams/`).then(asList);
/* GET /my-exams/ -> same serializers, active course */
export const getMyExams = () => api.get('/my-exams/').then(asList);
/* GET /my-tasks/ -> { grading_tasks, pending_reviews } */
export const getMyTasks = (examId) => api.get('/my-tasks/', examId ? { exam_id: examId } : undefined);

/* Session-wide cache of /my-subjects/: role lookups happen on most pages.
   Keyed by user id so a different login never sees another user's roles. */
let cache = { userId: null, promise: null };
export function getMySubjectsCached({ refresh = false } = {}) {
  const userId = decodeJwt(tokenStore.getAccess())?.user_id ?? null;
  if (!cache.promise || refresh || cache.userId !== userId) {
    const promise = getMySubjects().catch((e) => {
      cache = { userId: null, promise: null };
      throw e;
    });
    cache = { userId, promise };
  }
  return cache.promise;
}
export const clearSubjectsCache = () => {
  cache = { userId: null, promise: null };
};

/** Returns { subjects, loading, error } and helper roleOf(subjectId). */
export function useMySubjects() {
  const res = useApi(() => getMySubjectsCached(), []);
  const { session, updateSession } = useAuth();
  // Teach the session whether the user teaches anywhere (nav uses it).
  const teaches = res.data ? res.data.some((s) => s.role !== 'STUDENT') : undefined;
  useEffect(() => {
    if (teaches !== undefined && session && session.teaches !== teaches) updateSession({ teaches });
  }, [teaches, session, updateSession]);
  const roleOf = (subjectId) => res.data?.find((s) => s.id === subjectId)?.role ?? null;
  return { ...res, subjects: res.data ?? [], roleOf };
}
