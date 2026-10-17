import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api } from '../../lib/api/client.js';
import { db } from '../../lib/mock/db.js';
import { loginAs, renderPage, resetDemo } from '../admin/test-utils.jsx';
import NotificationsPage from './NotificationsPage.jsx';
import NotificationsBell from './NotificationsBell.jsx';

beforeEach(async () => { await resetDemo(); await loginAs('elena.rodriguez@estudiante.uam.es', 'est123'); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
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
it('shows an empty list for an account with no notifications', async () => {
  await loginAs(); renderPage(<NotificationsPage />);
  await waitFor(() => expect(screen.getByText('No tienes notificaciones')).toBeInTheDocument());
});
