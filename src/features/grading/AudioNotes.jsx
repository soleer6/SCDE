import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApi } from '../../lib/hooks.js';
import { Button, Panel, useToast } from '../../ui';
import { createAudioAnnotation, deleteAnnotation, listAnnotations } from './api.js';

const pad = (n) => String(n).padStart(2, '0');
const clock = (s) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;

/** Audio comments (RF-10.1–10.4): teachers record or upload them, the student listens when the
 *  exam allows annotations. The server validates format and the organisation's duration limit
 *  (RF-10.6); a 403 on the list just means "not visible". */
export default function AudioNotes({ instanceId, canEdit, currentUserId }) {
  const { t } = useTranslation('grading');
  const toast = useToast();
  const notes = useApi(async () => {
    try {
      return (await listAnnotations(instanceId)).filter((a) => a.annotation_type === 'AUDIO');
    } catch (e) {
      if (e.status === 403) return [];
      throw e;
    }
  }, [instanceId]);
  const [state, setState] = useState('idle'); // idle | recording | saving
  const [seconds, setSeconds] = useState(0);
  const rec = useRef(null);
  const timer = useRef(null);
  const canRecord = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined';

  useEffect(
    () => () => {
      clearInterval(timer.current);
      if (rec.current?.state === 'recording') rec.current.stream?.getTracks().forEach((x) => x.stop());
    },
    [],
  );

  const send = async (blob) => {
    setState('saving');
    try {
      await createAudioAnnotation(instanceId, blob);
      toast.success(t('audio.saved'));
      notes.reload();
    } catch (e) {
      toast.error(t(`audio.errors.${e.code}`, { defaultValue: t('audio.errors.UNKNOWN') }));
    } finally {
      setState('idle');
    }
  };

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      const r = new MediaRecorder(stream);
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((x) => x.stop());
        clearInterval(timer.current);
        send(new Blob(chunks, { type: r.mimeType || 'audio/webm' }));
      };
      rec.current = r;
      r.start();
      setSeconds(0);
      timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      setState('recording');
    } catch {
      toast.error(t('audio.errors.MIC_DENIED'));
    }
  };

  const remove = async (a) => {
    try {
      await deleteAnnotation(a.id);
      notes.reload();
    } catch (e) {
      toast.error(t(`audio.errors.${e.code}`, { defaultValue: t('audio.errors.UNKNOWN') }));
    }
  };

  const list = notes.data ?? [];
  if (!canEdit && !list.length) return null;

  return (
    <Panel title={t('audio.title')}>
      {canEdit && (
        <div className="ui-row gr-audio__tools">
          {state === 'recording' ? (
            <Button variant="solid" onClick={() => rec.current?.stop()}>
              {t('audio.stop', { time: clock(seconds) })}
            </Button>
          ) : (
            canRecord && (
              <Button onClick={start} disabled={state === 'saving'} loading={state === 'saving'}>
                {t('audio.record')}
              </Button>
            )
          )}
          <label className="ui-btn gr-audio__file">
            {t('audio.upload')}
            <input
              type="file"
              accept="audio/*"
              hidden
              disabled={state !== 'idle'}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) send(f);
              }}
            />
          </label>
        </div>
      )}
      {list.length === 0 ? (
        <p className="u-muted">{t('audio.none')}</p>
      ) : (
        <ul className="gr-audio__list">
          {list.map((a, n) => (
            <li key={a.id}>
              <span className="u-muted">{t('audio.item', { n: n + 1, who: a.author_email || '' })}</span>
              <audio controls preload="none" src={a.download_url} aria-label={t('audio.itemLabel', { n: n + 1 })} />
              {canEdit && a.author_id === currentUserId && (
                <Button size="sm" variant="ghost" onClick={() => remove(a)} aria-label={t('audio.deleteN', { n: n + 1 })}>
                  {t('audio.delete')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
