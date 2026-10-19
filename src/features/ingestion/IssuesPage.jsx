import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../lib/auth/AuthProvider.jsx';
import { useAction, useApi } from '../../lib/hooks.js';
import { formatDate } from '../../lib/format.js';
import { can } from '../../lib/permissions.js';
import {
  Badge, Button, ButtonLink, DataTable, Dialog, EmptyState, ErrorState, Field, Loader, PageHeader, Panel, Select, Tabs, useToast,
} from '../../ui';
import { StatusBadge } from '../workspace/domain.jsx';
import { studentName } from '../workspace/model.js';
import { useMySubjects } from '../workspace/api.js';
import { getAllExamInstances, getExam } from '../exams/api.js';
import { createInstance, getOrphanPages } from './api.js';
import InstancePanel from './InstancePanel.jsx';
import IssueList from './IssueList.jsx';
import { useErrorText } from './model.js';
import './ingestion.css';

const needsAttention = (i) => i.has_issues || i.status === 'ASSEMBLING';

/** /exams/:examId/issues — scan incidents of one exam (RF-7.2, RF-7.10, RF-7.14). */
export default function IssuesPage() {
  const { examId } = useParams();
  const { t } = useTranslation('ingestion');
  const { session } = useAuth();
  const exam = useApi(() => getExam(examId), [examId]);
  const { roleOf, loading } = useMySubjects();

  if (exam.initialLoading || loading) return <Loader page />;
  if (exam.error) return <ErrorState error={exam.error} onRetry={exam.reload} />;
  const e = exam.data;
  const role = roleOf(e.subject_id);
  if (!can(session, role, 'can_resolve_issues')) {
    return <EmptyState title={t('issues.denied')} body={t('issues.deniedBody')} action={<ButtonLink to={`/exams/${e.id}`}>{t('issues.back')}</ButtonLink>} />;
  }
  return <IssuesView exam={e} role={role} />;
}

