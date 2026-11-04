import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ErrorState, Field, Input, Stats } from '../../ui';
import { downloadBlob } from './download.js';

export default function ImportForm({ hint, onImport, onComplete, onPendingChange }) {
  const { t } = useTranslation('admin');
  const descriptionId = useId();
  const formRef = useRef(null);
  const errorRef = useRef(null);
  const resultRef = useRef(null);
  const importingRef = useRef(false);
  const [file, setFile] = useState(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fieldCode = error?.fieldCode?.('file');
  const fieldError = fieldCode ? t(`common:errors.${fieldCode}`, { defaultValue: t('invalid') }) : undefined;
  useEffect(() => {
    if (result && !pending) resultRef.current?.focus();
  }, [result, pending]);
  useEffect(() => {
    if (error && !pending) {
      const target = fieldError ? formRef.current?.querySelector('input[type="file"]') : errorRef.current;
      target?.focus();
    }
  }, [error, fieldError, pending]);
  return <form ref={formRef} className="admin-form" aria-busy={pending || undefined} onSubmit={async (event) => {
    event.preventDefault();
    if (!file || importingRef.current || result) return;
    importingRef.current = true;
    onPendingChange?.(true);
    setPending(true); setError(null); setResult(null);
    try {
      const form = new FormData(); form.append('file', file);
      const response = await onImport(form);
      setResult(response); onComplete?.();
    } catch (err) { setError(err); } finally { importingRef.current = false; onPendingChange?.(false); setPending(false); }
  }}>
    <Field label={t('importFile')} hint={hint ? <span id={`${descriptionId}-hint`}>{hint}</span> : undefined} error={fieldError ? <span id={`${descriptionId}-error`}>{fieldError}</span> : undefined}>{(id) => <Input id={id} type="file" accept=".csv,.json,text/csv,application/json" aria-invalid={fieldError ? true : undefined} aria-describedby={fieldError ? `${descriptionId}-error` : hint ? `${descriptionId}-hint` : undefined} disabled={pending} required onChange={(event) => { setFile(event.target.files?.[0] ?? null); setResult(null); setError(null); }} />}</Field>
    <Button type="submit" variant="solid" loading={pending} disabled={!file || Boolean(result)}>{t('importSubmit')}</Button>
    {error && <div ref={errorRef} tabIndex={-1}><ErrorState error={error} /></div>}
    {result && <div ref={resultRef} className="admin-stack" role="status" aria-label={t('importDone')} tabIndex={-1}>
      <p>{t('importDone')}</p>
      <Stats items={['created', 'reactivated', 'updated', 'total_processed', 'total_errors'].filter((key) => key in result).map((key) => ({ label: t(`importCounts.${key}`), value: result[key], tone: key === 'total_errors' && result[key] ? 'rust' : undefined }))} />
      {result.errors?.length > 0 && <><p>{t('importErrorsHint')}</p><Button onClick={() => downloadBlob(new Blob([JSON.stringify(result.errors, null, 2)], { type: 'application/json' }), 'import-errors.json')}>{t('downloadErrors')}</Button></>}
    </div>}
  </form>;
}
