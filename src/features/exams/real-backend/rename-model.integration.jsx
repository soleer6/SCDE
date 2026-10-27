import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { useState } from 'react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import i18n from '../../../app/i18n.js';
import { USE_MOCK } from '../../../lib/api/client.js';
import { ToastProvider } from '../../../ui';
import { getExam } from '../api.js';
import StructureTab from '../setup/StructureTab.jsx';
import { otherSession, signIn } from '../../grading/real-backend/session.js';

let fx, manager;
// jsdom has no PDF canvas; every API request still reaches Django (no HTTP mocks).
// This fixture has no blank PDF, so the viewer is never mounted.
vi.mock('react-pdf', () => ({ pdfjs: { GlobalWorkerOptions: {} }, Document: () => null, Page: () => null }));
beforeAll(async () => {
  expect(USE_MOCK).toBe(false);
  fx = JSON.parse((await readFile(join(process.env.LOCALAPPDATA, 'SCDE/integration/fixtures-a-h09.local.json'), 'utf8')).trimStart());
  manager = await otherSession(fx, 'manager');
  await i18n.changeLanguage('es');
});
afterEach(cleanup);
// eslint-disable-next-line react-refresh/only-export-components
function Harness({ initial, allowed = true }) {
  const [exam, setExam] = useState(initial);
  return <ToastProvider><StructureTab exam={exam} perms={{ exams: allowed, rubric: false }} onChanged={async () => setExam(await getExam(exam.id))} /></ToastProvider>;
}
async function mount(examId = fx.examId, role = 'manager', allowed = true) {
  await signIn(fx, role);
  const initial = await getExam(examId);
  render(<Harness initial={initial} allowed={allowed} />);
  return initial;
}
async function edit(label, target) {
  const user = userEvent.setup();
  const panel = screen.getByRole('heading', { name: `Modelo ${label}` }).closest('section');
  await user.click(within(panel).getByRole('button', { name: 'Renombrar modelo' }));
  const dialog = within(screen.getByRole('dialog'));
  const input = dialog.getByLabelText('Etiqueta');
  await user.clear(input); await user.type(input, target);
  await user.click(dialog.getByRole('button', { name: 'Renombrar modelo' }));
  return { user, input, dialog };
}

it('StructureTab renames over real HTTP and reload preserves model/problem identity', async () => {
  const initial = await mount();
  const model = initial.models_problems.find((m) => m.model_id === fx.modelId);
  const target = model.label === 'C2' ? 'D2' : 'C2';
  await edit(model.label, target);
  expect(await screen.findByRole('heading', { name: `Modelo ${target}` })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: `Modelo ${target}` })).toBeInTheDocument();
  const saved = await manager.get(`/models/${fx.modelId}/`);
  expect(saved.status).toBe(200); expect(saved.data.label).toBe(target); expect(saved.data.id).toBe(fx.modelId);
  const exam = (await manager.get(`/exams/${fx.examId}/`)).data;
  expect(exam.models_problems.find((m) => m.model_id === fx.modelId).problems).toEqual(model.problems);
  cleanup(); await mount(); expect(screen.getByRole('heading', { name: `Modelo ${target}` })).toBeInTheDocument();
});

it('real duplicate 409 preserves the draft and accepts a corrected label', async () => {
  const initial = await mount(); const current = initial.models_problems.find((m) => m.model_id === fx.modelId).label;
  const { user, input, dialog } = await edit(current, 'B');
  expect(await dialog.findByRole('alert')).toHaveTextContent('Ya existe un modelo con esa etiqueta.'); expect(input).toHaveValue('B');
  expect((await manager.get(`/models/${fx.modelId}/`)).data.label).toBe(current);
  const next = current === 'E2' ? 'F2' : 'E2';
  await user.clear(input); await user.type(input, next); await user.click(dialog.getByRole('button', { name: 'Renombrar modelo' }));
  expect(await screen.findByRole('heading', { name: `Modelo ${next}` })).toBeInTheDocument();
});

it('real archived-course 409 locks the editor without mutating the model', async () => {
  await mount(fx.archivedExamId); const { dialog, input } = await edit('A', 'Z');
  expect(await dialog.findByRole('alert')).toHaveTextContent('El curso está archivado'); expect(input).toBeDisabled();
  expect((await manager.get(`/models/${fx.archivedModelId}/`)).data.label).toBe('A');
});

it('hides the action without permission; a stale editor receives real 403', async () => {
  await mount(fx.examId, 'teacher', false); expect(screen.queryByRole('button', { name: 'Renombrar modelo' })).not.toBeInTheDocument();
  cleanup(); const initial = await mount(fx.examId, 'teacher', true);
  const current = initial.models_problems.find((m) => m.model_id === fx.modelId).label;
  const { dialog, input } = await edit(current, 'Z'); expect(await dialog.findByRole('alert')).toBeInTheDocument(); expect(input).toBeDisabled();
  expect((await manager.get(`/models/${fx.modelId}/`)).data.label).toBe(current);
});

it('Django rejects invalid labels and a foreign tenant with 400/404', async () => {
  for (const label of ['', 'A-', '12345678901']) expect((await manager.patch(`/models/${fx.modelId}/`, { label })).status).toBe(400);
  const foreign = await otherSession(fx, 'foreign'); const res = await foreign.patch(`/models/${fx.modelId}/`, { label: 'Z' });
  expect(res.status).toBe(404); expect(res.data.error_code).toBe('NOT_FOUND');
});
