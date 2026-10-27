import { useCallback, useEffect, useRef, useState } from 'react';

/** Sensitive reads never retain another instance/permission's data while loading.
 * Refocusing rechecks authorization; an old payload response cannot restore ink. */
export function useAnnotationRead(load, key) {
  const loader = useRef(load);
  useEffect(() => { loader.current = load; }, [load]);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState(null);
  const reload = useCallback(() => setRevision((n) => n + 1), []);
  useEffect(() => {
    window.addEventListener('focus', reload);
    const visible = () => { if (document.visibilityState === 'visible') reload(); };
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.removeEventListener('focus', reload);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [reload]);
  useEffect(() => {
    let alive = true;
    Promise.resolve().then(() => loader.current()).then(
      (data) => { if (alive) setState({ key, revision, data, error: null }); },
      (error) => { if (alive) setState({ key, revision, data: undefined, error }); },
    );
    return () => { alive = false; };
  }, [key, revision]);
  const current = state?.key === key && state.revision === revision;
  return { data: current ? state.data : undefined, error: current ? state.error : null, loading: !current, reload };
}
