import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Minimal data-fetching hook.
 *   const { data, error, loading, initialLoading, reload, setData } = useApi(() => getThing(id), [id]);
 * Pass `null` as fn to skip.
 * `loading` is true on every request, reloads included; `initialLoading` only while
 * there is no data for the current deps (first load, retry after an error, or the deps changed). Show a
 * loader on `initialLoading` so a reload does not unmount what is on screen; `data`
 * keeps the previous value meanwhile (pagination relies on it).
 */
export function useApi(fn, deps = []) {
  const [state, setState] = useState({ data: undefined, error: null, loading: Boolean(fn), forDeps: null });
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!fnRef.current) return undefined;
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fnRef.current()
      .then((data) => alive && setState({ data, error: null, loading: false, forDeps: deps }))
      .catch((error) => alive && setState({ data: undefined, error, loading: false, forDeps: deps }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback((updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })), []);
  const { forDeps, ...rest } = state;
  const current = forDeps !== null && forDeps.length === deps.length && forDeps.every((d, i) => Object.is(d, deps[i]));
  return { ...rest, initialLoading: rest.loading && (!current || rest.data === undefined), reload, setData };
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
