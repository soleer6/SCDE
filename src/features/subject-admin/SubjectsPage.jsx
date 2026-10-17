import { useTranslation } from 'react-i18next';
import { Button, ButtonLink, PageHeader } from '../../ui';
import { useApi } from '../../lib/hooks.js';
import { Records } from '../admin/components.jsx';
import { exportSubjects } from './api.js';

export default function SubjectsPage() {
  const { t } = useTranslation('subject-admin');
  const state = useApi(exportSubjects);
  return <>
    <PageHeader eyebrow={t('context')} title={t('directory')} actions={<Button disabled={!state.data || state.loading} onClick={() => {
      const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'subjects.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }}>{t('export')}</Button>} />
    <Records state={state} columns={[
      { key: 'code', header: t('code') }, { key: 'name', header: t('name') }, { key: 'course_id', header: t('course') },
      { key: 'actions', header: t('actions'), render: (s) => <ButtonLink to={`/subjects/${s.id}/manage`}>{t('manage')}</ButtonLink> },
    ]} />
  </>;
}
