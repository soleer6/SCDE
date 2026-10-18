import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Dialog, Field, Input, PageHeader } from '../../ui';
import { useApi } from '../../lib/hooks.js';
import { createCourse, searchCatalog, updateCourse } from './api.js';
import { Pagination, RecordForm, Records } from './components.jsx';

export default function CoursesPage() {
  const { t } = useTranslation('admin');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const courses = useApi(() => searchCatalog({ page, search: query }), [page, query]);
  const searchRef = useRef(null);
  const recovering = useRef(false);
  useEffect(() => {
    if (courses.loading) return;
    if (courses.error) {
      recovering.current = true;
    } else if (recovering.current && courses.data) {
      recovering.current = false;
      searchRef.current?.focus();
    }
  }, [courses.loading, courses.error, courses.data]);
  return <>
    <PageHeader eyebrow={t('management')} title={t('courses')} lede={t('courseListHint')} actions={<Button variant="primary" onClick={() => setEditing({ label: '', start_date: '', end_date: '' })}>{t('newCourse')}</Button>} />
    <form className="admin-actions" onSubmit={(e) => {
      e.preventDefault();
      if (page === 1 && query === search) courses.reload();
      else { setQuery(search); setPage(1); }
    }}>
      <Field label={t('searchCourses')}>{(id) => <Input ref={searchRef} id={id} value={search} onChange={(e) => setSearch(e.target.value)} />}</Field>
      <Button type="submit">{t('common:search')}</Button>
    </form>
    <div><Records focusError state={courses} action={<Button onClick={() => setEditing({ label: '', start_date: '', end_date: '' })}>{t('newCourse')}</Button>} columns={[
      { key: 'label', header: t('label') },
      { key: 'is_active', header: t('status'), render: (c) => <Badge tone={c.is_active ? 'accent' : undefined}>{t(c.is_active ? 'current' : 'inactive')}</Badge> },
      { key: 'start_date', header: t('start_date') }, { key: 'end_date', header: t('end_date') },
      { key: 'subject_count', header: t('subjectCount'), align: 'num' },
      { key: 'actions', header: t('actions'), render: (c) => <Button size="sm" onClick={() => setEditing(c)}>{t('editCourse')}</Button> },
    ]} /></div>
    <Pagination data={courses.data} page={page} onChange={setPage} />
    <Dialog open={Boolean(editing)} title={t(editing?.id ? 'editCourse' : 'newCourse')} onClose={() => setEditing(null)}>
      {editing && <RecordForm key={editing.id ?? 'new'} initial={editing} fields={['label', 'start_date', 'end_date'].map((name) => ({ name, label: t(name), type: name === 'label' ? 'text' : 'date', required: name === 'label' }))} onSave={async (v) => {
        const body = { label: v.label, start_date: v.start_date || null, end_date: v.end_date || null };
        if (editing.id) await updateCourse(editing.id, body); else await createCourse(body);
        setEditing(null); setQuery(''); setSearch(''); setPage(1); courses.reload();
      }} />}
    </Dialog>
  </>;
}
