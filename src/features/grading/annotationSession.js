import { createAnnotation, listAnnotations, updateAnnotation } from './api.js';
import { readAnnotationLayers } from './annotationLayers.js';

const SAVE_DELAY = 1200;

/** One instance/author owns its drafts, ids, timers and serial write queue.
 * Navigation flushes this object, so a late response cannot update another
 * instance's ids or mark its unrelated drafts as saved. */
export function annotationSession(instanceId, authorId, notify) {
  const s = {
    instanceId, authorId, loading: true, loaded: false, error: null,
    saveState: 'idle', strokesByPage: {}, layersByPage: {}, comments: [],
    comment: '', ids: { stylus: {}, text: null }, dirty: new Map(),
    timers: new Map(), writing: null,
  };
  s.load = async () => {
    s.loading = true;
    s.error = null;
    notify();
    try {
      const data = await readAnnotationLayers(await listAnnotations(instanceId), authorId);
      Object.assign(s, data, { loaded: true });
    } catch (e) {
      s.error = e;
    } finally {
      s.loading = false;
      notify();
    }
  };
  const write = async (key) => {
    const page = Number(key.slice(1));
    const isText = key === 'comment';
    const payload = isText ? s.comment : JSON.stringify({ v: 1, strokes: s.strokesByPage[page] ?? [] });
    const id = isText ? s.ids.text : s.ids.stylus[page];
    if (!payload && !id) return;
    if (id) await updateAnnotation(id, { payload });
    else {
      const created = await createAnnotation(instanceId, { annotation_type: isText ? 'TEXT' : 'STYLUS', payload, page_number: isText ? 1 : page, x: 0, y: 0 });
      if (isText) s.ids.text = created.id;
      else s.ids.stylus[page] = created.id;
    }
  };
  s.flush = () => {
    if (!s.loaded) return Promise.resolve(false);
    for (const timer of s.timers.values()) clearTimeout(timer);
    s.timers.clear();
    if (s.writing) return s.writing;
    // Defer the loop one microtask so writing is set before it can settle.
    s.writing = Promise.resolve().then(async () => {
      s.error = null;
      if (s.dirty.size) s.saveState = 'saving';
      notify();
      try {
        while (s.dirty.size) {
          const [key, version] = s.dirty.entries().next().value;
          await write(key);
          // An edit made while this request was in flight still needs saving.
          if (s.dirty.get(key) === version) s.dirty.delete(key);
        }
        s.saveState = 'saved';
        return true;
      } catch (e) {
        s.error = e;
        s.saveState = 'error';
        return false;
      } finally {
        s.writing = null;
        notify();
      }
    });
    return s.writing;
  };
  s.schedule = (key) => {
    s.dirty.set(key, (s.dirty.get(key) ?? 0) + 1);
    clearTimeout(s.timers.get(key));
    s.saveState = 'pending';
    s.timers.set(key, setTimeout(() => { s.timers.delete(key); void s.flush(); }, SAVE_DELAY));
    notify();
  };
  return s;
}
