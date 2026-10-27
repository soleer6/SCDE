import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import i18n from '../../app/i18n.js';
import { api } from '../../lib/api/client.js';
import { ApiError } from '../../lib/api/errors.js';
import { tokenStore } from '../../lib/api/tokens.js';
import { db } from '../../lib/mock/db.js';
import { ToastProvider } from '../../ui';
import { getExam, updateModel } from './api.js';
import StructureTab from './setup/StructureTab.jsx';

const id = 'mdl-e-prg-pr1';
function Harness({ initial, allowed = true }) {
  const [exam, setExam] = useState(initial);
  return <ToastProvider><StructureTab exam={exam} perms={{ exams: allowed, rubric: false }} onChanged={async () => setExam(await getExam(exam.id))} /></ToastProvider>;
}
async function mount(allowed = true) {
  const data = await api.post('/auth/login/', { email: 'maria.perez@uam.es', password: 'prof123' }, { auth: false });
  tokenStore.set(data.access_token, data.refresh_token);
  render(<Harness initial={await getExam('e-prg-pr1')} allowed={allowed} />);
}
async function open() {
  const user = userEvent.setup();
  await user.click(screen.getAllByRole('button', { name: 'Renombrar modelo' })[0]);
  const dialog = within(screen.getByRole('dialog'));
  return { user, dialog, input: dialog.getByLabelText('Etiqueta'), save: dialog.getByRole('button', { name: 'Renombrar modelo' }) };
}
beforeEach(async () => { localStorage.clear(); db.reset(); await i18n.changeLanguage('es'); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('renames through StructureTab and refreshes headings, copy options and the persisted detail', async () => {
  await mount();
  const { user, input, save } = await open();
  expect(save).toBeDisabled();
  await user.clear(input); await user.type(input, 'B2'); await user.click(save);
  expect(await screen.findByRole('heading', { name: 'Modelo B2' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Modelo B2' })).toBeInTheDocument();
  expect((await api.get(`/models/${id}/`)).label).toBe('B2');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('hides renaming without exam permissions and rejects a direct unauthorized request', async () => {
  await mount(false);
  expect(screen.queryByRole('button', { name: 'Renombrar modelo' })).not.toBeInTheDocument();
  const data = await api.post('/auth/login/', { email: 'javier.ruiz@uam.es', password: 'prof123' }, { auth: false });
  tokenStore.set(data.access_token, data.refresh_token);
  await expect(updateModel(id, { label: 'B' })).rejects.toMatchObject({ status: 403 });
});

it('validates labels locally and cancels without writing', async () => {
  await mount(); const patch = vi.spyOn(api, 'patch');
  const { user, dialog, input, save } = await open();
  await user.clear(input); expect(save).toBeDisabled();
  await user.type(input, 'A-'); expect(input).toHaveAttribute('aria-invalid', 'true'); expect(save).toBeDisabled();
  await user.clear(input); await user.type(input, '12345678901'); expect(input).toHaveValue('1234567890');
  await user.click(dialog.getByRole('button', { name: 'Cancelar' }));
  expect(patch).not.toHaveBeenCalled(); expect(db.models.find((m) => m.id === id).label).toBe('A');
});

it('keeps a duplicate draft and lets the user correct it', async () => {
  db.models.push({ id: 'second', exam_id: 'e-prg-pr1', label: 'B' });
  await mount(); const { user, input, save, dialog } = await open();
  await user.clear(input); await user.type(input, 'B'); await user.click(save);
  expect(await dialog.findByRole('alert')).toHaveTextContent('Ya existe un modelo con esa etiqueta.');
  expect(input).toHaveValue('B'); expect(db.models.find((m) => m.id === id).label).toBe('A');
  await user.type(input, '2'); await user.click(save);
  expect(await screen.findByRole('heading', { name: 'Modelo B2' })).toBeInTheDocument();
});

it.each(['PERMISSION_DENIED', 'COURSE_ARCHIVED', 'NOT_FOUND'])('locks a stale editor after %s', async (code) => {
  await mount(); vi.spyOn(api, 'patch').mockRejectedValue(new ApiError(code, code === 'NOT_FOUND' ? 404 : code === 'PERMISSION_DENIED' ? 403 : 409));
  const { user, input, save, dialog } = await open();
  await user.clear(input); await user.type(input, 'B'); await user.click(save);
  expect(await dialog.findByRole('alert')).toBeInTheDocument(); expect(save).toBeDisabled(); expect(input).toHaveValue('B'); expect(input).toBeDisabled();
});

it('retains a draft after network/validation errors and prevents double submission while pending', async () => {
  await mount();
  const patch = vi.spyOn(api, 'patch').mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 0)).mockRejectedValueOnce(new ApiError('VALIDATION_ERROR', 400, { label: ['invalid'] }));
  const { user, input, save, dialog } = await open();
  await user.clear(input); await user.type(input, 'B'); await user.click(save);
  expect(await dialog.findByRole('alert')).toBeInTheDocument(); expect(input).toHaveValue('B');
  await user.click(save); expect(await dialog.findByRole('alert')).toHaveTextContent('1 a 10');
  let resolve; patch.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
  await user.dblClick(save); expect(patch).toHaveBeenCalledTimes(3); expect(input).toBeDisabled();
  resolve(await api.get(`/models/${id}/`));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

it('mock mirrors archived, invalid and foreign-tenant errors without changing data', async () => {
  await mount();
  cleanup();
  await expect(updateModel(id, { label: 'A-' })).rejects.toMatchObject({ status: 400 });
  db.courses.find((c) => c.id === 'c-2627').is_active = false;
  await expect(updateModel(id, { label: 'B' })).rejects.toMatchObject({ code: 'COURSE_ARCHIVED' });
  db.exams.find((e) => e.id === 'e-prg-pr1').organization_id = 'foreign';
  await expect(updateModel(id, { label: 'B' })).rejects.toMatchObject({ status: 404 });
  expect(db.models.find((m) => m.id === id).label).toBe('A');
});
