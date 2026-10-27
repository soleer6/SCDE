import '@testing-library/jest-dom/vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../../../app/i18n.js';
import { api, USE_MOCK } from '../../../lib/api/client.js';
import { ToastProvider } from '../../../ui';
import { getInstance, listAnnotations, ocrGradeAnnotation, readAnnotationPayload, serverGrades } from '../api.js';
import { useKnownGrades } from '../useKnownGrades.js';
import ProblemGrader from '../ProblemGrader.jsx';
import SavedGradeOcr from '../SavedGradeOcr.jsx';
import { signIn } from './session.js';

afterEach(cleanup);
const fixture = async () => JSON.parse((await readFile(join(process.env.LOCALAPPDATA,
  'SCDE/integration/fixtures-a-h14.local.json'), 'utf8')).trimStart());

it('HTTP real + UI: saved synthetic ink reads 7 at 0.66, no grade, no rewritten annotation', async () => {
  expect(USE_MOCK).toBe(false);
  const fx = await fixture();
  const auth = await signIn(fx, 'manager');
  const before = await listAnnotations(fx.instanceId);
  const bytes = await readAnnotationPayload(before.find((a) => a.id === fx.inkId));
  const onApplied = vi.fn();
  const onUse = vi.fn();
  render(<SavedGradeOcr instanceId={fx.instanceId} problem={{ id: fx.problemId }} currentUserId={auth.user.id} onApplied={onApplied} onUse={onUse} />);
  await userEvent.click(await screen.findByRole('button', { name: /reconocer anotación guardada|recognize saved annotation/i }, { timeout: 15000 }));
  expect(await screen.findByText(/66\s*%/, {}, { timeout: 30000 })).toHaveTextContent('7');
  expect(screen.getByText(/revisa la cifra|check the value/i)).toBeVisible();
  expect(onApplied).not.toHaveBeenCalled();
  expect(onUse).not.toHaveBeenCalled();
  expect((await getInstance(fx.instanceId)).grades).toEqual([]);
  const after = await listAnnotations(fx.instanceId);
  expect(after.map((a) => a.id)).toEqual(before.map((a) => a.id));
  expect(await readAnnotationPayload(after.find((a) => a.id === fx.inkId))).toBe(bytes);
});

it('HTTP real + UI: TEXT auto-applied then GET grades updates the input without PUT', async () => {
  const fx = await fixture();
  const auth = await signIn(fx, 'manager');
  const initial = await getInstance(fx.textInstanceId);
  const initialGrades = serverGrades(initial);
  const ordered = (await listAnnotations(fx.textInstanceId)).filter((a) => a.author_id === auth.user.id && a.problem_id === fx.problemId);
  const requests = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), method: options?.method ?? 'GET' });
    return realFetch(url, options);
  };
  function Row() {
    const known = useKnownGrades(fx.textInstanceId, initialGrades);
    return <ProblemGrader instanceId={fx.textInstanceId} problem={{ id: fx.problemId, name: 'P1', max_score: '10', order: 1 }}
      known={known} currentUserId={auth.user.id} onSaved={() => {}} onConflict={async () => serverGrades(await getInstance(fx.textInstanceId))} />;
  }
  try {
    render(<ToastProvider><Row /></ToastProvider>);
    const buttons = await screen.findAllByRole('button', { name: /reconocer anotación guardada|recognize saved annotation/i }, { timeout: 15000 });
    await userEvent.click(buttons[ordered.findIndex((a) => a.id === fx.textId)]);
    expect(await screen.findByText(/nota aplicada|grade applied/i, {}, { timeout: 15000 })).toBeVisible();
    const input = await screen.findByRole('textbox', { name: /nota.*p1|grade for p1/i });
    await vi.waitFor(() => expect(input).toHaveValue('7.5'));
    expect(screen.queryByRole('button', { name: /usar esta nota|use this grade/i })).toBeNull();
    expect((await getInstance(fx.textInstanceId)).grades.find((g) => g.problem_id === fx.problemId).score).toBe('7.50');
    expect(requests.filter((r) => r.method === 'POST' && r.url.endsWith('/ocr-grade/'))).toHaveLength(1);
    expect(requests.filter((r) => ['PUT', 'PATCH', 'DELETE'].includes(r.method))).toEqual([]);
    expect(requests.some((r) => r.method === 'GET' && r.url.endsWith(`/instances/${fx.textInstanceId}/`))).toBe(true);
  } finally { globalThis.fetch = realFetch; }
});

it('HTTP real: malformed stored ink 400, non-author 403, foreign tenant 404', async () => {
  const fx = await fixture();
  await signIn(fx, 'manager');
  await expect(ocrGradeAnnotation(fx.invalidId)).rejects.toMatchObject({ status: 400, code: 'INVALID_STYLUS_PAYLOAD' });
  await signIn({ ...fx, password: fx.teacherPassword }, 'teacher');
  await expect(ocrGradeAnnotation(fx.inkId)).rejects.toMatchObject({ status: 403, code: 'NOT_AUTHOR' });
  await signIn(fx, 'foreign');
  await expect(ocrGradeAnnotation(fx.inkId)).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  await expect(api.get('/instances/00000000-0000-4000-8000-000000000038/')).rejects.toMatchObject({ status: 404 });
});
