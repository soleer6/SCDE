import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../lib/auth/AuthProvider.jsx';
import { useApi } from '../../lib/hooks.js';
import { formatDate } from '../../lib/format.js';
import { can, isTeachingRole } from '../../lib/permissions.js';
import { Button, ButtonLink, DataTable, EmptyState, ErrorState, KeyValue, Loader, PageHeader, Panel } from '../../ui';
import { getAllExamInstances } from '../exams/api.js';
import NewExamDialog from '../exams/setup/NewExamDialog.jsx';
import { getSubject, getSubjectExams, useMySubjects } from './api.js';
import { Progress, RoleBadge } from './domain.jsx';
import { GRADED_STATES } from './model.js';

export default function SubjectPage() {
  const { subjectId } = useParams();
  const { t } = useTranslation('workspace');
  const { session } = useAuth();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const { roleOf, loading: rolesLoading } = useMySubjects();
  const role = roleOf(subjectId);
  const teaching = isTeachingRole(role) || session?.isStaff;

  const subject = useApi(() => getSubject(subjectId), [subjectId]);
  const exams = useApi(async () => {
    const list = await getSubjectExams(subjectId);
    if (!teaching) return list;
    // Teachers: attach grading progress per exam (one request per exam).
    return Promise.all(
      list.map(async (e) => {
        try {
          const inst = await getAllExamInstances(e.id);
          return { ...e, _total: inst.length, _graded: inst.filter((i) => GRADED_STATES.includes(i.status)).length };
        } catch {
          return e;
        }
      }),
    );
  }, [subjectId, teaching]);

  if (subject.loading || rolesLoading) return <Loader page />;
  if (subject.error) return <ErrorState error={subject.error} onRetry={subject.reload} />;
  const s = subject.data;
  const canManage = can(session, role, 'can_manage_members') || can(session, role, 'can_manage_groups');
  const canCreate = can(session, role, 'can_create_exams');

  const columns = [
    { key: 'name', header: t('cols.exam') },
    { key: 'date', header: t('cols.date'), render: (e) => formatDate(e.date) },
  ];
  if (teaching) {
    columns.push(
      { key: 'problems', header: t('cols.problems'), align: 'num', render: (e) => e.models_problems?.reduce((a, m) => a + m.problems.length, 0) ?? '—' },
      { key: 'students', header: t('cols.students'), align: 'num', render: (e) => e.convocation?.length ?? '—' },
      { key: 'progress', header: t('cols.graded'), render: (e) => (e._total != null ? <Progress done={e._graded} total={e._total} /> : '—') },
    );
  }

  return (
    <>
      <PageHeader
        crumbs={[{ label: t('subjects.title'), to: '/subjects' }, { label: s.code }]}
        eyebrow={`${s.code} · ${t('subjects.semester', { n: s.semester })}`}
        title={s.name}
        actions={
          <>
            {role && <RoleBadge role={role} />}
            {canManage && (
              <ButtonLink to={`/subjects/${s.id}/manage`} variant="primary">
                {t('subject.manage')}
              </ButtonLink>
            )}
            {canCreate && (
              <Button variant="solid" onClick={() => setCreating(true)}>
                {t('subject.newExam')}
              </Button>
            )}
          </>
        }
      />
      <div className="dm-split">
        <section className="dm-section">
          <h2 className="ui-h3">{t('subject.exams')}</h2>
          {exams.loading ? (
            <Loader />
          ) : exams.error ? (
            <ErrorState error={exams.error} onRetry={exams.reload} />
          ) : (
            <DataTable
              caption={t('subject.exams')}
              rows={exams.data}
              onRowClick={(e) => navigate(`/exams/${e.id}`)}
              empty={<EmptyState title={t('subject.noExams')} body={teaching ? t('subject.noExamsTeacher') : undefined} />}
              columns={columns}
            />
          )}
        </section>
        <Panel title={t('subject.details')}>
          <KeyValue
            items={[
              { label: t('subject.coordinator'), value: s.coordinator_email },
              { label: t('subject.groups'), value: s.groups?.map((g) => g.label).join(', ') || '—' },
              { label: t('roles.TEACHER', { ns: 'common' }), value: (s.member_counts?.COORDINATOR ?? 0) + (s.member_counts?.TEACHER ?? 0) },
              { label: t('roles.STUDENT', { ns: 'common' }), value: s.member_counts?.STUDENT ?? '—' },
            ]}
          />
        </Panel>
      </div>
      {canCreate && <NewExamDialog subjectId={s.id} open={creating} onClose={() => setCreating(false)} />}
    </>
  );
}
