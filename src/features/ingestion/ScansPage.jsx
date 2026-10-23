import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAction, useApi } from '../../lib/hooks.js';
import { formatDateTime } from '../../lib/format.js';
import { Badge, Button, DataTable, EmptyState, ErrorState, Field, Input, KeyValue, Loader, PageHeader, Panel, useToast } from '../../ui';
import { getOcrEngines, getOrphanPages, ingestFile } from './api.js';
import { PAGE_TONE, useErrorText } from './model.js';
import './ingestion.css';
import PageThumb from './PageThumb.jsx';

/** /scans — manager tools: manual ingest (RF-9.2), OCR engines (RF-9.9), orphan pages (RF-7.14). */
export default function ScansPage() {
  const { t } = useTranslation('ingestion');
  const toast = useToast();
  const errText = useErrorText();
  const [file, setFile] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const engines = useApi(() => getOcrEngines(), []);
  const orphans = useApi(() => getOrphanPages(), []);
  const upload = useAction(() => ingestFile(file));

  const submit = async (e) => {
    e.preventDefault();
    try {
      const r = await upload.run();
      setReceipt(r);
      setFile(null);
      e.target.reset();
      toast.success(t('scans.uploaded', { count: r.total_pages }));
      orphans.reload();
    } catch {
      /* shown in the field */
    }
  };

  return (
    <>
      <PageHeader eyebrow={t('scans.eyebrow')} title={t('scans.title')} lede={t('scans.lede')} />

      <div className="dm-split in-body">
        <section className="ui-stack">
          <Panel title={t('scans.uploadTitle')}>
            <form className="in-upload" onSubmit={submit}>
              <Field label={t('scans.file')} hint={t('scans.fileHint')} error={upload.error ? errText(upload.error) : undefined}>
                {(id, aria) => (
                  <Input id={id} {...aria} type="file" accept="application/pdf,image/png,image/jpeg,image/tiff" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                )}
              </Field>
              <Button type="submit" variant="solid" disabled={!file} loading={upload.pending}>
                {t('scans.upload')}
              </Button>
            </form>
            {receipt && (
              <div className="in-receipt" aria-live="polite">
                <KeyValue
                  items={[
                    { label: t('scans.receipt.file'), value: receipt.filename },
                    { label: t('scans.receipt.pages'), value: receipt.total_pages },
                    { label: t('scans.receipt.status'), value: <Badge tone="steel">{t(`scans.receipt.${receipt.status}`, { defaultValue: receipt.status })}</Badge> },
                    { label: t('scans.receipt.task'), value: <code className="in-code">{receipt.task_id}</code> },
                  ]}
                />
                <p className="u-muted in-note">{t('scans.receipt.next')}</p>
              </div>
            )}
          </Panel>

          <Panel title={t('orphans.title')} flush>
            {orphans.initialLoading ? (
              <Loader />
            ) : orphans.error ? (
              <ErrorState error={orphans.error} onRetry={orphans.reload} />
            ) : (
              <DataTable
                caption={t('orphans.caption')}
                rows={orphans.data}
                empty={<EmptyState title={t('orphans.emptyTitle')} body={t('orphans.emptyBody')} />}
                columns={[
                  { key: 'scan', header: t('pages.cols.scan'), render: (p) => <PageThumb page={p} label={p.storage_ref.split('/').pop()} /> },
                  { key: 'ref', header: t('orphans.cols.file'), render: (p) => <code className="in-code">{p.storage_ref.split('/').pop()}</code> },
                  { key: 'status', header: t('pages.cols.state'), render: (p) => <Badge tone={PAGE_TONE[p.status]}>{t(`pageStatus.${p.status}`, { defaultValue: p.status })}</Badge> },
                  { key: 'issue', header: t('cols.issues'), render: (p) => (p.issue_type ? t(`issueTypes.${p.issue_type}`, { defaultValue: p.issue_type }) : '—') },
                  { key: 'at', header: t('orphans.cols.received'), render: (p) => formatDateTime(p.created_at) },
                ]}
              />
            )}
          </Panel>
          {orphans.data?.length > 0 && <p className="u-muted in-note">{t('orphans.howTo')}</p>}
        </section>

        <aside className="ui-stack">
          <Panel title={t('engines.title')}>
            {engines.loading ? (
              <Loader />
            ) : engines.error ? (
              <ErrorState error={engines.error} onRetry={engines.reload} />
            ) : engines.data.length ? (
              <ul className="in-engines">
                {engines.data.map((e) => (
                  <li key={e.engine_id}>
                    <code className="in-code">{e.engine_id}</code>
                    <span className="u-muted">{t(`engines.types.${e.type}`, { defaultValue: e.type })}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="u-muted">{t('engines.empty')}</p>
            )}
            <p className="u-muted in-note">{t('engines.note')}</p>
          </Panel>
        </aside>
      </div>
    </>
  );
}