function IssuesView({ exam, role }) {
  const { t } = useTranslation('ingestion');
  const { session } = useAuth();
  const toast = useToast();
  const [filter, setFilter] = useState('issues');
  const [selectedId, setSelectedId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const isManager = Boolean(session?.isStaff || session?.isSuperadmin);

  const instances = useApi(() => getAllExamInstances(exam.id), [exam.id]);
  const orphans = useApi(isManager ? () => getOrphanPages() : null, [isManager]);

  const list = useMemo(() => instances.data ?? [], [instances.data]);
  const pending = list.filter(needsAttention);
  const rows = filter === 'issues' ? pending : list;
  const selected = list.find((i) => i.id === selectedId) ?? null;

  const refresh = () => {
    instances.reload();
    if (isManager) orphans.reload();
  };

  return (
    <>
      <PageHeader
        crumbs={[
          { label: t('crumbs.subjects'), to: '/subjects' },
          { label: exam.subject_code, to: `/subjects/${exam.subject_id}` },
          { label: exam.name, to: `/exams/${exam.id}` },
          { label: t('issues.crumb') },
        ]}
        eyebrow={`${exam.subject_code} · ${exam.subject_name}${exam.date ? ` · ${formatDate(exam.date)}` : ''}`}
        title={t('issues.title')}
        lede={t('issues.lede')}
        actions={
          <>
            <ButtonLink to={`/exams/${exam.id}`}>{t('issues.back')}</ButtonLink>
            {isManager && (
              <Button variant="primary" onClick={() => setCreateOpen(true)}>
                {t('create.action')}
              </Button>
            )}
          </>
        }
      />

      <div className="dm-split in-body">
        <section className="dm-section" aria-busy={instances.loading}>
          <Tabs
            label={t('issues.filterLabel')}
            value={filter}
            onChange={setFilter}
            tabs={[
              { value: 'issues', label: t('issues.filters.issues'), count: pending.length },
              { value: 'all', label: t('issues.filters.all'), count: list.length },
            ]}
          />
          {/* Refreshes after an action keep the table mounted (rows, focus, scroll). */}
          {instances.initialLoading ? (
            <Loader />
          ) : instances.error ? (
            <ErrorState error={instances.error} onRetry={instances.reload} />
          ) : (
            <DataTable
              caption={t('issues.caption')}
              rows={rows}
              onRowClick={(i) => setSelectedId(i.id)}
              empty={<EmptyState title={t(filter === 'issues' ? 'issues.emptyTitle' : 'issues.emptyAll')} body={filter === 'issues' ? t('issues.emptyBody') : undefined} />}
              columns={[
                {
                  key: 'student',
                  header: t('cols.student'),
                  render: (i) => (
                    <span className={i.id === selectedId ? 'in-current' : undefined} aria-current={i.id === selectedId ? 'true' : undefined}>
                      {i.student_email ? studentName(i.student_email) : <Badge tone="rust">{t('instance.unidentified')}</Badge>}
                    </span>
                  ),
                },
                { key: 'issues', header: t('cols.issues'), render: (i) => <IssueList instance={i} /> },
                { key: 'status', header: t('cols.status'), render: (i) => <StatusBadge status={i.status} /> },
              ]}
            />
          )}
        </section>

        <aside className="ui-stack">
          {selected ? (
            <InstancePanel
              key={selected.id}
              exam={exam}
              instance={selected}
              instances={list}
              orphans={isManager ? orphans.data ?? [] : null}
              canDelete={can(session, role, 'can_view_all_instances')}
              onChanged={refresh}
              onDeleted={() => {
                setSelectedId(null);
                refresh();
              }}
            />
          ) : (
            <Panel title={t('instance.noneTitle')}>
              <p className="u-muted">{t('instance.noneBody')}</p>
            </Panel>
          )}
          {isManager && !selected && (
            <Panel title={t('orphans.title')}>
              {orphans.initialLoading ? (
                <Loader />
              ) : orphans.error ? (
                <ErrorState error={orphans.error} onRetry={orphans.reload} />
              ) : (
                <p className="u-muted">{t('orphans.summary', { count: orphans.data.length })}</p>
              )}
            </Panel>
          )}
        </aside>
      </div>

      {isManager && (
        <CreateInstanceDialog
          open={createOpen}
          exam={exam}
          onClose={() => setCreateOpen(false)}
          onCreated={(inst) => {
            setCreateOpen(false);
            toast.success(t('create.done'));
            setFilter('all');
            setSelectedId(inst.id);
            instances.reload();
          }}
        />
      )}
    </>
  );
}

/** POST /exams/{id}/instances/create/ — manager only; student and model are optional. */
function CreateInstanceDialog({ open, exam, onClose, onCreated }) {
  const { t } = useTranslation('ingestion');
  const { t: tc } = useTranslation();
  const errText = useErrorText();
  const [studentId, setStudentId] = useState('');
  const [modelId, setModelId] = useState('');
  const action = useAction(() =>
    createInstance(exam.id, { ...(studentId && { student_id: studentId }), ...(modelId && { model_id: modelId }) }),
  );

  const submit = async () => {
    try {
      onCreated(await action.run());
    } catch {
      /* shown below */
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('create.title')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button variant="solid" onClick={submit} loading={action.pending}>
            {t('create.submit')}
          </Button>
        </>
      }
    >
      <p className="u-muted">{t('create.body')}</p>
      <Field label={t('instance.student')}>
        {(id) => (
          <Select id={id} value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">{t('instance.noStudent')}</option>
            {(exam.convocation ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {`${s.first_name} ${s.last_name} · ${s.email}`}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label={t('instance.model')}>
        {(id) => (
          <Select id={id} value={modelId} onChange={(e) => setModelId(e.target.value)}>
            <option value="">{t('instance.noModel')}</option>
            {(exam.models_problems ?? []).map((m) => (
              <option key={m.model_id} value={m.model_id}>
                {t('instance.modelLabel', { label: m.label })}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {action.error && (
        <p className="u-rust" role="alert">
          {errText(action.error)}
        </p>
      )}
    </Dialog>
  );
}
