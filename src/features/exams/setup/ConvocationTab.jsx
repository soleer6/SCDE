import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAction, useApi } from '../../../lib/hooks.js';
import { Button, Checkbox, DataTable, EmptyState, ErrorState, Input, Loader, Panel, useToast } from '../../../ui';
import { listSubjectMembers, setConvocation } from '../api.js';

/** PUT /exams/{id}/convocation/ replaces the list; the backend rejects students
 *  without an active STUDENT membership or without a group. */
export default function ConvocationTab({ exam, onSaved }) {
  const { t } = useTranslation('exams');
  const { t: tc } = useTranslation();
  const toast = useToast();
  const students = useApi(() => listSubjectMembers(exam.subject_id, { role: 'STUDENT' }), [exam.subject_id]);
  const [selected, setSelected] = useState(() => new Set((exam.convocation ?? []).map((s) => s.id)));
  const [filter, setFilter] = useState('');
  const [result, setResult] = useState(null);
  const save = useAction(() => setConvocation(exam.id, [...selected]));

  const rows = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return (students.data ?? []).filter((m) => !f || `${m.user_name} ${m.user_email} ${m.group_label}`.toLowerCase().includes(f));
  }, [students.data, filter]);

  if (students.loading) return <Loader />;
  if (students.error) return <ErrorState error={students.error} onRetry={students.reload} />;
  if (!students.data.length) return <EmptyState title={t('setup.convocation.noStudents')} />;

  const toggle = (id) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const submit = async () => {
    try {
      const r = await save.run();
      setResult(r);
      toast.success(t('setup.convocation.saved', { valid: r.valid, total: r.total }));
      onSaved();
    } catch (e) {
      toast.error(tc(`errors.${e.code}`, { defaultValue: e.code }));
    }
  };

  return (
    <Panel
      title={t('setup.convocation.title', { count: selected.size })}
      flush
      actions={
        <>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set(students.data.map((m) => m.user_id)))}>
            {t('setup.convocation.all')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            {t('setup.convocation.none')}
          </Button>
          <Button size="sm" variant="solid" onClick={submit} loading={save.pending}>
            {t('setup.convocation.save')}
          </Button>
        </>
      }
    >
      <div className="setup-pad">
        <Input aria-label={tc('search')} placeholder={t('setup.convocation.search')} value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>
      {result?.invalid?.length > 0 && (
        <div className="setup-pad u-rust" role="alert">
          {t('setup.convocation.invalid', { count: result.invalid.length })}
          <ul>
            {result.invalid.map((x) => (
              <li key={x.user_id}>
                {students.data.find((m) => m.user_id === x.user_id)?.user_email ?? x.user_id} · {t(`setup.convocation.reasons.${x.reason}`, { defaultValue: x.reason })}
              </li>
            ))}
          </ul>
        </div>
      )}
      <DataTable
        caption={t('setup.convocation.title', { count: selected.size })}
        rowKey="user_id"
        rows={rows}
        onRowClick={(m) => toggle(m.user_id)}
        columns={[
          { key: 'pick', header: '', width: '40px', render: (m) => <Checkbox label="" checked={selected.has(m.user_id)} onChange={() => toggle(m.user_id)} onClick={(e) => e.stopPropagation()} aria-label={m.user_email} /> },
          { key: 'user_name', header: t('setup.convocation.student') },
          { key: 'user_email', header: 'Email', render: (m) => <span className="u-muted">{m.user_email}</span> },
          { key: 'group_label', header: t('setup.convocation.group'), render: (m) => m.group_label || <span className="u-rust">{t('setup.convocation.noGroup')}</span> },
        ]}
      />
    </Panel>
  );
}
