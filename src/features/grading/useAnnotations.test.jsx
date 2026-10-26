/* Annotation autosave: debounced saves must survive leaving the instance. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { api } from '../../lib/api/client.js';
import { tokenStore } from '../../lib/api/tokens.js';
import { db } from '../../lib/mock/db.js';
import { ApiError } from '../../lib/api/errors.js';
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
afterEach(() => vi.restoreAllMocks());

describe('useAnnotations', () => {
  it('blocks edits after a payload download fails and reloads the existing content on retry', async () => {
    const id = 'i-e-mat-p2-3';
    await api.post(`/instances/${id}/annotations/`, { annotation_type: 'TEXT', payload: 'Original conservado', page_number: 1, x: 0, y: 0 });
    globalThis.fetch.mockResolvedValueOnce(new Response('unavailable', { status: 503 }));
    const { result } = renderHook(() => useAnnotations(id));
    await waitFor(() => expect(result.current.loadFailed).toBe(true));
    act(() => { result.current.setComment('No debe sobrescribir'); result.current.addStroke(1, stroke); });
    expect(result.current.comment).toBe('');
    expect(notesOf(id)[0].content).toBe('Original conservado');
    await act(async () => { await result.current.retry(); });
    expect(result.current.loadFailed).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.comment).toBe('Original conservado');
  });

  it('preserves multiple legacy records and comments without selecting an id by download speed', async () => {
    const id = 'i-e-mat-p2-3';
    const older = await api.post(`/instances/${id}/annotations/`, { annotation_type: 'STYLUS', payload: JSON.stringify({ strokes: [stroke] }), page_number: 1, x: 0, y: 0 });
    notesOf(id)[0].created_at = '2026-01-01T00:00:00Z';
    const newer = await api.post(`/instances/${id}/annotations/`, { annotation_type: 'STYLUS', payload: JSON.stringify({ strokes: [] }), page_number: 1, x: 0, y: 0 });
    await api.post(`/instances/${id}/annotations/`, { annotation_type: 'TEXT', payload: 'Mi comentario', page_number: 1, x: 0, y: 0 });
    const foreign = await api.post(`/instances/${id}/annotations/`, { annotation_type: 'TEXT', payload: 'Comentario ajeno', page_number: 1, x: 0, y: 0 });
    notesOf(id).find((a) => a.id === foreign.id).author_id = 'u-javier';
    const { result, unmount } = renderHook(() => useAnnotations(id));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.comment).toBe('Mi comentario');
    expect(result.current.comments).toEqual([expect.objectContaining({ text: 'Comentario ajeno' })]);
    expect(result.current.layersByPage[1][0].id).toBe(older.id);
    act(() => result.current.addStroke(1, stroke));
    unmount();
    await waitFor(() => expect(JSON.parse(notesOf(id).find((a) => a.id === newer.id).content).strokes).toHaveLength(1));
    expect(JSON.parse(notesOf(id).find((a) => a.id === older.id).content).strokes).toEqual([stroke]);
  });

  it('serializes an in-flight create and its newer draft into one annotation', async () => {
    const id = 'i-e-mat-p2-3';
    const { result } = renderHook(() => useAnnotations(id));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const post = api.post;
    let release;
    vi.spyOn(api, 'post').mockImplementationOnce((...args) => new Promise((resolve) => { release = () => resolve(post(...args)); }));
    act(() => result.current.addStroke(1, stroke));
    let save;
    act(() => { save = result.current.flush(); });
    await waitFor(() => expect(release).toBeTypeOf('function'));
    act(() => result.current.addStroke(1, { ...stroke, color: 'blue' }));
    await act(async () => { release(); await save; });
    expect(notesOf(id)).toHaveLength(1);
    expect(JSON.parse(notesOf(id)[0].content).strokes).toHaveLength(2);
    expect(result.current.saveState).toBe('saved');
  });

  it('does not leak a late save failure into the next instance', async () => {
    const { result, rerender } = renderHook(({ id }) => useAnnotations(id), { initialProps: { id: 'i-e-mat-p2-3' } });
    await waitFor(() => expect(result.current.loading).toBe(false));
    let reject;
    vi.spyOn(api, 'post').mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
    act(() => result.current.setComment('Borrador anterior'));
    let save;
    act(() => { save = result.current.flush(); });
    await waitFor(() => expect(reject).toBeTypeOf('function'));
    rerender({ id: 'i-e-mat-p2-4' });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { reject(new ApiError('UNKNOWN', 503)); await save; });
    expect(result.current.error).toBeNull();
    expect(result.current.comment).toBe('');
    expect(result.current.saveState).toBe('idle');
  });

  it('never schedules changes in read-only mode', async () => {
    const { result } = renderHook(() => useAnnotations('i-e-mat-p2-3', { readOnly: true }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { result.current.setComment('No autorizado'); result.current.addStroke(1, stroke); });
    expect(result.current.comment).toBe('');
    expect(result.current.strokesByPage).toEqual({});
    expect(notesOf('i-e-mat-p2-3')).toHaveLength(0);
  });

  it('keeps every author layer visible and edits only the current author layer', async () => {
    const id = 'i-e-mat-p2-3';
    const own = await api.post(`/instances/${id}/annotations/`, { annotation_type: 'STYLUS', payload: JSON.stringify({ v: 1, strokes: [stroke] }), page_number: 1, x: 0, y: 0 });
    const foreignStroke = { ...stroke, color: 'blue' };
    const foreign = await api.post(`/instances/${id}/annotations/`, { annotation_type: 'STYLUS', payload: JSON.stringify({ v: 1, strokes: [foreignStroke] }), page_number: 1, x: 0, y: 0 });
    const foreignRow = notesOf(id).find((a) => a.id === foreign.id);
    foreignRow.author_id = 'u-javier';
    const original = foreignRow.content;
    const { result, unmount } = renderHook(() => useAnnotations(id));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.strokesByPage[1]).toEqual([stroke]);
    expect(result.current.layersByPage[1]).toEqual([expect.objectContaining({ id: foreign.id, strokes: [foreignStroke] })]);
    act(() => result.current.addStroke(1, stroke));
    unmount();
    await waitFor(() => expect(JSON.parse(notesOf(id).find((a) => a.id === own.id).content).strokes).toHaveLength(2));
    expect(foreignRow.content).toBe(original);
  });

  it('keeps a failed save in memory and retries without discarding the draft', async () => {
    const { result } = renderHook(() => useAnnotations('i-e-mat-p2-3'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const post = vi.spyOn(api, 'post').mockRejectedValueOnce(new ApiError('UNKNOWN', 503));
    act(() => result.current.setComment('Comentario conservado'));
    await act(async () => { await result.current.flush(); });
    expect(result.current.saveState).toBe('error');
    expect(result.current.comment).toBe('Comentario conservado');
    post.mockRestore();
    await act(async () => { await result.current.retry(); });
    expect(result.current.error).toBeNull();
    expect(result.current.saveState).toBe('saved');
    expect(notesOf('i-e-mat-p2-3').find((a) => a.annotation_type === 'TEXT').content).toBe('Comentario conservado');
  });

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
