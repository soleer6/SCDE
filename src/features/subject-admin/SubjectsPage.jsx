import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ButtonLink, Dialog, ErrorState, Field, Input, PageHeader } from '../../ui';
import { useApi } from '../../lib/hooks.js';
import { Pagination, RecordForm, Records } from '../admin/components.jsx';
import { getCurrentCourse, searchCatalog } from '../admin/api.js';
import { createSubject, deleteSubject, exportSubjects, importSubjects, updateSubject } from './api.js';
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
  const resultsRef = useRef(null);
  const searchRef = useRef(null);
  const focusAfterQuery = useRef(null);
  const recovering = useRef(false);
  const restoreFocus = useRef(null);
  const importPendingRef = useRef(false);
  const closeImport = useCallback(() => { if (!importPendingRef.current) setImporting(false); }, []);
  const [error, setError] = useState(null);
  const courseId = course || current.data?.id;
  const state = useApi(courseId ? () => searchCatalog({ course_id: courseId, search: query, page }) : null, [courseId, query, page]);
  const displayed = current.error && !courseId ? current : { ...state, loading: !courseId || state.loading };
  useEffect(() => {
    if (state.loading) return;
    if (state.error) {
      focusAfterQuery.current = null;
      recovering.current = true;
    } else if (recovering.current && state.data) {
      recovering.current = false;
      if (!focusAfterQuery.current) searchRef.current?.focus();
    }
  }, [state.loading, state.error, state.data]);
  useEffect(() => {
    const target = focusAfterQuery.current;
    if (!target || state.loading || state.error || target.data === state.data) return;
    focusAfterQuery.current = null;
    resultsRef.current?.focus();
  }, [state.loading, state.error, state.data]);
  useEffect(() => {
    // Wait for fresh results, including after a failed reload and retry.
    const target = restoreFocus.current;
    if (!target || editing || removing || state.loading || state.error || target.data === state.data) return;
    restoreFocus.current = null;
    resultsRef.current?.focus();
  }, [editing, removing, state.loading, state.error, state.data]);
  return <>
    <PageHeader eyebrow={t('context')} title={t('directory')} lede={t('directoryHint')} actions={<><Button variant="primary" disabled={current.loading || Boolean(current.error)} onClick={() => setEditing({})}>{t('createSubject')}</Button><Button onClick={() => setImporting(true)}>{t('import')}</Button><Button loading={pending} disabled={!courseId} onClick={async () => {
      setPending(true); setError(null);
      try {
        const data = await exportSubjects(courseId);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        downloadBlob(blob, 'subjects.json');
      } catch (err) { setError(err); } finally { setPending(false); }
    }}>{t('export')}</Button></>} />
    <form className="admin-actions" onSubmit={(e) => {
      e.preventDefault();
      focusAfterQuery.current = { data: state.data };
      if (page === 1 && query === search) state.reload();
      else { setQuery(search); setPage(1); }
    }}>
      <Field label={t('course')} hint={t('courseHint')}>{(id) => <Input id={id} value={course || current.data?.id || ''} onChange={(e) => { focusAfterQuery.current = { data: state.data }; setCourse(e.target.value); setPage(1); }} />}</Field>
      <Field label={t('search')}>{(id) => <Input ref={searchRef} id={id} value={search} onChange={(e) => setSearch(e.target.value)} />}</Field><Button type="submit">{t('common:search')}</Button>
    </form>
    {error && <ErrorState error={error} />}
    <section ref={resultsRef} tabIndex={-1} aria-label={t('directory')}><Records state={displayed} focusError action={<Button disabled={current.loading || Boolean(current.error)} onClick={() => setEditing({})}>{t('createSubject')}</Button>} columns={[
      { key: 'code', header: t('code'), render: (s) => <code className="admin-identifier">{s.code}</code> }, { key: 'name', header: t('name') },
      { key: 'actions', header: t('actions'), render: (s) => <div className="admin-actions"><ButtonLink to={`/subjects/${s.id}/manage`}>{t('manage')}</ButtonLink><Button size="sm" disabled={s.course_id !== current.data?.id} onClick={() => setEditing(s)}>{t('editSubject')}</Button><Button size="sm" variant="danger" disabled={s.course_id !== current.data?.id} onClick={() => setRemoving(s)}>{t('deleteSubject')}</Button></div> },
    ]} /></section>
    <Pagination data={state.data} page={page} onChange={(value) => { focusAfterQuery.current = { data: state.data }; setPage(value); }} />
    {editing && <SubjectEditor subject={editing} onClose={() => setEditing(null)} onSaved={(created) => {
      restoreFocus.current = { data: state.data };
      setEditing(null);
      if (created) { setCourse(''); setSearch(''); setQuery(''); setPage(1); }
      state.reload();
    }} />}
    {removing && <SubjectRemoval subject={removing} onClose={() => setRemoving(null)} onDeleted={() => {
      restoreFocus.current = { data: state.data };
      setRemoving(null);
      if (page > 1 && state.data?.results?.length === 1) setPage(page - 1);
      else state.reload();
    }} />}
    <Dialog open={importing} title={t('import')} onClose={closeImport}>
      {importing && <ImportForm hint={t('importHint')} onImport={importSubjects} onComplete={state.reload} onPendingChange={(value) => { importPendingRef.current = value; }} />}
    </Dialog>
  </>;
}

