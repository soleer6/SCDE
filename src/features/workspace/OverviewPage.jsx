import { useTranslation } from 'react-i18next';
import { useAuth } from '../../lib/auth/AuthProvider.jsx';
import { PageHeader } from '../../ui';

export default function OverviewPage() {
  const { t } = useTranslation('workspace');
  const { session } = useAuth();
  return <PageHeader eyebrow={t('overview.eyebrow')} title={t('overview.title', { name: session?.firstName })} />;
}
