import { useCallback, useEffect, useRef, useState } from 'react';
import { createAnnotation, listAnnotations, readAnnotationPayload, updateAnnotation } from './api.js';
import { isPadAnnotation, parseInk } from './ocr.js';

/* Persistence model (decision documented in docs/tfg/02-architecture-decisions.md):
 *  - one STYLUS annotation per page; payload = JSON { v: 1, strokes: [...] }
 *    stroke = { points: [{x,y}] (relative 0-1), color, width (relative to page width), tool }
 *  - one TEXT annotation (page 1, problem_id null) = general comment
 *  - handwriting pads (grade / transcription, see ocr.js) are separate annotations and ignored here
 * The backend stores the payload as an object and returns a presigned download_url.
 */
const SAVE_DELAY = 1200;

export function useAnnotations(instanceId, { readOnly = false } = {}) {
  const [strokesByPage, setStrokesByPage] = useState({});
  const [comment, setCommentState] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saveState, setSaveState] = useState('idle'); // idle | pending | saving | saved | error
  const ids = useRef({ stylus: {}, text: null }); // page -> annotation id
  const timers = useRef({}); // key -> { id, fn } of the pending debounced save
  const latest = useRef({ strokesByPage: {}, comment: '' });

  useEffect(() => {
    let alive = true;
    ids.current = { stylus: {}, text: null };
    setLoading(true);
    (async () => {
      const own = ids.current;
      try {
        const list = await listAnnotations(instanceId);
        const byPage = {};
        let text = '';
        await Promise.all(
          list.map(async (a) => {
            if (isPadAnnotation(a)) return;
            const payload = await readAnnotationPayload(a);
            if (a.annotation_type === 'STYLUS') {
              const strokes = parseInk(payload);
              if (!strokes) return;
              own.stylus[a.page_number] = a.id;
              byPage[a.page_number] = strokes;
            } else if (a.annotation_type === 'TEXT' && !a.problem_id) {
              own.text = a.id;
              text = payload;
            }
          }),
        );
        if (!alive) return;
        latest.current = { strokesByPage: byPage, comment: text };
        setStrokesByPage(byPage);
        setCommentState(text);
      } catch (e) {
        if (alive) setError(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
      // Leaving the instance (or the page) must not drop the last strokes:
      // run the pending saves now instead of cancelling them. Each save reads
      // its payload and annotation id synchronously, before the next load.
      const pending = Object.values(timers.current);
      timers.current = {};
      pending.forEach(({ id, fn }) => {
        clearTimeout(id);
        fn();
      });
    };
  }, [instanceId]);

  const persistPage = useCallback(
    async (page) => {
      const strokes = latest.current.strokesByPage[page] ?? [];
      const payload = JSON.stringify({ v: 1, strokes });
      const own = ids.current; // this instance's ids, even if the user moves on meanwhile
      setSaveState('saving');
      try {
        const id = own.stylus[page];
        if (id) await updateAnnotation(id, { payload });
        else {
          const created = await createAnnotation(instanceId, { annotation_type: 'STYLUS', payload, page_number: page, x: 0, y: 0 });
          own.stylus[page] = created.id;
        }
        setSaveState('saved');
      } catch (e) {
        setError(e);
        setSaveState('error');
      }
    },
    [instanceId],
  );

  const persistComment = useCallback(async () => {
    const payload = latest.current.comment;
    const own = ids.current;
    if (!payload && !own.text) return;
    setSaveState('saving');
    try {
      if (own.text) await updateAnnotation(own.text, { payload });
      else {
        const created = await createAnnotation(instanceId, { annotation_type: 'TEXT', payload, page_number: 1, x: 0, y: 0 });
        own.text = created.id;
      }
      setSaveState('saved');
    } catch (e) {
      setError(e);
      setSaveState('error');
    }
  }, [instanceId]);

  const schedule = (key, fn) => {
    clearTimeout(timers.current[key]?.id);
    setSaveState('pending');
    const id = setTimeout(() => {
      delete timers.current[key];
      fn();
    }, SAVE_DELAY);
    timers.current[key] = { id, fn };
  };

  const setPageStrokes = useCallback(
    (page, updater) => {
      if (readOnly) return;
      setStrokesByPage((prev) => {
        const next = { ...prev, [page]: updater(prev[page] ?? []) };
        latest.current.strokesByPage = next;
        return next;
      });
      schedule(`p${page}`, () => persistPage(page));
    },
    [readOnly, persistPage],
  );

  const addStroke = useCallback((page, stroke) => setPageStrokes(page, (s) => [...s, stroke]), [setPageStrokes]);
  const undo = useCallback((page) => setPageStrokes(page, (s) => s.slice(0, -1)), [setPageStrokes]);
  const clearPage = useCallback((page) => setPageStrokes(page, () => []), [setPageStrokes]);

  const setComment = useCallback(
    (text) => {
      latest.current.comment = text;
      setCommentState(text);
      schedule('comment', persistComment);
    },
    [persistComment],
  );

  return { strokesByPage, addStroke, undo, clearPage, comment, setComment, loading, error, saveState };
}
