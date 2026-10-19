/* useApi: a reload keeps what is on screen (initialLoading stays false), while a
 * change of deps or a retry after an error counts as a first load again. */
import { describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useApi } from './hooks.js';

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('useApi', () => {
  it('only reports initialLoading until the first data for the current deps arrives', async () => {
    const calls = [];
    const { result, rerender } = renderHook(({ id }) => useApi(() => { const d = deferred(); calls.push({ id, ...d }); return d.promise; }, [id]), {
      initialProps: { id: 'a' },
    });
    expect(result.current.initialLoading).toBe(true);
    await act(async () => calls[0].resolve('A1'));
    expect(result.current).toMatchObject({ data: 'A1', loading: false, initialLoading: false });

    act(() => result.current.reload());
    expect(result.current).toMatchObject({ data: 'A1', loading: true, initialLoading: false });
    await act(async () => calls[1].resolve('A2'));
    expect(result.current.data).toBe('A2');

    rerender({ id: 'b' });
    expect(result.current).toMatchObject({ data: 'A2', loading: true, initialLoading: true });
    await act(async () => calls[2].resolve('B1'));
    expect(result.current).toMatchObject({ data: 'B1', initialLoading: false });
  });

  it('treats a retry after an error as a first load', async () => {
    const calls = [];
    const { result } = renderHook(() => useApi(() => { const d = deferred(); calls.push(d); return d.promise; }, []));
    await act(async () => calls[0].reject(new Error('boom')));
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));

    act(() => result.current.reload());
    expect(result.current).toMatchObject({ error: null, loading: true, initialLoading: true });
  });

  it('does not load when fn is null', () => {
    const { result } = renderHook(() => useApi(null, []));
    expect(result.current).toMatchObject({ data: undefined, loading: false, initialLoading: false });
  });
});
