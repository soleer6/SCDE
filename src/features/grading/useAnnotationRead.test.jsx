import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/api/errors.js';
import { useAnnotationRead } from './useAnnotationRead.js';

describe('sensitive annotation reads', () => {
  it('hides old ink immediately on instance/permission changes and ignores late payloads', async () => {
    let finishOld;
    const load = vi.fn().mockResolvedValueOnce({ ink: 'first' })
      .mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }))
      .mockRejectedValueOnce(new ApiError('PERMISSION_DENIED', 403))
      .mockResolvedValueOnce({ ink: 'new authorized content' });
    const { result, rerender } = renderHook(({ scope }) => useAnnotationRead(load, scope), { initialProps: { scope: 'instance-a' } });
    await waitFor(() => expect(result.current.data).toEqual({ ink: 'first' }));
    rerender({ scope: 'instance-b' });
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(finishOld).toBeTypeOf('function'));
    rerender({ scope: 'instance-b:revoked' });
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.error?.status).toBe(403));
    await act(async () => finishOld({ ink: 'late forbidden ink' }));
    expect(result.current.data).toBeUndefined();
    act(() => result.current.reload());
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.data).toEqual({ ink: 'new authorized content' }));
    expect(result.current.error).toBeNull();
  });

  it('rechecks permission on focus, removes cached URLs and can recover', async () => {
    const load = vi.fn().mockResolvedValueOnce(['old signed URL'])
      .mockRejectedValueOnce(new ApiError('PERMISSION_DENIED', 403))
      .mockResolvedValueOnce(['fresh signed URL']);
    const { result } = renderHook(() => useAnnotationRead(load, 'same-instance'));
    await waitFor(() => expect(result.current.data).toEqual(['old signed URL']));
    act(() => window.dispatchEvent(new Event('focus')));
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.error?.status).toBe(403));
    act(() => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(result.current.data).toEqual(['fresh signed URL']));
  });
});
