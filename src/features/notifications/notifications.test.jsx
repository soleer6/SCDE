import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api } from '../../lib/api/client.js';
import { ApiError } from '../../lib/api/errors.js';
import { useAuth } from '../../lib/auth/AuthProvider.jsx';
import { db } from '../../lib/mock/db.js';
import { loginAs, renderPage, resetDemo } from '../admin/test-utils.jsx';
import NotificationsPage from './NotificationsPage.jsx';
import NotificationsBell from './NotificationsBell.jsx';

beforeEach(async () => { await resetDemo(); await loginAs('elena.rodriguez@estudiante.uam.es', 'est123'); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function SessionControls() {
  const { login, logout } = useAuth();
  return <>
    <button onClick={() => login('admin@uam.es', 'admin123')}>Cambiar cuenta</button>
    <button onClick={logout}>Cerrar sesión</button>
  </>;
}

it.each(['success', 'failure'])('cleans up a pending count on unmount and isolates a remounted bell from its late %s', async (outcome) => {
  const previous = deferred(), current = deferred();
  const visible = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  const get = vi.spyOn(api, 'get').mockReturnValueOnce(previous.promise).mockReturnValueOnce(current.promise);
  vi.useFakeTimers();
  const first = renderPage(<NotificationsBell />);
  expect(get).toHaveBeenCalledTimes(1);
  first.unmount();
  act(() => {
    window.dispatchEvent(new Event('scde:notifications-read'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await act(async () => { await vi.advanceTimersByTimeAsync(120000); });
  expect(get).toHaveBeenCalledTimes(1);

  const second = renderPage(<NotificationsBell />);
  expect(get).toHaveBeenCalledTimes(2);
  await act(async () => { current.resolve({ unread_count: 1 }); });
  const bell = screen.getByRole('link', { name: '1 notificación sin leer' });
  bell.focus();
  await act(async () => {
    if (outcome === 'success') previous.resolve({ unread_count: 99 });
    else previous.reject(new Error('Failure after unmount'));
  });
  expect(bell).toHaveAccessibleName('1 notificación sin leer');
  expect(bell).toHaveFocus();
  get.mockResolvedValue({ unread_count: 0 });
  act(() => window.dispatchEvent(new Event('scde:notifications-read')));
  await act(async () => {});
  expect(get).toHaveBeenCalledTimes(3);
  expect(bell).toHaveAccessibleName('0 notificaciones sin leer');
  second.unmount();
  act(() => {
    visible.mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    visible.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('scde:notifications-read'));
  });
  await act(async () => { await vi.advanceTimersByTimeAsync(120000); });
  expect(get).toHaveBeenCalledTimes(3);
});

it.each(['success', 'failure'])('ignores a stale count %s after a newer refresh has completed', async (outcome) => {
  const first = deferred(), latest = deferred();
  vi.spyOn(api, 'get').mockReturnValueOnce(first.promise).mockReturnValueOnce(latest.promise);
  renderPage(<NotificationsBell />);
  act(() => window.dispatchEvent(new Event('scde:notifications-read')));
  await act(async () => { latest.resolve({ unread_count: 1 }); });
  const bell = screen.getByRole('link', { name: '1 notificación sin leer' });
  bell.focus();
  await act(async () => {
    if (outcome === 'success') first.resolve({ unread_count: 2 });
    else first.reject(new Error('Late failure'));
  });
  expect(bell).toHaveAccessibleName('1 notificación sin leer');
  expect(bell).toHaveFocus();
});

it('clears the previous account count while loading a new session and ignores pending responses after logout', async () => {
  const user = userEvent.setup();
  const get = vi.spyOn(api, 'get');
  renderPage(<><SessionControls /><NotificationsBell /></>);
  await screen.findByRole('link', { name: '2 notificaciones sin leer' });
  const previous = deferred(), next = deferred(), afterLogout = deferred();
  get.mockReturnValueOnce(previous.promise).mockReturnValueOnce(next.promise).mockReturnValueOnce(afterLogout.promise);
  act(() => window.dispatchEvent(new Event('scde:notifications-read')));
  await user.click(screen.getByRole('button', { name: 'Cambiar cuenta' }));
  await screen.findByRole('link', { name: 'Consultar notificaciones; recuento no disponible' });
  await act(async () => { previous.resolve({ unread_count: 2 }); });
  expect(screen.getByRole('link', { name: 'Consultar notificaciones; recuento no disponible' })).toHaveTextContent('—');
  await act(async () => { next.resolve({ unread_count: 0 }); });
  await screen.findByRole('link', { name: '0 notificaciones sin leer' });
  act(() => window.dispatchEvent(new Event('scde:notifications-read')));
  await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
  await screen.findByRole('link', { name: 'Consultar notificaciones; recuento no disponible' });
  const calls = get.mock.calls.length;
  await act(async () => { afterLogout.resolve({ unread_count: 5 }); });
  act(() => window.dispatchEvent(new Event('scde:notifications-read')));
  expect(get).toHaveBeenCalledTimes(calls);
  expect(screen.getByRole('link', { name: 'Consultar notificaciones; recuento no disponible' })).toHaveTextContent('—');
});
it('marks the current page and updates the bell, without touching another user', async () => {
  const user = userEvent.setup(); renderPage(<><NotificationsBell /><NotificationsPage /></>);
  await screen.findByRole('link', { name: '2 notificaciones sin leer' });
  await screen.findByText('Notas publicadas');
  await user.click(screen.getByRole('button', { name: 'Marcar esta página como leída' }));
  expect(await screen.findByRole('link', { name: '0 notificaciones sin leer' })).toBeInTheDocument();
  expect(db.notifications.find((n) => n.id === 'n-3').status).toBe('UNREAD');
  expect((await api.get('/notifications/')).results[0]).not.toHaveProperty('user_id');
});
it('does not mark a notification owned by another user', async () => {
  expect(await api.patch('/notifications/read/', { notification_ids: ['n-3'] })).toEqual({ marked_read: 0 });
});
it.each([
  ['una notificación', 'Marcar como leída: Notas publicadas', ['n-1'], '1 notificación sin leer'],
  ['la página', 'Marcar esta página como leída', ['n-2', 'n-1'], '0 notificaciones sin leer'],
])('marks %s once while pending and retries the original selection after failure', async (_label, action, ids, count) => {
  renderPage(<><NotificationsBell /><NotificationsPage /></>);
  await screen.findByRole('link', { name: '2 notificaciones sin leer' });
  const trigger = await screen.findByRole('button', { name: action });
  const other = screen.getByRole('button', { name: 'Marcar como leída: Revisión abierta' });
  const original = structuredClone(db.notifications);
  const pending = deferred();
  const patch = vi.spyOn(api, 'patch').mockReturnValueOnce(pending.promise);
  try {
    act(() => { trigger.click(); trigger.click(); other.click(); });
    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch).toHaveBeenLastCalledWith('/notifications/read/', { notification_ids: ids });
    expect(trigger).toBeDisabled();
    expect(other).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Marcar esta página como leída' })).toHaveAttribute('aria-busy', 'true');
    act(() => { trigger.click(); other.click(); });
    expect(patch).toHaveBeenCalledTimes(1);
    expect(db.notifications).toEqual(original);
    expect(screen.getByRole('link', { name: '2 notificaciones sin leer' })).toBeInTheDocument();

    await act(async () => { pending.reject(new ApiError('PERMISSION_DENIED', 403)); });
    const error = await screen.findByRole('alert');
    await waitFor(() => expect(error.parentElement).toHaveFocus());
    expect(error).toHaveTextContent('No tienes permiso para esta acción.');
    expect(trigger).toBeEnabled();
    expect(other).toBeEnabled();
    expect(db.notifications).toEqual(original);
    const retry = screen.getByRole('button', { name: 'Reintentar' });
    act(() => { retry.click(); retry.click(); other.click(); });
    await screen.findByRole('link', { name: count });
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('region', { name: 'Notificaciones' })).toHaveFocus());
    expect(patch).toHaveBeenCalledTimes(2);
    expect(patch).toHaveBeenLastCalledWith('/notifications/read/', { notification_ids: ids });
    for (const notification of original) {
      expect(db.notifications.find((n) => n.id === notification.id)).toEqual({
        ...notification, status: ids.includes(notification.id) ? 'READ' : notification.status,
      });
    }
    expect(screen.getByRole('button', { name: 'Marcar esta página como leída' })).not.toHaveAttribute('aria-busy', 'true');
  } finally { patch.mockRestore(); }
});
it.each([
  ['una notificación', 'Marcar como leída: Notas publicadas', ['n-1'], '1 notificación sin leer'],
  ['la página', 'Marcar esta página como leída', ['n-1', 'n-2'], '0 notificaciones sin leer'],
])('retries marking %s after repeated permission errors with the original selection', async (_label, action, ids, count) => {
  const user = userEvent.setup();
  renderPage(<><NotificationsBell /><NotificationsPage /></>);
  await screen.findByRole('link', { name: '2 notificaciones sin leer' });
  await screen.findByRole('button', { name: 'Marcar como leída: Notas publicadas' });
  const original = structuredClone(db.notifications);
  const student = db.users.find((u) => u.id === 'u-elena');
  student.is_active = false;
  const trigger = screen.getByRole('button', { name: action });
  trigger.focus();
  await user.keyboard('{Enter}');
  const error = await screen.findByRole('alert');
  expect(error).toHaveTextContent('No tienes permiso para esta acción.');
  await waitFor(() => expect(error.parentElement).toHaveFocus());
  expect(screen.getByRole('table')).toBeInTheDocument();
  expect(db.notifications).toEqual(original);
  await user.tab();
  expect(screen.getByRole('button', { name: 'Reintentar' })).toHaveFocus();
  await user.keyboard('{Enter}');
  const repeatedError = await screen.findByRole('alert');
  await waitFor(() => expect(repeatedError.parentElement).toHaveFocus());
  expect(db.notifications).toEqual(original);
  expect(screen.getByRole('link', { name: '2 notificaciones sin leer' })).toBeInTheDocument();
  student.is_active = true;
  await user.tab();
  expect(screen.getByRole('button', { name: 'Reintentar' })).toHaveFocus();
  await user.keyboard('{Enter}');
  await screen.findByRole('link', { name: count });
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  await waitFor(() => expect(screen.getByRole('region', { name: 'Notificaciones' })).toHaveFocus());
  for (const notification of original) {
    expect(db.notifications.find((n) => n.id === notification.id)).toEqual({
      ...notification, status: ids.includes(notification.id) ? 'READ' : notification.status,
    });
  }
  for (const id of ids) {
    const notification = original.find((n) => n.id === id);
    expect(screen.queryByRole('button', { name: `Marcar como leída: ${notification.title}` })).not.toBeInTheDocument();
  }
});
it.each(['unread', 'read', 'empty'])('restores focus after repeated notification loading errors (%s) without changing statuses', async (mode) => {
  const student = db.users.find((u) => u.id === 'u-elena');
  if (mode === 'read') db.notifications.forEach((n) => { if (n.user_id === student.id) n.status = 'READ'; });
  if (mode === 'empty') db.notifications = db.notifications.filter((n) => n.user_id !== student.id);
  const original = structuredClone(db.notifications);
  student.is_active = false;
  const user = userEvent.setup(); renderPage(<NotificationsPage />);
  const error = await screen.findByRole('alert');
  expect(error).toHaveTextContent('No tienes permiso para esta acción.');
  await waitFor(() => expect(error.parentElement).toHaveFocus());
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Marcar esta página como leída' })).toBeDisabled();
  await user.tab();
  expect(screen.getByRole('button', { name: 'Reintentar' })).toHaveFocus();
  await user.keyboard('{Enter}');
  const repeatedError = await screen.findByRole('alert');
  await waitFor(() => expect(repeatedError.parentElement).toHaveFocus());
  expect(db.notifications).toEqual(original);
  student.is_active = true;
  await user.tab();
  expect(screen.getByRole('button', { name: 'Reintentar' })).toHaveFocus();
  await user.keyboard('{Enter}');
  if (mode === 'empty') await screen.findByText('No tienes notificaciones');
  else await screen.findByRole('table');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(document.body).not.toHaveFocus();
  const results = screen.getByRole('region', { name: 'Notificaciones' });
  await waitFor(() => expect(results).toHaveFocus());
  expect(screen.getByRole('button', { name: 'Marcar esta página como leída' }).disabled).toBe(mode !== 'unread');
  if (mode !== 'read') {
    await user.tab();
    expect(screen.getByRole('button', { name: mode === 'empty' ? 'Actualizar' : 'Marcar como leída: Revisión abierta' })).toHaveFocus();
  }
  expect(db.notifications).toEqual(original);
});
it('identifies individual read actions by title and activates only the selected notification with the keyboard', async () => {
  const user = userEvent.setup(); renderPage(<><NotificationsBell /><NotificationsPage /></>);
  const grades = await screen.findByRole('button', { name: 'Marcar como leída: Notas publicadas' });
  expect(screen.getByRole('region', { name: 'Notificaciones' })).not.toHaveFocus();
  expect(screen.getByRole('button', { name: 'Marcar como leída: Revisión abierta' })).toBeEnabled();
  grades.focus();
  await user.keyboard('{Enter}');
  await screen.findByRole('link', { name: '1 notificación sin leer' });
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Marcar como leída: Notas publicadas' })).not.toBeInTheDocument());
  await waitFor(() => expect(screen.getByRole('region', { name: 'Notificaciones' })).toHaveFocus());
  await user.tab();
  expect(screen.getByRole('button', { name: 'Marcar como leída: Revisión abierta' })).toHaveFocus();
  expect(screen.getByRole('button', { name: 'Marcar como leída: Revisión abierta' })).toBeEnabled();
  expect(db.notifications.find((n) => n.id === 'n-1').status).toBe('READ');
  expect(db.notifications.find((n) => n.id === 'n-2').status).toBe('UNREAD');
  expect(db.notifications.find((n) => n.id === 'n-3').status).toBe('UNREAD');
});
it('stops polling while hidden and refreshes on becoming visible', async () => {
  const get = vi.spyOn(api, 'get');
  const visible = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  const view = renderPage(<NotificationsBell />);
  await screen.findByRole('link', { name: '2 notificaciones sin leer' });
  vi.useFakeTimers();
  visible.mockReturnValue(true);
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  const calls = get.mock.calls.length;
  await act(async () => { await vi.advanceTimersByTimeAsync(120000); });
  expect(get).toHaveBeenCalledTimes(calls);
  visible.mockReturnValue(false);
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(get).toHaveBeenCalledTimes(calls + 1);
  view.unmount();
  await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
  expect(get).toHaveBeenCalledTimes(calls + 1);
  vi.useRealTimers(); vi.restoreAllMocks();
});
it.each([true, false])('recovers the bell after repeated count errors (initial failure: %s) without reporting a false zero', async (initialFailure) => {
  const student = db.users.find((u) => u.id === 'u-elena');
  const original = structuredClone(db.notifications);
  const visible = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  const get = vi.spyOn(api, 'get');
  student.is_active = !initialFailure;
  vi.useFakeTimers();
  const view = renderPage(<NotificationsBell />);
  await act(async () => { await vi.advanceTimersByTimeAsync(500); });
  const bell = screen.getByRole('link', { name: initialFailure ? 'Consultar notificaciones; recuento no disponible' : '2 notificaciones sin leer' });
  bell.focus();
  student.is_active = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    await act(async () => { await vi.advanceTimersByTimeAsync(60500); });
    expect(screen.getByRole('link', { name: 'Consultar notificaciones; recuento no disponible' })).toHaveTextContent('—');
    expect(screen.queryByRole('link', { name: '0 notificaciones sin leer' })).not.toBeInTheDocument();
    expect(bell).toHaveFocus();
    expect(db.notifications).toEqual(original);
  }
  visible.mockReturnValue(true);
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  const calls = get.mock.calls.length;
  student.is_active = true;
  await act(async () => { await vi.advanceTimersByTimeAsync(120000); });
  expect(get).toHaveBeenCalledTimes(calls);
  expect(bell).toHaveAccessibleName('Consultar notificaciones; recuento no disponible');
  visible.mockReturnValue(false);
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  await act(async () => { await vi.advanceTimersByTimeAsync(500); });
  expect(get).toHaveBeenCalledTimes(calls + 1);
  expect(bell).toHaveAccessibleName('2 notificaciones sin leer');
  expect(bell).toHaveAttribute('href', '/notifications');
  expect(bell).toHaveFocus();
  expect(db.notifications).toEqual(original);
  view.unmount();
  await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
  expect(get).toHaveBeenCalledTimes(calls + 1);
});
it('shows an empty list for an account with no notifications', async () => {
  await loginAs(); renderPage(<NotificationsPage />);
  await waitFor(() => expect(screen.getByText('No tienes notificaciones')).toBeInTheDocument());
});

it('focuses new notification pages only after loading and recovers a page error with the keyboard', async () => {
  const template = db.notifications.find((n) => n.user_id === 'u-elena');
  db.notifications = Array.from({ length: 26 }, (_, i) => ({ ...template, id: `notice-${i}`, title: `Aviso ${i}` }));
  const original = structuredClone(db.notifications);
  const user = userEvent.setup();
  renderPage(<NotificationsPage />);
  await screen.findByRole('button', { name: 'Marcar como leída: Aviso 0' });
  const results = screen.getByRole('region', { name: 'Notificaciones' });
  expect(results).not.toHaveFocus();
  const get = vi.spyOn(api, 'get');
  const nextPage = await api.get('/notifications/', { page: 2 });
  const pending = deferred();
  get.mockReturnValueOnce(pending.promise);
  screen.getByRole('button', { name: 'Siguiente' }).focus();
  await user.keyboard('{Enter}');
  expect(get).toHaveBeenLastCalledWith('/notifications/', { page: 2 });
  expect(results).not.toHaveFocus();
  await act(async () => { pending.resolve(nextPage); });
  await screen.findByRole('button', { name: 'Marcar como leída: Aviso 25' });
  await waitFor(() => expect(results).toHaveFocus());
  await user.tab();
  expect(screen.getByRole('button', { name: 'Marcar como leída: Aviso 25' })).toHaveFocus();
  get.mockRejectedValueOnce(new ApiError('PERMISSION_DENIED', 403));
  await user.click(screen.getByRole('button', { name: 'Anterior' }));
  const error = await screen.findByRole('alert');
  await waitFor(() => expect(error.parentElement).toHaveFocus());
  expect(results).not.toHaveFocus();
  await user.tab();
  expect(screen.getByRole('button', { name: 'Reintentar' })).toHaveFocus();
  await user.keyboard('{Enter}');
  await screen.findByRole('button', { name: 'Marcar como leída: Aviso 0' });
  await waitFor(() => expect(results).toHaveFocus());
  expect(get).toHaveBeenLastCalledWith('/notifications/', { page: 1 });
  expect(db.notifications).toEqual(original);
});

it('waits for fresh data before focusing an empty notification list after refresh', async () => {
  await loginAs();
  const user = userEvent.setup();
  renderPage(<NotificationsPage />);
  const refresh = await screen.findByRole('button', { name: 'Actualizar' });
  const results = screen.getByRole('region', { name: 'Notificaciones' });
  expect(results).not.toHaveFocus();
  const empty = await api.get('/notifications/', { page: 1 });
  const pending = deferred();
  vi.spyOn(api, 'get').mockReturnValueOnce(pending.promise);
  refresh.focus();
  await user.keyboard('{Enter}');
  expect(results).not.toHaveFocus();
  await act(async () => { pending.resolve(empty); });
  await screen.findByText('No tienes notificaciones');
  await waitFor(() => expect(results).toHaveFocus());
  await user.tab();
  expect(screen.getByRole('button', { name: 'Actualizar' })).toHaveFocus();
});
