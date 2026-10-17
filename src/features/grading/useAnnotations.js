import { useCallback, useEffect, useRef, useState } from 'react';
import { createAnnotation, listAnnotations, readAnnotationPayload, updateAnnotation } from './api.js';

/* Persistence model (decision documented in docs/tfg/02-architecture-decisions.md):
 *  - one STYLUS annotation per page; payload = JSON { v: 1, strokes: [...] }
 *    stroke = { points: [{x,y}] (relative 0-1), color, width (relative to page width), tool }
 *  - one TEXT annotation (page 1, problem_id null) = general comment
 * The backend stores the payload as an object and returns a presigned download_url.
 */
const SAVE_DELAY = 1200;

function parseStrokes(text) {
  try {
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : data.strokes ?? [];
  } catch {
    return [];
  }
}

export function useAnnotations(instanceId, { readOnly = false } = {}) {
  const [strokesByPage, setStrokesByPage] = useState({});
  const [comment, setCommentState] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saveState, setSaveState] = useState('idle'); // idle | pending | saving | saved | error
  const ids = useRef({ stylus: {}, text: null }); // page -> annotation id
  const timers = useRef({});
  const latest = useRef({ strokesByPage: {}, comment: '' });

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const list = await listAnnotations(instanceId);
        const byPage = {};
        let text = '';
        await Promise.all(
          list.map(async (a) => {
            const payload = await readAnnotationPayload(a);
            if (a.annotation_type === 'STYLUS') {
              ids.current.stylus[a.page_number] = a.id;
              byPage[a.page_number] = parseStrokes(payload);
            } else if (a.annotation_type === 'TEXT' && !a.problem_id) {
              ids.current.text = a.id;
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
    const pending = timers.current;
    return () => {
      alive = false;
      Object.values(pending).forEach(clearTimeout);
    };
  }, [instanceId]);

  const persistPage = useCallback(
    async (page) => {
      const strokes = latest.current.strokesByPage[page] ?? [];
      const payload = JSON.stringify({ v: 1, strokes });
      setSaveState('saving');
      try {
        const id = ids.current.stylus[page];
        if (id) await updateAnnotation(id, { payload });
        else {
          const created = await createAnnotation(instanceId, { annotation_type: 'STYLUS', payload, page_number: page, x: 0, y: 0 });
          ids.current.stylus[page] = created.id;
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
    if (!payload && !ids.current.text) return;
    setSaveState('saving');
    try {
      if (ids.current.text) await updateAnnotation(ids.current.text, { payload });
      else {
        const created = await createAnnotation(instanceId, { annotation_type: 'TEXT', payload, page_number: 1, x: 0, y: 0 });
        ids.current.text = created.id;
      }
      setSaveState('saved');
    } catch (e) {
      setError(e);
      setSaveState('error');
    }
  }, [instanceId]);

  const schedule = (key, fn) => {
    clearTimeout(timers.current[key]);
    setSaveState('pending');
    timers.current[key] = setTimeout(fn, SAVE_DELAY);
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
