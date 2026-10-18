import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui';
import InkCanvas from './InkCanvas.jsx';

const readInk = () => getComputedStyle(document.documentElement).getPropertyValue('--ink-black').trim();

/**
 * Small 2:1 writing area (the backend renders pads at 400x200 before OCR).
 * Strokes stay local until onSubmit(strokes) resolves; the pad clears on success.
 */
export default function HandwritingPad({ label, submitLabel, busy, onSubmit, onCancel }) {
  const { t } = useTranslation('grading');
  const [strokes, setStrokes] = useState([]);
  const [color] = useState(readInk);

  const submit = async () => {
    if (await onSubmit(strokes)) setStrokes([]);
  };

  return (
    <div className="gr-pad" role="group" aria-label={label}>
      <div className="gr-pad__area">
        <InkCanvas strokes={strokes} tool="pen" color={color} width={0.012} onStroke={(s) => setStrokes((x) => [...x, s])} readOnly={busy} />
        {!strokes.length && <span className="gr-pad__hint">{t('ocr.padHint')}</span>}
      </div>
      <div className="gr-pad__actions">
        <Button size="sm" variant="ghost" onClick={() => setStrokes((x) => x.slice(0, -1))} disabled={busy || !strokes.length}>
          {t('toolbar.undo')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setStrokes([])} disabled={busy || !strokes.length}>
          {t('ocr.clear')}
        </Button>
        <span className="gr-pad__spacer" />
        {onCancel && (
          <Button size="sm" onClick={onCancel} disabled={busy}>
            {t('ocr.close')}
          </Button>
        )}
        <Button size="sm" variant="primary" onClick={submit} loading={busy} disabled={!strokes.length}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
