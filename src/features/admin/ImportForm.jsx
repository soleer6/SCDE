import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ErrorState, Field, Input, Stats } from '../../ui';
import { downloadBlob } from './download.js';

export default function ImportForm({ hint, onImport, onComplete }) {
  const { t } = useTranslation('admin');
  const [file, setFile] = useState(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fieldCode = error?.fieldCode?.('file');
  return <form className="admin-form" onSubmit={async (event) => {
    event.preventDefault();
    if (!file || pending) return;
    setPending(true); setError(null); setResult(null);
    try {
      const form = new FormData(); form.append('file', file);
      const response = await onImport(form);
      setResult(response); onComplete?.();
    } catch (err) { setError(err); } finally { setPending(false); }
  }}>
    <Field label={t('importFile')} hint={hint} error={fieldCode ? t(`common:errors.${fieldCode}`, { defaultValue: t('invalid') }) : undefined}>{(id) => <Input id={id} type="file" accept=".csv,.json,text/csv,application/json" disabled={pending} required onChange={(event) => { setFile(event.target.files?.[0] ?? null); setResult(null); setError(null); }} />}</Field>
    <Button type="submit" variant="solid" loading={pending} disabled={!file || Boolean(result)}>{t('importSubmit')}</Button>
    {error && <ErrorState error={error} />}
    {result && <div className="admin-stack" role="status">
      <p>{t('importDone')}</p>
      <Stats items={['created', 'reactivated', 'updated', 'total_processed', 'total_errors'].filter((key) => key in result).map((key) => ({ label: t(`importCounts.${key}`), value: result[key], tone: key === 'total_errors' && result[key] ? 'rust' : undefined }))} />
      {result.errors?.length > 0 && <><p>{t('importErrorsHint')}</p><Button onClick={() => downloadBlob(new Blob([JSON.stringify(result.errors, null, 2)], { type: 'application/json' }), 'import-errors.json')}>{t('downloadErrors')}</Button></>}
    </div>}
  </form>;
}
