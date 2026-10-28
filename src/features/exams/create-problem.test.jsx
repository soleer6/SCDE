import { useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../app/i18n.js';
import { api } from '../../lib/api/client.js';
import { ApiError } from '../../lib/api/errors.js';
import { tokenStore } from '../../lib/api/tokens.js';
import { db } from '../../lib/mock/db.js';
import { ToastProvider } from '../../ui';
import { getExam } from './api.js';
import StructureTab from './setup/StructureTab.jsx';

let examId, modelId;
async function login(email = 'maria.perez@uam.es', password = 'prof123') {
  const data = await api.post('/auth/login/', { email, password }, { auth: false });
  tokenStore.set(data.access_token, data.refresh_token);
}
function Harness({ initial, perms }) {
  const [exam, setExam] = useState(initial);
  return <ToastProvider><StructureTab exam={exam} perms={perms} onChanged={async () => setExam(await getExam(exam.id))} /></ToastProvider>;
}
async function mount(perms = { exams: true, rubric: true }) {
  return render(<Harness initial={await getExam(examId)} perms={perms} />);
}
async function fill(score = '-1,25') {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Nuevo problema'), 'Penalización');
  await user.type(screen.getByLabelText('Máx.'), score);
  return user;
}
const add = () => screen.getByRole('button', { name: 'Añadir problema' });
const problems = async () => (await getExam(examId)).models_problems[0].problems;

beforeEach(async () => {
  localStorage.clear(); db.reset(); await i18n.changeLanguage('es'); await login();
  const exam = await api.post('/subjects/s-mat101/exams/', { name: 'RF69 fresh fixture' });
  examId = exam.id;
  const model = await api.post(`/exams/${examId}/models/`, { label: 'R69' });
  modelId = model.id;
  // New synthetic profiles/zones, independent of the consumed H24/H41 fixture.
  for (const page of [1, 2]) {
    const profileId = `rf69-profile-${page}`;
    db.page_profiles.push({ id: profileId, exam_model_id: modelId, page_number: page, page_width: 595, page_height: 842 });
    db.zones.push({ id: `rf69-zone-${page}`, page_profile_id: profileId, attribute: `answer${page}`, zone_type: 'OCR_TEXT', x: 10, y: 20, width: 100, height: 50 });
  }
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('creates a negative decimal with multiple existing zones and preserves it across remount and GET', async () => {
  const view = await mount();
  const user = await fill();
  await user.click(await screen.findByRole('checkbox', { name: /Pág. 1 · answer1/ }));
  await user.click(screen.getByRole('checkbox', { name: /Pág. 2 · answer2/ }));
  const post = vi.spyOn(api, 'post');
  await user.click(add());
  expect(await screen.findByText('Problema añadido')).toBeInTheDocument();
  expect(post).toHaveBeenCalledWith(`/models/${modelId}/problems/`, { name: 'Penalización', max_score: '-1.25', order: 1, zone_ids: ['rf69-zone-1', 'rf69-zone-2'] });
  expect((await problems())[0]).toMatchObject({ max_score: '-1.25', zone_ids: ['rf69-zone-1', 'rf69-zone-2'] });
  expect(screen.getByLabelText('Nuevo problema')).toHaveValue('');
  expect(screen.getByRole('checkbox', { name: /Pág. 1 · answer1/ })).not.toBeChecked();
  view.unmount(); await mount();
  expect(await screen.findByRole('cell', { name: 'Penalización' })).toBeInTheDocument();
  expect((await problems())[0].zone_ids).toHaveLength(2);
});

it('permits zero without zones and rejects empty, nonfinite or malformed decimals even on direct form submit', async () => {
  await mount(); const user = await fill('0');
  expect(add()).toBeEnabled(); await user.click(add());
  expect(await screen.findByText('Problema añadido')).toBeInTheDocument();
  expect((await problems())[0]).toMatchObject({ max_score: '0.00', zone_ids: [] });
  await user.type(screen.getByLabelText('Nuevo problema'), 'Invalid');
  const post = vi.spyOn(api, 'post');
  for (const value of ['', ' ', '-', 'NaN', 'Infinity', '1.234', '10000', '1,2,3', '0x10']) {
    fireEvent.change(screen.getByLabelText('Máx.'), { target: { value } });
    expect(add()).toBeDisabled(); fireEvent.submit(add().closest('form'));
  }
  expect(post).not.toHaveBeenCalled();
});

it.each([403, 400, 500])('preserves the name, score and selected zones after HTTP %i and allows retry', async (status) => {
  await mount(); const user = await fill();
  await user.click(await screen.findByRole('checkbox', { name: /Pág. 1 · answer1/ }));
  const post = vi.spyOn(api, 'post').mockRejectedValueOnce(new ApiError(status === 403 ? 'PERMISSION_DENIED' : status === 500 ? 'INTERNAL_ERROR' : 'VALIDATION_ERROR', status));
  await user.click(add());
  await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(add()).toBeEnabled());
  expect(screen.getByLabelText('Nuevo problema')).toHaveValue('Penalización');
  expect(screen.getByLabelText('Máx.')).toHaveValue('-1,25');
  expect(screen.getByRole('checkbox', { name: /Pág. 1 · answer1/ })).toBeChecked();
  expect(await problems()).toEqual([]);
  await user.click(add()); expect(await screen.findByText('Problema añadido')).toBeInTheDocument();
});

it('handles unavailable profiles with retry while keeping an optional zone-free creation available', async () => {
  const get = api.get.bind(api);
  let unavailable = true;
  vi.spyOn(api, 'get').mockImplementation((path, ...args) => path.endsWith('/page-profiles/') && unavailable ? Promise.reject(new ApiError('PERMISSION_DENIED', 403)) : get(path, ...args));
  await mount(); const user = await fill();
  expect(await screen.findByRole('alert')).toBeInTheDocument(); expect(add()).toBeEnabled();
  unavailable = false;
  await user.click(screen.getByRole('button', { name: /Reintentar/ }));
  expect(await screen.findByRole('checkbox', { name: /Pág. 2 · answer2/ })).toBeInTheDocument();
});

it('refreshes existing zones and lets the user clear a selection whose zone is no longer available', async () => {
  await mount(); const user = await fill();
  await user.click(await screen.findByRole('checkbox', { name: /Pág. 1 · answer1/ }));
  db.zones = db.zones.filter((z) => z.id !== 'rf69-zone-1');
  await user.click(screen.getByRole('button', { name: 'Actualizar zonas' }));
  await waitFor(() => expect(screen.queryByRole('checkbox', { name: /Pág. 1 · answer1/ })).not.toBeInTheDocument());
  expect(add()).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Quitar selección de zonas' }));
  expect(add()).toBeEnabled();
  await user.click(screen.getByRole('checkbox', { name: /Pág. 2 · answer2/ }));
  await user.click(add()); expect(await screen.findByText('Problema añadido')).toBeInTheDocument();
  expect((await problems())[0].zone_ids).toEqual(['rf69-zone-2']);
});

it('hides creation without rubric permission and makes no unauthorized zone request with rubric alone', async () => {
  const view = await mount({ exams: false, rubric: false });
  expect(screen.queryByRole('button', { name: 'Añadir problema' })).not.toBeInTheDocument(); view.unmount();
  await login('javier.ruiz@uam.es');
  // Give the teacher access to the fresh exam, which belongs to MAT101.
  const get = vi.spyOn(api, 'get');
  await mount({ exams: false, rubric: true });
  const user = await fill('-2.5'); await user.click(add());
  expect(await screen.findByText('Problema añadido')).toBeInTheDocument();
  expect(get.mock.calls.some(([path]) => /page-profiles|\/models\//.test(path))).toBe(false);
  expect((await problems())[0]).toMatchObject({ max_score: '-2.50', zone_ids: [] });
  await login('elena.rodriguez@estudiante.uam.es', 'est123');
  await expect(api.post(`/models/${modelId}/problems/`, { name: 'Denied', max_score: '-1' })).rejects.toMatchObject({ status: 403 });
});

it('mock filters zones to the current model, persists selected IDs and rejects invalid inputs without writing', async () => {
  const path = `/models/${modelId}/problems/`;
  const created = await api.post(path, { name: 'Scoped', max_score: '-0.25', zone_ids: ['rf69-zone-1', 'z-mat-p1-name', 'missing'] });
  expect(created.zone_ids).toEqual(['rf69-zone-1']);
  expect((await problems())[0]).toMatchObject({ id: created.id, max_score: '-0.25', zone_ids: ['rf69-zone-1'] });
  for (const max_score of ['', null, 'NaN', 'Infinity', '-10000', '1.234']) {
    await expect(api.post(path, { name: 'Invalid', max_score })).rejects.toMatchObject({ status: 400 });
  }
  await expect(api.post(path, { name: 'Invalid', max_score: '-1', zone_ids: 'rf69-zone-1' })).rejects.toMatchObject({ status: 400 });
  expect(await problems()).toHaveLength(1);
});
