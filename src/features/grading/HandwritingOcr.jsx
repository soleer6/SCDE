import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatScore } from '../../lib/format.js';
import { Button } from '../../ui';
import HandwritingPad from './HandwritingPad.jsx';
import { recognizeGrade, transcribeHandwriting } from './ocr.js';

const pctOf = (c) => Math.round(Number(c ?? 0) * 100);

function useOcrError() {
  const { t } = useTranslation('grading');
  const { t: tc } = useTranslation();
  return (code) => t(`ocr.errors.${code}`, { defaultValue: tc(`errors.${code}`, { defaultValue: code }) });
}

/**
 * Handwritten grade for a manual-score problem (RF-9.12). Above the server's
 * confidence threshold the backend applies the grade itself (auto_applied);
 * otherwise the reading is offered and the teacher confirms it.
 */
export function GradeOcr({ instanceId, problem, onApplied, onUse }) {
  const { t } = useTranslation('grading');
  const errorText = useOcrError();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const recognize = async (strokes) => {
    setBusy(true);
    setResult(null);
    try {
      const r = await recognizeGrade(instanceId, problem.id, strokes);
      if (r.autoApplied && r.score !== null) onApplied(r.score);
      setResult(r);
      return true;
    } catch (e) {
      setResult({ error: e.code });
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="gr-ocr">
        <Button size="sm" variant="ghost" className="gr-ocr__toggle" onClick={() => setOpen(true)}>
          {t('ocr.gradeOpen')}
        </Button>
      </div>
    );
  }

  return (
    <div className="gr-ocr">
      <HandwritingPad
        label={t('ocr.gradePad', { name: problem.name })}
        submitLabel={t('ocr.gradeSubmit')}
        busy={busy}
        onSubmit={recognize}
        onCancel={() => {
          setOpen(false);
          setResult(null);
        }}
      />
      {result && (
        <p className="gr-ocr__result" role="status">
          {result.error ? (
            <span className="u-rust">{errorText(result.error)}</span>
          ) : result.score === null ? (
            <span className="u-muted">{result.raw ? t('ocr.gradeUnreadableRaw', { raw: result.raw }) : t('ocr.gradeUnreadable')}</span>
          ) : (
            <>
              <span>{t('ocr.gradeRead', { score: formatScore(result.score), pct: pctOf(result.confidence) })}</span>
              {result.autoApplied ? (
                <span className="u-green">{t('ocr.gradeApplied')}</span>
              ) : (
                <Button size="sm" onClick={() => onUse(result.score)}>
                  {t('ocr.gradeUse')}
                </Button>
              )}
            </>
          )}
        </p>
      )}
    </div>
  );
}

/** Handwriting -> text appended to the general comment (RF-9.13). */
export function CommentOcr({ instanceId, onText }) {
  const { t } = useTranslation('grading');
  const errorText = useOcrError();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const transcribe = async (strokes) => {
    setBusy(true);
    setResult(null);
    try {
      const r = await transcribeHandwriting(instanceId, strokes);
      if (r.text) onText(r.text);
      setResult(r);
      return Boolean(r.text);
    } catch (e) {
      setResult({ error: e.code });
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button size="sm" variant="ghost" className="gr-ocr__toggle" onClick={() => setOpen(true)}>
        {t('ocr.commentOpen')}
      </Button>
    );
  }

  return (
    <div className="gr-pad">
      <HandwritingPad
        label={t('ocr.commentPad')}
        submitLabel={t('ocr.commentSubmit')}
        busy={busy}
        onSubmit={transcribe}
        onCancel={() => {
          setOpen(false);
          setResult(null);
        }}
      />
      {result && (
        <p className="gr-ocr__result" role="status">
          {result.error ? (
            <span className="u-rust">{errorText(result.error)}</span>
          ) : result.text ? (
            <span className="u-green">{t('ocr.commentAdded', { pct: pctOf(result.confidence) })}</span>
          ) : (
            <span className="u-muted">{t('ocr.commentUnreadable')}</span>
          )}
        </p>
      )}
    </div>
  );
}
