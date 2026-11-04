import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorState, Loader, PageHeader } from '../../ui';
import { ApiError } from '../../lib/api/errors.js';
import { useApi } from '../../lib/hooks.js';
import { getConfig, updateConfig } from './api.js';
import { RecordForm } from './components.jsx';

const numbers = ['recognition_confidence_threshold', 'assembly_timeout_seconds', 'max_audio_duration_minutes', 'max_page_size_mb', 'auto_delete_frequency_days', 'delete_notice_days', 'temp_url_expiration_minutes'];
const json = ['role_permission_defaults', 'grade_export_columns'];
const fields = ['default_ocr_engine', ...numbers, 'default_language', ...json];
export default function ConfigPage() {
  const { t } = useTranslation('admin');
  const state = useApi(getConfig);
  const pageRef = useRef(null);
  const errorRef = useRef(null);
  const recovering = useRef(false);
  useEffect(() => {
    if (state.loading) return;
    if (state.error) {
      recovering.current = true;
      errorRef.current?.focus();
    } else if (state.data && recovering.current) {
      pageRef.current?.querySelector('input, textarea')?.focus();
      recovering.current = false;
    }
  }, [state.loading, state.error, state.data]);
  return <div ref={pageRef}>
    <PageHeader eyebrow={t('management')} title={t('config')} />
    {state.loading ? <Loader /> : state.error ? <div ref={errorRef} tabIndex={-1}><ErrorState error={state.error} onRetry={state.reload} /></div> : state.data && <RecordForm
      focusOnSaved
      initial={Object.fromEntries(fields.filter((k) => k in state.data).map((k) => [k, json.includes(k) ? JSON.stringify(state.data[k], null, 2) : state.data[k]]))}
      fields={fields.filter((name) => name in state.data).map((name) => ({ name, label: t(name), type: numbers.includes(name) ? 'number' : json.includes(name) ? 'json' : 'text', ...(numbers.includes(name) ? { required: true, min: 0, step: name === numbers[0] ? '0.01' : '1', ...(name === numbers[0] ? { max: 1 } : {}) } : {}) }))}
      onSave={async (values) => {
        const body = { ...values };
        for (const key of json) if (key in body) {
          try { body[key] = JSON.parse(body[key]); } catch { throw new ApiError('VALIDATION_ERROR', 400, { [key]: ['INVALID'] }); }
        }
        await updateConfig(body);
      }} />}
  </div>;
}
