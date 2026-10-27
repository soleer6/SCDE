import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ErrorState } from '../../ui';
import { formatScore } from '../../lib/format.js';
import { listAnnotations } from './api.js';
import { useAnnotationRead } from './useAnnotationRead.js';
import { recognizeExistingGrade } from './ocr.js';

/** Recognize an existing record without creating, rewriting or deleting its ink. */
export default function SavedGradeOcr(props) {
  return <SavedGradeSession key={`${props.instanceId}:${props.problem.id}:${props.currentUserId}`} {...props} />;
}

function SavedGradeSession({ instanceId, problem, currentUserId, onApplied, onUse }) {
  const { t } = useTranslation('grading');
  const notes = useAnnotationRead(async () => (await listAnnotations(instanceId)).filter((a) =>
    a.author_id === currentUserId && a.problem_id === problem.id && ['TEXT', 'STYLUS'].includes(a.annotation_type)),
  `${instanceId}:${problem.id}:${currentUserId}`);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const run = async (id) => {
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      const value = await recognizeExistingGrade(id);
      // Keep autoApplied true even if refreshing fails: never offer a second save.
      setResult(value);
      if (value.autoApplied) {
        try { await onApplied(); } catch { setError('refreshFailed'); }
      }
    } catch (e) {
      setError(e.code);
      if (e.status === 403 || e.status === 404) notes.reload();
    } finally { setBusy(false); }
  };
  if (notes.error) return <ErrorState error={notes.error} onRetry={notes.reload} />;
  if (notes.loading) return null;
  return <div className="gr-ocr">
    {(notes.data ?? []).map((a, i) => <Button key={a.id} size="sm" variant="ghost" disabled={busy} onClick={() => run(a.id)}>
      {t('ocr.recognizeExisting')} {i + 1}
    </Button>)}
    {result && <p role="status" className="gr-ocr__result">
      {result.score === null ? t('ocr.gradeUnreadable') : t('ocr.gradeRead', { score: formatScore(result.score), pct: Math.round(result.confidence * 100) })}
      {result.autoApplied ? <span>{t('ocr.gradeApplied')}</span> : <>
        {result.applyErrorCode && <span>{t(`ocr.errors.${result.applyErrorCode}`)}</span>}
        {result.score !== null && <Button size="sm" disabled={busy} onClick={() => onUse(result.score)}>{t('ocr.gradeUse')}</Button>}
      </>}
    </p>}
    {error && <p role="alert">{t(error === 'refreshFailed' ? 'ocr.refreshFailed' : `ocr.errors.${error}`, { defaultValue: error })}</p>}
  </div>;
}
