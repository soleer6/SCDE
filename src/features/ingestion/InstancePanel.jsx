import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAction, useApi } from '../../lib/hooks.js';
import { formatDateTime } from '../../lib/format.js';
import { Badge, Button, DataTable, Dialog, ErrorState, Field, KeyValue, Loader, Panel, Select, useToast } from '../../ui';
import { StatusBadge } from '../workspace/domain.jsx';
import { studentName } from '../workspace/model.js';
import { acceptPage, attachOrphan, deleteInstance, discardPage, getInstancePages, movePage, reorderPages, updateInstance } from './api.js';
import IssueList from './IssueList.jsx';
import { PAGE_TONE, useErrorText } from './model.js';

/** Selected instance: identity (student/model), its scanned pages and page actions. */
export default function InstancePanel({ exam, instance, instances, orphans, canDelete, onChanged, onDeleted }) {
  const { t } = useTranslation('ingestion');
  const toast = useToast();
  const errText = useErrorText();
  const pages = useApi(() => getInstancePages(instance.id), [instance.id, instance.updated_at]);
  const [moving, setMoving] = useState(null);
  const [confirm, setConfirm] = useState(null); // { kind: 'discard', page } | { kind: 'delete' }

  const act = async (fn, done) => {
    try {
      await fn();
      toast.success(done);
      pages.reload();
      onChanged();
    } catch (e) {
      toast.error(errText(e));
    }
  };

  const list = pages.data ?? [];
  const swap = (index, dir) => {
    const ids = list.map((p) => p.id);
    [ids[index], ids[index + dir]] = [ids[index + dir], ids[index]];
    act(() => reorderPages(instance.id, ids), t('pages.reordered'));
  };

  return (
    <>
      <Panel title={instance.student_email ? studentName(instance.student_email) : t('instance.unidentified')}>
        <KeyValue
          items={[
            { label: t('cols.status'), value: <StatusBadge status={instance.status} /> },
            { label: t('cols.issues'), value: <IssueList instance={instance} /> },
            { label: t('instance.expected'), value: instance.expected_pages },
          ]}
        />
        <IdentityForm exam={exam} instance={instance} onSaved={onChanged} />
      </Panel>

      <Panel title={t('pages.title')} flush>
        {pages.loading && !pages.data ? (
          <Loader />
        ) : pages.error ? (
          <ErrorState error={pages.error} onRetry={pages.reload} />
        ) : (
          <DataTable
            caption={t('pages.caption')}
            rows={list}
            empty={<p className="u-muted in-pad">{t('pages.empty')}</p>}
            columns={[
              { key: 'n', header: t('pages.cols.number'), align: 'num', render: (p) => p.page_number },
              {
                key: 'state',
                header: t('pages.cols.state'),
                render: (p) => (
                  <span className="in-badges">
                    <Badge tone={PAGE_TONE[p.status]}>{t(`pageStatus.${p.status}`, { defaultValue: p.status })}</Badge>
                    {p.issue_type && <Badge tone="gold">{t(`issueTypes.${p.issue_type}`, { defaultValue: p.issue_type })}</Badge>}
                  </span>
                ),
              },
              {
                key: 'actions',
                header: <span className="u-sr-only">{t('pages.cols.actions')}</span>,
                render: (p) => {
                  const i = list.indexOf(p);
                  return p.status === 'DISCARDED' ? null : (
                    <span className="in-actions">
                      <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => swap(i, -1)} aria-label={t('pages.up', { n: p.page_number })}>
                        ↑
                      </Button>
                      <Button size="sm" variant="ghost" disabled={i === list.length - 1} onClick={() => swap(i, 1)} aria-label={t('pages.down', { n: p.page_number })}>
                        ↓
                      </Button>
                      {p.issue_type === 'EXTRA_PAGE' && (
                        <Button size="sm" variant="primary" onClick={() => act(() => acceptPage(instance.id, p.id), t('pages.accepted'))}>
                          {t('pages.accept')}
                        </Button>
                      )}
                      <Button size="sm" onClick={() => setMoving(p)}>
                        {t('pages.move')}
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setConfirm({ kind: 'discard', page: p })}>
                        {t('pages.discard')}
                      </Button>
                    </span>
                  );
                },
              },
            ]}
          />
        )}
      </Panel>

      {orphans && (
        <Panel title={t('orphans.title')} flush>
          <DataTable
            caption={t('orphans.caption')}
            rows={orphans}
            empty={<p className="u-muted in-pad">{t('orphans.empty')}</p>}
            columns={[
              { key: 'ref', header: t('orphans.cols.file'), render: (p) => <code className="in-code">{p.storage_ref.split('/').pop()}</code> },
              {
                key: 'state',
                header: t('pages.cols.state'),
                render: (p) => <Badge tone={PAGE_TONE[p.status]}>{t(`issueTypes.${p.issue_type}`, { defaultValue: t(`pageStatus.${p.status}`, { defaultValue: p.status }) })}</Badge>,
              },
              {
                key: 'attach',
                header: <span className="u-sr-only">{t('pages.cols.actions')}</span>,
                render: (p) => (
                  <Button size="sm" variant="primary" onClick={() => act(() => attachOrphan(instance.id, p.id), t('orphans.attached'))}>
                    {t('orphans.attach')}
                  </Button>
                ),
              },
            ]}
          />
        </Panel>
      )}

      {canDelete && (
        <Button variant="danger" onClick={() => setConfirm({ kind: 'delete' })}>
          {t('instance.delete')}
        </Button>
      )}

      <MoveDialog
        page={moving}
        instance={instance}
        targets={instances.filter((i) => i.id !== instance.id)}
        onClose={() => setMoving(null)}
        onMove={(targetId) => {
          const p = moving;
          setMoving(null);
          act(() => movePage(instance.id, p.id, targetId), t('pages.moved'));
        }}
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.kind === 'delete' ? t('instance.deleteTitle') : t('pages.discardTitle', { n: confirm?.page?.page_number })}
        body={confirm?.kind === 'delete' ? t('instance.deleteBody') : t('pages.discardBody')}
        action={confirm?.kind === 'delete' ? t('instance.delete') : t('pages.discard')}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          const c = confirm;
          setConfirm(null);
          if (c.kind === 'discard') return act(() => discardPage(instance.id, c.page.id), t('pages.discarded'));
          try {
            await deleteInstance(instance.id);
            toast.success(t('instance.deleted'));
            onDeleted();
          } catch (e) {
            toast.error(errText(e));
          }
          return undefined;
        }}
      />
    </>
  );
}

