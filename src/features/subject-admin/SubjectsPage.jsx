import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ButtonLink, Dialog, ErrorState, Field, Input, PageHeader } from '../../ui';
import { useApi } from '../../lib/hooks.js';
import { Pagination, Records } from '../admin/components.jsx';
import { getCurrentCourse, searchCatalog } from '../admin/api.js';
import { exportSubjects, importSubjects } from './api.js';
import ImportForm from '../admin/ImportForm.jsx';
import { downloadBlob } from '../admin/download.js';

export default function SubjectsPage() {
  const { t } = useTranslation('subject-admin');
  const current = useApi(getCurrentCourse);
  const [course, setCourse] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);
  const courseId = course || current.data?.id;
  const state = useApi(courseId ? () => searchCatalog({ course_id: courseId, search: query, page }) : null, [courseId, query, page]);
  const displayed = current.error && !courseId ? current : { ...state, loading: !courseId || state.loading };
  return <>
    <PageHeader eyebrow={t('context')} title={t('directory')} actions={<><Button onClick={() => setImporting(true)}>{t('import')}</Button><Button loading={pending} disabled={!courseId} onClick={async () => {
      setPending(true); setError(null);
      try {
        const data = await exportSubjects(courseId);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        downloadBlob(blob, 'subjects.json');
      } catch (err) { setError(err); } finally { setPending(false); }
    }}>{t('export')}</Button></>} />
    <form className="admin-actions" onSubmit={(e) => { e.preventDefault(); setQuery(search); setPage(1); }}>
      <Field label={t('course')} hint={t('courseHint')}>{(id) => <Input id={id} value={course || current.data?.id || ''} onChange={(e) => { setCourse(e.target.value); setPage(1); }} />}</Field>
      <Field label={t('search')}>{(id) => <Input id={id} value={search} onChange={(e) => setSearch(e.target.value)} />}</Field><Button type="submit">{t('common:search')}</Button>
    </form>
    {error && <ErrorState error={error} />}
    <Records state={displayed} columns={[
      { key: 'code', header: t('code'), render: (s) => <code className="admin-identifier">{s.code}</code> }, { key: 'name', header: t('name') },
      { key: 'actions', header: t('actions'), render: (s) => <ButtonLink to={`/subjects/${s.id}/manage`}>{t('manage')}</ButtonLink> },
    ]} />
    <Pagination data={state.data} page={page} onChange={setPage} />
    <Dialog open={importing} title={t('import')} onClose={() => setImporting(false)}>
      {importing && <ImportForm hint={t('importHint')} onImport={importSubjects} onComplete={state.reload} />}
    </Dialog>
  </>;
}
