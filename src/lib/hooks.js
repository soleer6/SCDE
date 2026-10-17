import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Minimal data-fetching hook.
 *   const { data, error, loading, reload, setData } = useApi(() => getThing(id), [id]);
 * Pass `null` as fn to skip.
 */
export function useApi(fn, deps = []) {
  const [state, setState] = useState({ data: undefined, error: null, loading: Boolean(fn) });
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!fnRef.current) return undefined;
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fnRef.current()
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((error) => alive && setState({ data: undefined, error, loading: false }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback((updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })), []);
  return { ...state, reload, setData };
}

/** Wraps an async action with pending/error state. */
export function useAction(fn) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const run = useCallback(
    async (...args) => {
      setPending(true);
      setError(null);
      try {
        return await fn(...args);
      } catch (e) {
        setError(e);
        throw e;
      } finally {
        setPending(false);
      }
    },
    [fn],
  );
  return { run, pending, error };
}
