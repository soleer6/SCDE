import { useEffect, useRef } from 'react';

/** Lets a row register a "commit pending edits" function with the page's Guardar button.
 *  fn() resolves true when nothing is pending or the edit was persisted, false on failure. */
export function useSaver(register, key, fn) {
  const latest = useRef(fn);
  useEffect(() => {
    latest.current = fn;
  });
  useEffect(() => {
    if (!register) return undefined;
    register(key, () => latest.current());
    return () => register(key, null);
  }, [register, key]);
}
