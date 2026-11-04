import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../lib/auth/AuthProvider.jsx';
import { ApiError } from '../../lib/api/errors.js';
import { useApi } from '../../lib/hooks.js';
import { Badge, Button, Dialog, ErrorState, Field, Input, KeyValue, PageHeader, Select } from '../../ui';
import { searchCatalog } from './api.js';
import { Pagination, Records } from './components.jsx';

const levels = ['courses', 'subjects', 'exams', 'instances'];
const keys = ['course', 'subject', 'exam'];
const statuses = ['ASSEMBLING', 'RECEIVED', 'QUEUED', 'PENDING_GRADING', 'GRADED', 'PUBLISHED', 'IN_REVIEW', 'PENDING_REVIEW', 'FINALIZED', 'ARCHIVED'];

export default function HistoryPage() {
  const { session } = useAuth();
  const { t } = useTranslation('admin');
  const [params] = useSearchParams();
  if (!(session?.isStaff || session?.isSuperadmin)) return <ErrorState error={new ApiError('PERMISSION_DENIED', 403)} />;
  // A new hierarchy level starts with fresh data/dialog/focus state. The URL
  // retains the level, search and page for reload and browser back/forward.
  return <HistoryBrowser key={keys.map(key => params.get(`${key}_id`) ?? '').join('/')} title={t('history')} />;
}

function HistoryBrowser({ title }) {
  const { t } = useTranslation('admin');
  const [params, setParams] = useSearchParams();
  const selected = [];
  for (const key of keys) {
    const id = params.get(`${key}_id`);
    if (!id) break;
    selected.push({ key, id, label: params.get(`${key}_label`) || t(`historySelected.${key}`) });
  }
  const depth = selected.length;
  const level = levels[depth];
  const query = params.get('search') || '';
  const requestedPage = Number(params.get('page'));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const status = depth === 3 ? params.get('status') || '' : '';
  const issues = depth === 3 ? params.get('has_issues') || '' : '';
  const parent = selected.at(-1);
  const state = useApi(() => searchCatalog({ page, ...(query ? { search: query } : {}),
    ...(parent ? { [`${parent.key}_id`]: parent.id } : {}),
    ...(status ? { status } : {}), ...(issues ? { has_issues: issues } : {}),
  }), [parent?.key, parent?.id, page, query, status, issues]);
  const [instance, setInstance] = useState(null);
  const resultsRef = useRef(null);
  const context = (count = depth) => Object.fromEntries(selected.slice(0, count).flatMap(item => [[`${item.key}_id`, item.id], [`${item.key}_label`, item.label]]));
  const href = count => `/admin/history?${new URLSearchParams(context(count))}`;
  useEffect(() => {
    if (!state.loading && state.data && !state.error) resultsRef.current?.focus();
  }, [state.loading, state.data, state.error]);
  function change(extra) {
    setInstance(null);
    setParams({ ...context(), ...(query ? { search: query } : {}), ...(status ? { status } : {}), ...(issues ? { has_issues: issues } : {}), ...extra });
  }
  function open(row) {
    if (depth === 3) { setInstance(row); return; }
    setParams({ ...context(), [`${keys[depth]}_id`]: row.id, [`${keys[depth]}_label`]: row.label ?? row.name });
  }
  const view = { key: 'actions', header: t('actions'), render: row => <Button size="sm" onClick={() => open(row)} aria-label={t('historyViewNamed', { name: row.label ?? row.name ?? row.student_email ?? row.id })}>{t('historyView')}</Button> };
  const columns = depth === 0 ? [
    { key: 'label', header: t('label') },
    { key: 'is_active', header: t('status'), render: row => <Badge>{t(row.is_active ? 'current' : 'historyPrevious')}</Badge> },
    { key: 'subject_count', header: t('subjectCount') }, view,
  ] : depth === 1 ? [
    { key: 'code', header: t('historyCode') }, { key: 'name', header: t('historySubject') }, view,
  ] : depth === 2 ? [
    { key: 'name', header: t('historyExam') }, { key: 'date', header: t('historyDate'), render: row => row.date ? new Date(row.date).toLocaleString() : '—' },
    { key: 'model_count', header: t('historyModels') }, { key: 'instance_count', header: t('historyInstances') }, view,
  ] : [
    { key: 'student_email', header: t('historyStudent'), render: row => row.student_email || '—' },
    { key: 'model_label', header: t('historyModel'), render: row => row.model_label || '—' },
    { key: 'status', header: t('status'), render: row => t(`historyStatuses.${row.status}`, { defaultValue: row.status }) },
    { key: 'total_score', header: t('historyScore'), render: row => row.total_score ?? '—' },
    { key: 'has_issues', header: t('historyIssues'), render: row => t(row.has_issues ? 'historyWithIssues' : 'historyNoIssues') }, view,
  ];
  return <>
    <PageHeader title={title} eyebrow={t('historyReadOnly')} lede={t('historyHint')} crumbs={[
      { label: t('courses'), to: href(0) }, ...selected.map((item, index) => ({ label: item.label, to: href(index + 1) })),
      ...(depth ? [{ label: t(`historyLevels.${level}`) }] : []),
    ]} />
    <form className="admin-filters" onSubmit={event => {
      event.preventDefault();
      change({ search: new FormData(event.currentTarget).get('search').trim(), page: '1' });
    }}>
      <Field label={t('historySearch')}>{id => <Input key={query} id={id} name="search" defaultValue={query} />}</Field>
      {depth === 3 && <>
        <Field label={t('status')}>{id => <Select id={id} value={status} onChange={event => change({ status: event.target.value, page: '1' })} options={[
          { value: '', label: t('historyAllStatuses') }, ...statuses.map(value => ({ value, label: t(`historyStatuses.${value}`) })),
        ]} />}</Field>
        <Field label={t('historyIssues')}>{id => <Select id={id} value={issues} onChange={event => change({ has_issues: event.target.value, page: '1' })} options={[
          { value: '', label: t('historyAllInstances') }, { value: 'true', label: t('historyWithIssues') }, { value: 'false', label: t('historyNoIssues') },
        ]} />}</Field>
      </>}
      <Button type="submit">{t('common:search')}</Button>
    </form>
    <section ref={resultsRef} tabIndex={-1} aria-label={t(`historyLevels.${level}`)}>
      <Records focusError state={state} columns={columns} emptyTitle={t('historyEmpty')} emptyBody={t('historyEmptyHint')} />
    </section>
    <Pagination data={state.data} page={page} onChange={value => change({ page: String(value) })} />
    <Dialog open={Boolean(instance)} title={t('historyInstanceDetail')} onClose={() => setInstance(null)}>
      {instance && <>
        <p>{t('historyReadOnly')}</p>
        <KeyValue items={['id', 'student_email', 'model_label', 'status', 'total_score', 'has_issues', 'created_at', 'updated_at'].map(key => ({
          label: t(`historyFields.${key}`), value: key === 'has_issues' ? t(instance[key] ? 'historyWithIssues' : 'historyNoIssues')
            : key === 'status' ? t(`historyStatuses.${instance.status}`, { defaultValue: instance.status })
              : ['created_at', 'updated_at'].includes(key) && instance[key] ? new Date(instance[key]).toLocaleString() : instance[key] ?? '—',
        }))} />
      </>}
    </Dialog>
  </>;
}
