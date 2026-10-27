import { api, asList } from '../../lib/api/client.js';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { invalidatePermissions, permissionRevision, subscribePermissions } from '../../lib/permissionEvents.js';
import { useAuth } from '../../lib/auth/AuthProvider.jsx';
import { tokenStore } from '../../lib/api/tokens.js';

/* GET /my-subjects/ -> MySubject[] (role is per subject) */
export const getMySubjects = () => api.get('/my-subjects/', undefined, { cache: 'no-store' }).then(asList);
/* GET /subjects/{id}/ -> SubjectDetail */
export const getSubject = (id) => api.get(`/subjects/${id}/`);
/* GET /subjects/{id}/exams/ -> ExamBasic | ExamTeacher | ExamFull (by role) */
export const getSubjectExams = (id) => api.get(`/subjects/${id}/exams/`).then(asList);
/* GET /my-exams/ -> same serializers, active course */
export const getMyExams = () => api.get('/my-exams/').then(asList);
/* GET /my-tasks/ -> { grading_tasks, pending_reviews } */
export const getMyTasks = (examId) => api.get('/my-tasks/', examId ? { exam_id: examId } : undefined);

/* In-flight sharing only: each route/session/revision requires a fresh read.
   Failed or superseded reads never restore old permissions. */
let cache = { key: null, promise: null };
export function getMySubjectsCached({ refresh = false, context = '' } = {}) {
  const key = `${tokenStore.getAccess()}:${context}:${permissionRevision()}`;
  if (!cache.promise || refresh || cache.key !== key) {
    cache = { key, promise: getMySubjects() };
  }
  return cache.promise;
}
export const clearSubjectsCache = invalidatePermissions;

export function useMySubjects() {
  const { session, updateSession } = useAuth();
  const location = useLocation();
  const revision = useSyncExternalStore(subscribePermissions, permissionRevision);
  const context = `${session?.id}:${session?.organizationId}:${session?.isStaff}:${session?.isSuperadmin}:${location.key}:${location.pathname}`;
  const key = `${context}:${revision}`;
  const [state, setState] = useState({ key: null, data: undefined, error: null });
  useEffect(() => {
    let alive = true;
    getMySubjectsCached({ context }).then(
      (data) => { if (alive) setState({ key, context, data, error: null }); },
      (error) => { if (alive) setState({ key, context, data: undefined, error }); },
    );
    return () => { alive = false; };
  }, [context, key]);
  useEffect(() => {
    const focus = () => invalidatePermissions();
    const visible = () => { if (document.visibilityState === 'visible') focus(); };
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', visible);
    };
  }, []);
  const loading = state.key !== key;
  const data = loading || state.error ? undefined : state.data;
  const teaches = data ? data.some((s) => s.role !== 'STUDENT') : undefined;
  useEffect(() => {
    if (teaches !== undefined && session && session.teaches !== teaches) updateSession({ teaches });
  }, [teaches, session, updateSession]);
  const membershipOf = (subjectId) => data?.find((s) => s.id === subjectId) ?? null;
  // Role identifies the view during revalidation; it never grants a capability.
  const roleOf = (subjectId) => (state.context === context ? state.data : data)?.find((s) => s.id === subjectId)?.role ?? null;
  return { data, subjects: data ?? [], loading, initialLoading: loading && state.context !== context,
    error: loading ? null : state.error, reload: invalidatePermissions, roleOf, membershipOf };
}
