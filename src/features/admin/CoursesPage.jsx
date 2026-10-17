import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Dialog, ErrorState, Field, Input, Loader, PageHeader, Panel } from '../../ui';
import { useApi } from '../../lib/hooks.js';
import { createCourse, getCourse, getCurrentCourse, updateCourse } from './api.js';
import { RecordForm } from './components.jsx';

export default function CoursesPage() {
  const { t } = useTranslation('admin');
  const current = useApi(getCurrentCourse);
  const [id, setId] = useState('');
  const [lookup, setLookup] = useState('');
  const other = useApi(lookup ? () => getCourse(lookup) : null, [lookup]);
  const [editing, setEditing] = useState(null);
  const course = (row) => <Panel key={row.id} title={row.label} actions={<Button onClick={() => setEditing(row)}>{t('editCourse')}</Button>}>
    <p>{row.id}</p><p>{row.start_date ?? '—'} → {row.end_date ?? '—'}</p><Badge tone={row.is_active ? 'gold' : undefined}>{t(row.is_active ? 'current' : 'inactive')}</Badge>
  </Panel>;
  return <div className="admin-stack">
    <PageHeader eyebrow={t('management')} title={t('courses')} lede={t('courseHint')} actions={<Button variant="primary" onClick={() => setEditing({ label: '', start_date: '', end_date: '' })}>{t('newCourse')}</Button>} />
    {current.loading ? <Loader /> : current.error ? <ErrorState error={current.error} onRetry={current.reload} /> : current.data && course(current.data)}
    <form className="admin-actions" onSubmit={(e) => { e.preventDefault(); setLookup(id.trim()); if (id.trim() === lookup) other.reload(); }}>
      <Field label={t('courseId')} hint={t('findCourse')}>{(inputId) => <Input id={inputId} value={id} onChange={(e) => setId(e.target.value)} required />}</Field><Button type="submit">{t('find')}</Button>
    </form>
    {lookup && (other.loading ? <Loader /> : other.error ? <ErrorState error={other.error} onRetry={other.reload} /> : other.data && course(other.data))}
    <Dialog open={Boolean(editing)} title={t(editing?.id ? 'courses' : 'newCourse')} onClose={() => setEditing(null)}>
      {editing && <RecordForm key={editing.id ?? 'new'} initial={editing} fields={['label', 'start_date', 'end_date'].map((name) => ({ name, label: t(name), type: name === 'label' ? 'text' : 'date', required: name === 'label' }))} onSave={async (v) => {
        const body = { label: v.label, start_date: v.start_date || null, end_date: v.end_date || null };
        const result = editing.id ? await updateCourse(editing.id, body) : await createCourse(body);
        setId(result.id); setLookup(result.id); setEditing(null); current.reload(); other.reload();
      }} />}
    </Dialog>
  </div>;
}
