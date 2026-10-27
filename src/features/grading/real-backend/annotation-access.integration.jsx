import '@testing-library/jest-dom/vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { USE_MOCK, api } from '../../../lib/api/client.js';
import { listAnnotations } from '../api.js';
import { readAnnotationLayers } from '../annotationLayers.js';
import { useAnnotationRead } from '../useAnnotationRead.js';
import { signIn } from './session.js';

afterEach(cleanup);

it('real HTTP: switches authorized teacher → denied student → recovered teacher without stale ink', async () => {
  expect(USE_MOCK).toBe(false);
  const file = join(process.env.LOCALAPPDATA, 'SCDE/integration/fixtures-a-authors.local.json');
  const fx = JSON.parse((await readFile(file, 'utf8')).trimStart());
  await signIn(fx, 'teacher');
  const { result, rerender } = renderHook(({ scope, id }) => useAnnotationRead(
    async () => readAnnotationLayers(await listAnnotations(id)), `${id}:${scope}`,
  ), { initialProps: { scope: 'teacher', id: fx.instanceId } });
  await waitFor(() => expect(result.current.data?.layersByPage[1]?.length).toBeGreaterThan(0), { timeout: 15000 });
  await signIn(fx, 'otherStudent');
  rerender({ scope: 'student', id: fx.otherInstanceId });
  expect(result.current.data).toBeUndefined();
  rerender({ scope: 'student', id: fx.instanceId });
  expect(result.current.data).toBeUndefined();
  await waitFor(() => expect(result.current.error?.status).toBe(403), { timeout: 15000 });
  expect(result.current.error.code).toBe('PERMISSION_DENIED');
  expect(result.current.data).toBeUndefined();
  await expect(api.get(`/instances/${fx.instanceId}/`)).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
  await expect(listAnnotations('00000000-0000-4000-8000-000000000036')).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  await signIn(fx, 'teacher');
  act(() => result.current.reload());
  expect(result.current.data).toBeUndefined();
  await waitFor(() => expect(result.current.data?.layersByPage[1]?.length).toBeGreaterThan(0), { timeout: 15000 });
  expect(result.current.error).toBeNull();
});
