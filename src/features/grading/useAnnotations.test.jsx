/* Annotation autosave: debounced saves must survive leaving the instance. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { api } from '../../lib/api/client.js';
import { tokenStore } from '../../lib/api/tokens.js';
import { db } from '../../lib/mock/db.js';
import '../../app/registry.js'; // registers every feature's mock handlers
import { useAnnotations } from './useAnnotations.js';

const stroke = { points: [{ x: 0.1, y: 0.1 }, { x: 0.3, y: 0.2 }], color: 'red', width: 0.003, tool: 'pen' };
const notesOf = (id) => db.annotations.filter((a) => a.instance_id === id);

beforeEach(async () => {
  localStorage.clear();
  db.reset();
  // download_url is a data: URL in mock mode
  globalThis.fetch = vi.fn(async (url) => new Response(decodeURIComponent(String(url).split(',')[1] ?? '')));
  const data = await api.post('/auth/login/', { email: 'maria.perez@uam.es', password: 'prof123' }, { auth: false });
  tokenStore.set(data.access_token, data.refresh_token);
});

describe('useAnnotations', () => {
  it('saves pending strokes when switching to another instance before the debounce fires', async () => {
    const { result, rerender } = renderHook(({ id }) => useAnnotations(id), { initialProps: { id: 'i-e-mat-p2-3' } });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.addStroke(1, stroke));
    expect(result.current.saveState).toBe('pending');

    rerender({ id: 'i-e-mat-p2-4' });
    await waitFor(() => expect(notesOf('i-e-mat-p2-3')).toHaveLength(1));
    expect(notesOf('i-e-mat-p2-3')[0]).toMatchObject({ annotation_type: 'STYLUS', page_number: 1 });
    expect(notesOf('i-e-mat-p2-4')).toHaveLength(0);

    // The new instance starts without the previous instance's annotation ids.
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.addStroke(1, stroke));
    rerender({ id: 'i-e-mat-p2-3' });
    await waitFor(() => expect(notesOf('i-e-mat-p2-4')).toHaveLength(1));
    expect(notesOf('i-e-mat-p2-3')).toHaveLength(1);
  });

  it('saves the general comment when the grader leaves the page', async () => {
    const { result, unmount } = renderHook(() => useAnnotations('i-e-mat-p2-3'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setComment('Buen planteamiento'));
    unmount();
    await waitFor(() => expect(notesOf('i-e-mat-p2-3').find((a) => a.annotation_type === 'TEXT')).toBeTruthy());
  });
});