/** PATCH /instances/{id}/ { student_id?, model_id? }: identifies the student (clears STUDENT_NOT_IDENTIFIED). */
function IdentityForm({ exam, instance, onSaved }) {
  const { t } = useTranslation('ingestion');
  const toast = useToast();
  const errText = useErrorText();
  const [studentId, setStudentId] = useState(instance.student_id ?? '');
  const [modelId, setModelId] = useState(instance.model_id ?? '');
  const body = {
    ...(studentId && studentId !== instance.student_id && { student_id: studentId }),
    ...(modelId && modelId !== instance.model_id && { model_id: modelId }),
  };
  const save = useAction(() => updateInstance(instance.id, body));
  const dirty = Object.keys(body).length > 0;

  const submit = async (e) => {
    e.preventDefault();
    try {
      await save.run();
      toast.success(t('instance.saved'));
      onSaved();
    } catch {
      /* shown below */
    }
  };

  return (
    <form className="in-identity" onSubmit={submit}>
      <Field label={t('instance.student')} error={save.error ? errText(save.error) : undefined}>
        {(id, aria) => (
          <Select id={id} {...aria} value={studentId} onChange={(e) => setStudentId(e.target.value)}>
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
      <Button type="submit" variant="solid" disabled={!dirty} loading={save.pending}>
        {t('instance.save')}
      </Button>
      <p className="u-muted in-note">{t('instance.updatedAt', { date: formatDateTime(instance.updated_at) })}</p>
    </form>
  );
}

/** POST /instances/{id}/pages/{pid}/move/ — only within the same exam (409 DIFFERENT_EXAM). */
function MoveDialog({ page, instance, targets, onClose, onMove }) {
  const { t } = useTranslation('ingestion');
  const { t: tc } = useTranslation();
  const [target, setTarget] = useState('');
  return (
    <Dialog
      open={Boolean(page)}
      onClose={onClose}
      title={t('move.title', { n: page?.page_number })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button variant="solid" disabled={!target} onClick={() => onMove(target)}>
            {t('pages.move')}
          </Button>
        </>
      }
    >
      <p className="u-muted">{t('move.body', { from: instance.student_email ? studentName(instance.student_email) : t('instance.unidentified') })}</p>
      <Field label={t('move.target')}>
        {(id) => (
          <Select id={id} value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">{t('move.choose')}</option>
            {targets.map((i) => (
              <option key={i.id} value={i.id}>
                {i.student_email ? `${studentName(i.student_email)} · ${i.student_email}` : `${t('instance.unidentified')} · ${i.id.slice(0, 8)}`}
              </option>
            ))}
          </Select>
        )}
      </Field>
    </Dialog>
  );
}

function ConfirmDialog({ open, title, body, action, onClose, onConfirm }) {
  const { t: tc } = useTranslation();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {action}
          </Button>
        </>
      }
    >
      <p>{body}</p>
    </Dialog>
  );
}
