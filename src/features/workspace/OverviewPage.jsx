import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../lib/auth/AuthProvider.jsx';
import { useApi } from '../../lib/hooks.js';
import { formatDate, formatDateTime } from '../../lib/format.js';
import { isTeachingRole } from '../../lib/permissions.js';
import { DataTable, EmptyState, ErrorState, Loader, PageHeader, Stats, TextLink } from '../../ui';
import { getMyExams, getMyTasks, useMySubjects } from './api.js';
import { Progress, RoleBadge } from './domain.jsx';
import { studentName } from './model.js';
import SubjectGrid from './SubjectGrid.jsx';

export default function OverviewPage() {
  const { t } = useTranslation('workspace');
  const { session } = useAuth();
  const subjects = useMySubjects();
  const teaches = subjects.subjects.some((s) => isTeachingRole(s.role));
  const studies = subjects.subjects.some((s) => s.role === 'STUDENT');

  return (
    <>
      <PageHeader
        eyebrow={t('overview.eyebrow')}
        title={t('overview.title', { name: session?.firstName })}
        lede={teaches ? t('overview.ledeTeacher') : studies ? t('overview.ledeStudent') : undefined}
      />
      {subjects.loading ? (
        <Loader page />
      ) : subjects.error ? (
        <ErrorState error={subjects.error} onRetry={subjects.reload} />
      ) : (
        <>
          {teaches && <TeacherWork />}
          {studies && <StudentWork roleOf={subjects.roleOf} />}
          <section className="dm-section">
            <div className="dm-section__head">
              <h2 className="ui-h3">{t('overview.subjects')}</h2>
              <TextLink to="/subjects">{t('overview.allSubjects')}</TextLink>
            </div>
            {subjects.subjects.length ? (
              <SubjectGrid subjects={subjects.subjects} />
            ) : (
              <EmptyState title={t('subjects.emptyTitle')} body={session?.isStaff ? t('subjects.emptyStaff') : t('subjects.emptyBody')} />
            )}
          </section>
        </>
      )}
    </>
  );
}

function TeacherWork() {
  const { t } = useTranslation('workspace');
  const navigate = useNavigate();
  const tasks = useApi(() => getMyTasks(), []);
  if (tasks.loading) return <Loader />;
  if (tasks.error) return <ErrorState error={tasks.error} onRetry={tasks.reload} />;
  const { grading_tasks: grading, pending_reviews: reviews } = tasks.data;
  const problemsLeft = grading.reduce((a, g) => a + g.ungraded_problems.length, 0);

  return (
    <>
      <section className="dm-section">
        <Stats
          items={[
            { label: t('overview.statExams'), value: grading.length, tone: grading.length ? 'gold' : undefined },
            { label: t('overview.statProblems'), value: problemsLeft },
            { label: t('overview.statReviews'), value: reviews.length, tone: reviews.length ? 'gold' : undefined },
          ]}
        />
      </section>
      <section className="dm-section">
        <div className="dm-section__head">
          <h2 className="ui-h3">{t('overview.queue')}</h2>
        </div>
        <DataTable
          caption={t('overview.queue')}
          rowKey="instance_id"
          rows={grading}
          onRowClick={(r) => navigate(`/instances/${r.instance_id}/grade`)}
          empty={<EmptyState title={t('overview.queueEmptyTitle')} body={t('overview.queueEmptyBody')} />}
          columns={[
            { key: 'exam_name', header: t('cols.exam') },
            { key: 'student', header: t('cols.student'), render: (r) => studentName(r.student_email) },
            {
              key: 'progress',
              header: t('cols.progress'),
              render: (r) => <Progress done={r.total_problems - r.ungraded_problems.length} total={r.total_problems} />,
            },
          ]}
        />
      </section>
      {reviews.length > 0 && (
        <section className="dm-section">
          <div className="dm-section__head">
            <h2 className="ui-h3">{t('overview.reviews')}</h2>
            <TextLink to="/reviews">{t('overview.allReviews')}</TextLink>
          </div>
          <DataTable
            caption={t('overview.reviews')}
            rowKey="review_request_id"
            rows={reviews}
            onRowClick={() => navigate('/reviews')}
            columns={[
              { key: 'exam_name', header: t('cols.exam') },
              { key: 'problem_name', header: t('cols.problem') },
              { key: 'student', header: t('cols.student'), render: (r) => studentName(r.student_email) },
              { key: 'created_at', header: t('cols.received'), render: (r) => formatDateTime(r.created_at) },
            ]}
          />
        </section>
      )}
    </>
  );
}

function StudentWork({ roleOf }) {
  const { t } = useTranslation('workspace');
  const navigate = useNavigate();
  const exams = useApi(() => getMyExams(), []);
  if (exams.loading) return <Loader />;
  if (exams.error) return <ErrorState error={exams.error} onRetry={exams.reload} />;
  const mine = exams.data.filter((e) => roleOf(e.subject_id) === 'STUDENT');

  return (
    <section className="dm-section">
      <div className="dm-section__head">
        <h2 className="ui-h3">{t('overview.myExams')}</h2>
      </div>
      <DataTable
        caption={t('overview.myExams')}
        rows={mine}
        onRowClick={(e) => navigate(`/exams/${e.id}`)}
        empty={<EmptyState title={t('overview.myExamsEmpty')} />}
        columns={[
          { key: 'subject', header: t('cols.subject'), render: (e) => `${e.subject_code} · ${e.subject_name}` },
          { key: 'name', header: t('cols.exam') },
          { key: 'date', header: t('cols.date'), render: (e) => formatDate(e.date) },
          { key: 'role', header: '', render: () => <RoleBadge role="STUDENT" /> },
        ]}
      />
    </section>
  );
}
