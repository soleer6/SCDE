/* H47 RF6.9. Consumes a NEW isolated fixture once; no HTTP mocks or deletion.
 * SCDE_H47_FIXTURE overrides %LOCALAPPDATA%/SCDE/integration/fixtures-a-h47.local.json.
 * Run only this file with grading/real-backend/vitest.config.mjs. */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import i18n from '../../../app/i18n.js';
import { api, USE_MOCK } from '../../../lib/api/client.js';
import { tokenStore } from '../../../lib/api/tokens.js';
import { ToastProvider } from '../../../ui';
import { getExam } from '../api.js';
import StructureTab from '../setup/StructureTab.jsx';
import { login } from '../../grading/real-backend/session.js';

// No blank PDF in this fixture; jsdom does not have PDF canvas primitives.
vi.mock('react-pdf', () => ({ pdfjs: { GlobalWorkerOptions: {} }, Document: () => null, Page: () => null }));
afterEach(cleanup);
// eslint-disable-next-line react-refresh/only-export-components
function Harness({ initial, perms = { exams: true, rubric: true } }) {
  const [exam, setExam] = useState(initial);
  return <ToastProvider><StructureTab exam={{ ...exam, models_problems: exam.models_problems.filter((m) => m.label === 'A') }} perms={perms} onChanged={async () => setExam(await getExam(exam.id))} /></ToastProvider>;
}

it('H47 real HTTP: negative decimal, several optional zones, reload, 400, 403, rubric-only and scope', async () => {
  expect(USE_MOCK).toBe(false);
  const fx = JSON.parse((await readFile(process.env.SCDE_H47_FIXTURE || join(process.env.LOCALAPPDATA, 'SCDE/integration/fixtures-a-h47.local.json'), 'utf8')).trimStart());
  const sessions = {};
  for (const role of ['manager', 'teacher', 'student']) sessions[role] = await login(fx, role);
  const as = (role) => tokenStore.set(sessions[role].access_token, sessions[role].refresh_token);
  as('manager'); await i18n.changeLanguage('es');
  const initial = await getExam(fx.examId);
  expect(initial.models_problems.every((m) => m.problems.length === 0), 'Use a new fixture, never a consumed H47 fixture').toBe(true);
  const user = userEvent.setup();
  let view = render(<Harness initial={initial} />);
  await user.type(screen.getByLabelText('Nuevo problema'), 'Penalización H47');
  await user.type(screen.getByLabelText('Máx.'), '-1,25');
  await user.click(await screen.findByRole('checkbox', { name: /Pág. 1 · answer1/ }));
  await user.click(screen.getByRole('checkbox', { name: /Pág. 2 · answer2/ }));
  const add = () => screen.getByRole('button', { name: 'Añadir problema' });
  await user.click(add());
  expect(await screen.findByText('Problema añadido')).toBeInTheDocument();
  const read = async () => (await getExam(fx.examId)).models_problems.find((m) => m.model_id === fx.modelId).problems;
  let rows = await read();
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ name: 'Penalización H47', max_score: '-1.25' });
  expect([...rows[0].zone_ids].sort()).toEqual([...fx.zoneIds].sort());
  view.unmount(); view = render(<Harness initial={await getExam(fx.examId)} />);
  expect(await screen.findByRole('cell', { name: 'Penalización H47' })).toBeInTheDocument();

  // A stale form with a now denied session must preserve every field and retry.
  await user.type(screen.getByLabelText('Nuevo problema'), 'Tras 403');
  await user.type(screen.getByLabelText('Máx.'), '-0.5');
  await user.click(await screen.findByRole('checkbox', { name: /Pág. 1 · answer1/ }));
  as('student'); await user.click(add());
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  await waitFor(() => expect(add()).toBeEnabled());
  expect(screen.getByLabelText('Nuevo problema')).toHaveValue('Tras 403');
  expect(screen.getByLabelText('Máx.')).toHaveValue('-0.5');
  expect(screen.getByRole('checkbox', { name: /Pág. 1 · answer1/ })).toBeChecked();
  as('manager'); expect(await read()).toHaveLength(1);
  await user.click(add()); await waitFor(async () => expect(await read()).toHaveLength(2));
  expect((await read())[1].zone_ids).toEqual([fx.zoneIds[0]]);
  view.unmount();

  // Rubric permission alone permits creation, without a forbidden profiles GET.
  as('teacher');
  await expect(api.get(`/models/${fx.modelId}/page-profiles/`)).rejects.toMatchObject({ status: 403 });
  view = render(<Harness initial={await getExam(fx.examId)} perms={{ exams: false, rubric: true }} />);
  expect(screen.queryByRole('checkbox', { name: /answer/ })).not.toBeInTheDocument();
  await user.type(screen.getByLabelText('Nuevo problema'), 'Cero sin zonas');
  await user.type(screen.getByLabelText('Máx.'), '0'); await user.click(add());
  expect(await screen.findByText('Problema añadido')).toBeInTheDocument();
  expect((await read())[2]).toMatchObject({ max_score: '0.00', zone_ids: [] });
  view.unmount();

  as('manager');
  const path = `/models/${fx.modelId}/problems/`;
  for (const max_score of ['NaN', 'Infinity', '1.234', '10000']) {
    await expect(api.post(path, { name: 'Invalid', max_score })).rejects.toMatchObject({ status: 400 });
  }
  expect(await read()).toHaveLength(3);
  const scoped = await api.post(path, { name: 'Scope', max_score: '-2.50', zone_ids: [fx.zoneIds[1], fx.otherZoneId] });
  expect(scoped.zone_ids).toEqual([fx.zoneIds[1]]);
  as('student');
  await expect(api.post(path, { name: 'Denied', max_score: '-1' })).rejects.toMatchObject({ status: 403 });
  as('manager'); rows = await read(); expect(rows).toHaveLength(4);
  console.log('H47 real HTTP PASS: new fixture; negative+2 zones; GET/remount; stale 403/draft/retry; rubric-only zero; 4 validation 400; other-model zones filtered; student 403; 4 persisted problems.');
});