function SubjectEditor({ subject, onClose, onSaved }) {
  const { t } = useTranslation('subject-admin');
  const saving = useRef(false);
  const close = useCallback(() => { if (!saving.current) onClose(); }, [onClose]);
  return <Dialog open title={t(subject.id ? 'editSubject' : 'createSubject')} onClose={close}>
    <RecordForm initial={{ name: subject.name ?? '', code: subject.code ?? '', semester: subject.semester ?? '', coordinator_id: subject.coordinator_id ?? '' }} fields={[
      { name: 'name', label: t('name'), required: true, maxLength: 255 },
      { name: 'code', label: t('code'), required: true, maxLength: 50 },
      { name: 'semester', label: t('semester'), maxLength: 100 },
      { name: 'coordinator_id', label: t('coordinator_id'), required: true },
    ]} onSave={async (values) => {
      saving.current = true;
      try {
        const body = { name: values.name.trim(), code: values.code.trim(), coordinator_id: values.coordinator_id.trim() };
        // Creation applies the backend default when the optional semester is blank.
        if (subject.id || values.semester.trim()) body.semester = values.semester.trim();
        if (subject.id) await updateSubject(subject.id, body); else await createSubject(body);
        onSaved(!subject.id);
      } finally { saving.current = false; }
    }}><p>{t(subject.id ? 'coordinatorHint' : 'createSubjectHint')}</p></RecordForm>
  </Dialog>;
}

function SubjectRemoval({ subject, onClose, onDeleted }) {
  const { t } = useTranslation('subject-admin');
  const saving = useRef(false);
  const errorRef = useRef(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const close = useCallback(() => { if (!saving.current) onClose(); }, [onClose]);
  useEffect(() => { if (error && !pending) errorRef.current?.focus(); }, [error, pending]);
  return <Dialog open title={t('deleteSubject')} onClose={close} footer={<Button variant="danger" loading={pending} onClick={async () => {
    if (saving.current) return;
    saving.current = true; setPending(true); setError(null);
    try { await deleteSubject(subject.id); onDeleted(); }
    catch (err) { setError(err); }
    finally { saving.current = false; setPending(false); }
  }}>{t('common:confirm')}</Button>}>
    <p>{t('deleteSubjectConfirm')}</p><p>{subject.code} · {subject.name}</p>
    {error && <div ref={errorRef} tabIndex={-1}><ErrorState error={error} title={t(`subjectErrors.${error.code}`, { defaultValue: t('deleteSubjectError') })} /></div>}
  </Dialog>;
}
