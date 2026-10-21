import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../../lib/api/client.js';
import { db } from '../../lib/mock/db.js';
import { loginAs, renderPage, resetDemo } from '../admin/test-utils.jsx';
import ProfilePage from './ProfilePage.jsx';

const { updateSession } = vi.hoisted(() => ({ updateSession: vi.fn() }));
vi.mock('../../lib/auth/AuthProvider.jsx', async (importOriginal) => {
  const original = await importOriginal();
  return { ...original, useAuth: () => ({ ...original.useAuth(), updateSession }) };
});

beforeEach(async () => { updateSession.mockClear(); await resetDemo(); await loginAs('elena.rodriguez@estudiante.uam.es', 'est123'); });
it('updates only the allowed profile fields for a student', async () => {
  const user = userEvent.setup(); renderPage(<ProfilePage />);
  const input = await screen.findByLabelText('Email');
  expect(input).not.toHaveFocus();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  fireEvent.change(input, { target: { value: 'elena.nueva@uam.es' } });
  await user.click(screen.getByLabelText('Recibir notificaciones por email'));
  const patch = api.patch.bind(api);
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const pendingPatch = vi.spyOn(api, 'patch').mockImplementationOnce(async (...args) => {
    await gate;
    return patch(...args);
  });
  try {
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(pendingPatch).toHaveBeenCalledWith('/profile/', { email: 'elena.nueva@uam.es', email_notifications_enabled: false });
    expect(input).toBeDisabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(db.users.find((u) => u.id === 'u-elena').email).toBe('elena.rodriguez@estudiante.uam.es');
    expect(updateSession).not.toHaveBeenCalled();
    release();
    const saved = await screen.findByRole('status');
    expect(saved).toHaveTextContent('Cambios guardados');
    expect(updateSession).toHaveBeenCalledExactlyOnceWith({ email: 'elena.nueva@uam.es' });
    await waitFor(() => expect(saved).toHaveFocus());
    await user.tab();
    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveFocus();
    await user.click(screen.getByLabelText('Recibir notificaciones por email'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  } finally {
    release();
    pendingPatch.mockRestore();
  }
  expect(db.users.find((u) => u.id === 'u-elena')).toMatchObject({ email: 'elena.nueva@uam.es', email_notifications_enabled: false, first_name: 'Elena', is_staff: false });
  expect(await api.get('/profile/')).not.toHaveProperty('password');
});

it('recovers repeated profile loading errors with keyboard retry and focuses the recovered form', async () => {
  const student = db.users.find((u) => u.id === 'u-elena');
  const original = structuredClone(student);
  student.is_active = false;
  const user = userEvent.setup(); renderPage(<ProfilePage />);
  const error = await screen.findByRole('alert');
  expect(error).toHaveTextContent('No tienes permiso para esta acción.');
  await waitFor(() => expect(error.parentElement).toHaveFocus());
  expect(screen.queryByRole('textbox', { name: 'Email' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
  await user.tab();
  expect(screen.getByRole('button', { name: 'Reintentar' })).toHaveFocus();
  await user.keyboard('{Enter}');
  const repeatedError = await screen.findByRole('alert');
  await waitFor(() => expect(repeatedError.parentElement).toHaveFocus());
  expect(student).toEqual({ ...original, is_active: false });
  student.is_active = true;
  await user.tab();
  await user.keyboard('{Enter}');
  const email = await screen.findByRole('textbox', { name: 'Email' });
  await waitFor(() => expect(email).toHaveFocus());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(email).toHaveValue(original.email);
  await user.tab();
  expect(screen.getByRole('checkbox', { name: 'Recibir notificaciones por email' })).toHaveFocus();
  await user.tab();
  expect(screen.getByRole('button', { name: 'Guardar' })).toHaveFocus();
  expect(student).toEqual(original);
});

it('focuses a rejected email and preserves preferences while correcting it with the keyboard', async () => {
  const user = userEvent.setup(); renderPage(<ProfilePage />);
  const email = await screen.findByLabelText('Email');
  const notifications = screen.getByRole('checkbox', { name: 'Recibir notificaciones por email' });
  expect(email).toHaveAttribute('autocomplete', 'email');
  await user.click(notifications);
  fireEvent.change(email, { target: { value: 'admin@uam.es' } });
  await user.click(screen.getByRole('button', { name: 'Guardar' }));
  await waitFor(() => expect(email).toHaveFocus());
  expect(email).toHaveAccessibleDescription('Ya existe un usuario con ese email.');
  expect(email).toHaveAttribute('aria-invalid', 'true');
  expect(notifications).not.toBeChecked();
  expect(db.users.find((u) => u.id === 'u-elena').email).toBe('elena.rodriguez@estudiante.uam.es');
  await user.clear(email);
  await user.type(email, 'elena.corregida@uam.es');
  await user.tab();
  expect(notifications).toHaveFocus();
  await user.tab();
  expect(screen.getByRole('button', { name: 'Guardar' })).toHaveFocus();
  await user.keyboard('{Enter}');
  const saved = await screen.findByRole('status');
  expect(saved).toHaveTextContent('Cambios guardados');
  await waitFor(() => expect(saved).toHaveFocus());
  await user.tab();
  expect(screen.getByRole('button', { name: 'Guardar' })).toHaveFocus();
  expect(email).not.toHaveAttribute('aria-invalid');
  expect(email).not.toHaveAttribute('aria-describedby');
  expect(db.users.find((u) => u.id === 'u-elena')).toMatchObject({ email: 'elena.corregida@uam.es', email_notifications_enabled: false });
});
