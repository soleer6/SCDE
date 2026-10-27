import { lazy } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthProvider.jsx';
import { useApi } from '../../lib/hooks.js';
import { ErrorState, Loader } from '../../ui';
import { useMySubjects } from '../workspace/api.js';
import { getExam } from './api.js';
import TeacherExamView from './TeacherExamView.jsx';

const StudentResultView = lazy(() => import('../results/StudentResultView.jsx'));

/** /exams/:examId — the per-subject role decides which view is shown. */
export default function ExamPage() {
  const { examId } = useParams();
  const { session } = useAuth();
  const exam = useApi(() => getExam(examId), [examId]);
  const { roleOf, membershipOf, loading, initialLoading: permissionsLoading, error: permissionsError, reload: reloadPermissions } = useMySubjects();

  if (exam.initialLoading || permissionsLoading) return <Loader page />;
  if (permissionsError) return <ErrorState error={permissionsError} onRetry={reloadPermissions} />;
  if (exam.error) return <ErrorState error={exam.error} onRetry={exam.reload} />;
  const role = roleOf(exam.data.subject_id);
  if (role === 'STUDENT' && !session?.isStaff) return <StudentResultView exam={exam.data} />;
  return <TeacherExamView exam={exam.data} membership={membershipOf(exam.data.subject_id)} permissionsReady={!loading} reloadExam={exam.reload} />;
}
