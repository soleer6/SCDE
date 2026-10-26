import { useEffect, useRef, useState } from 'react';
import { decodeJwt, tokenStore } from '../../lib/api/tokens.js';
import { annotationSession } from './annotationSession.js';

/** Drafts are per instance and author. Only the author's latest page layer is
 * editable; every other record remains visible on its own read-only canvas. */
export function useAnnotations(instanceId, { readOnly = false, authorId = decodeJwt(tokenStore.getAccess())?.user_id } = {}) {
  const current = useRef(null);
  const [, render] = useState(0);
  useEffect(() => {
    const session = annotationSession(instanceId, authorId, () => {
      if (current.current === session) render((n) => n + 1);
    });
    current.current = session;
    void session.load();
    return () => {
      current.current = null;
      void session.flush();
    };
  }, [instanceId, authorId]);

  const s = current.current;
  const ready = s?.instanceId === instanceId && s?.authorId === authorId;
  const editable = ready && s.loaded && !readOnly;
  const setPage = (page, update) => {
    if (!editable) return;
    s.strokesByPage = { ...s.strokesByPage, [page]: update(s.strokesByPage[page] ?? []) };
    s.schedule(`p${page}`);
  };
  return {
    strokesByPage: ready ? s.strokesByPage : {},
    layersByPage: ready ? s.layersByPage : {},
    comments: ready ? s.comments : [],
    comment: ready ? s.comment : '',
    loading: !ready || s.loading,
    loadFailed: ready && !s.loading && !s.loaded,
    error: ready ? s.error : null,
    saveState: ready ? s.saveState : 'idle',
    addStroke: (page, stroke) => setPage(page, (strokes) => [...strokes, stroke]),
    undo: (page) => setPage(page, (strokes) => strokes.slice(0, -1)),
    clearPage: (page) => setPage(page, () => []),
    setComment: (text) => {
      if (!editable) return;
      s.comment = text;
      s.schedule('comment');
    },
    retry: () => ready ? (s.loaded ? s.flush() : s.load()) : Promise.resolve(false),
    flush: () => ready ? s.flush() : Promise.resolve(false),
  };
}
