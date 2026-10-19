import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../lib/auth/AuthProvider.jsx';
import { useApi } from '../../../lib/hooks.js';
import { formatDate } from '../../../lib/format.js';
import { can } from '../../../lib/permissions.js';
import { EmptyState, ErrorState, Loader, PageHeader, Tabs, ButtonLink } from '../../../ui';
import { useMySubjects } from '../../workspace/api.js';
import { getExam } from '../api.js';
import DetailsTab from './DetailsTab.jsx';
import StructureTab from './StructureTab.jsx';
import ConvocationTab from './ConvocationTab.jsx';
import CorrectorsTab from './CorrectorsTab.jsx';
import './setup.css';

/** /exams/:examId/setup — exam authoring (RF-6.x) and corrector assignment (RF-8.x). */
export default function ExamSetupPage() {
  const { examId } = useParams();
  const { t } = useTranslation('exams');
  const { session } = useAuth();
  const exam = useApi(() => getExam(examId), [examId]);
  const { roleOf, loading } = useMySubjects();
  const [tab, setTab] = useState('structure');

  // Only the first load shows the loader: reloading after a save must not unmount the tabs.
  if (exam.initialLoading || loading) return <Loader page />;
  if (exam.error) return <ErrorState error={exam.error} onRetry={exam.reload} />;
  const e = exam.data;
  const role = roleOf(e.subject_id);
  const perms = {
    exams: can(session, role, 'can_create_exams'),
    rubric: can(session, role, 'can_create_rubric'),
    members: can(session, role, 'can_manage_members'),
    correctors: can(session, role, 'can_assign_correctors'),
  };
  if (!perms.exams && !perms.rubric && !perms.correctors) {
    return <EmptyState title={t('setup.denied')} action={<ButtonLink to={`/exams/${e.id}`}>{t('setup.back')}</ButtonLink>} />;
  }

  const tabs = [
    perms.exams && { value: 'details', label: t('setup.tabs.details') },
    (perms.exams || perms.rubric) && { value: 'structure', label: t('setup.tabs.structure') },
    perms.members && { value: 'convocation', label: t('setup.tabs.convocation'), count: e.convocation?.length },
    perms.correctors && { value: 'correctors', label: t('setup.tabs.correctors') },
  ].filter(Boolean);
  const current = tabs.some((x) => x.value === tab) ? tab : tabs[0].value;

  return (
    <>
      <PageHeader
        crumbs={[
          { label: t('crumbs.subjects'), to: '/subjects' },
          { label: e.subject_code, to: `/subjects/${e.subject_id}` },
          { label: e.name, to: `/exams/${e.id}` },
          { label: t('setup.crumb') },
        ]}
        eyebrow={`${e.subject_code} · ${e.subject_name}${e.date ? ` · ${formatDate(e.date)}` : ''}`}
        title={t('setup.title', { name: e.name })}
        lede={t('setup.lede')}
        actions={<ButtonLink to={`/exams/${e.id}`}>{t('setup.back')}</ButtonLink>}
      />
      <Tabs label={t('setup.tabsLabel')} tabs={tabs} value={current} onChange={setTab} />
      {current === 'details' && <DetailsTab exam={e} onSaved={exam.reload} />}
      {current === 'structure' && <StructureTab exam={e} perms={perms} onChanged={exam.reload} />}
      {current === 'convocation' && <ConvocationTab exam={e} onSaved={exam.reload} />}
      {current === 'correctors' && <CorrectorsTab exam={e} />}
    </>
  );
}
