import { useTranslation } from 'react-i18next';
import { useAuth } from '../../lib/auth/AuthProvider.jsx';
import { EmptyState, ErrorState, Loader, PageHeader } from '../../ui';
import { useMySubjects } from './api.js';
import SubjectGrid from './SubjectGrid.jsx';

export default function SubjectsPage() {
  const { t } = useTranslation('workspace');
  const { session } = useAuth();
  const { subjects, loading, error, reload } = useMySubjects();

  return (
    <>
      <PageHeader eyebrow={t('overview.eyebrow')} title={t('subjects.title')} lede={t('subjects.lede')} />
      {loading ? (
        <Loader page />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : subjects.length ? (
        <SubjectGrid subjects={subjects} />
      ) : (
        <EmptyState title={t('subjects.emptyTitle')} body={session?.isStaff ? t('subjects.emptyStaff') : t('subjects.emptyBody')} />
      )}
    </>
  );
}
