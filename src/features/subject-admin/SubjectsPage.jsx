import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ButtonLink, Dialog, ErrorState, Field, Input, PageHeader } from '../../ui';
import { useApi } from '../../lib/hooks.js';
import { Pagination, Records } from '../admin/components.jsx';
import { SubjectEditor, SubjectRemoval } from './SubjectDialogs.jsx';
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
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const createRef = useRef(null);
  const restoreFocus = useRef(false);
  const importPendingRef = useRef(false);
  const [error, setError] = useState(null);
  const courseId = course || current.data?.id;
  const state = useApi(courseId ? () => searchCatalog({ course_id: courseId, search: query, page }) : null, [courseId, query, page]);
  const displayed = current.error && !courseId ? current : { ...state, loading: !courseId || state.loading };
  useEffect(() => {
    // Dialog restores its opener on unmount; after a mutation that row may vanish.
    if (restoreFocus.current && !editing && !removing && !state.loading) {
      createRef.current?.focus(); restoreFocus.current = false;
    }
  }, [editing, removing, state.loading]);
  return <>
    <PageHeader eyebrow={t('context')} title={t('directory')} lede={t('directoryHint')} actions={<><Button ref={createRef} variant="primary" disabled={current.loading || Boolean(current.error)} onClick={() => setEditing({})}>{t('createSubject')}</Button><Button onClick={() => setImporting(true)}>{t('import')}</Button><Button loading={pending} disabled={!courseId} onClick={async () => {
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
    <Records state={displayed} focusError action={<Button disabled={current.loading || Boolean(current.error)} onClick={() => setEditing({})}>{t('createSubject')}</Button>} columns={[
      { key: 'code', header: t('code'), render: (s) => <code className="admin-identifier">{s.code}</code> }, { key: 'name', header: t('name') },
      { key: 'actions', header: t('actions'), render: (s) => <div className="admin-actions"><ButtonLink to={`/subjects/${s.id}/manage`}>{t('manage')}</ButtonLink><Button size="sm" disabled={s.course_id !== current.data?.id} onClick={() => setEditing(s)}>{t('editSubject')}</Button><Button size="sm" variant="danger" disabled={s.course_id !== current.data?.id} onClick={() => setRemoving(s)}>{t('deleteSubject')}</Button></div> },
    ]} />
    <Pagination data={state.data} page={page} onChange={setPage} />
    {editing && <SubjectEditor subject={editing} onClose={() => setEditing(null)} onSaved={(created) => {
      restoreFocus.current = true;
      setEditing(null);
      if (created) { setCourse(''); setSearch(''); setQuery(''); setPage(1); }
      state.reload();
    }} />}
    {removing && <SubjectRemoval subject={removing} onClose={() => setRemoving(null)} onDeleted={() => {
      restoreFocus.current = true;
      setRemoving(null);
      if (page > 1 && state.data?.results?.length === 1) setPage(page - 1);
      else state.reload();
    }} />}
    <Dialog open={importing} title={t('import')} onClose={() => !importPendingRef.current && setImporting(false)}>
      {importing && <ImportForm hint={t('importHint')} onImport={importSubjects} onComplete={state.reload} onPendingChange={(value) => { importPendingRef.current = value; }} />}
    </Dialog>
  </>;
}
