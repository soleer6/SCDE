import { beforeEach, expect, it, vi, afterEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../../lib/api/client.js';
import { db } from '../../lib/mock/db.js';
import { loginAs, renderPage, resetDemo } from './test-utils.jsx';
import CoursesPage from './CoursesPage.jsx';
import UsersPage from './UsersPage.jsx';
import AuditPage from './AuditPage.jsx';

beforeEach(async () => { await resetDemo(); await loginAs(); });
afterEach(() => vi.restoreAllMocks());

it('lists historical courses, searches on the server and paginates', async () => {
  db.courses.push(...Array.from({ length: 26 }, (_, i) => ({ ...db.courses[1], id: `old-${i}`, label: `History ${i}` })));
  const user = userEvent.setup(); renderPage(<CoursesPage />);
  await screen.findByText('2025-2026');
  await user.click(screen.getByRole('button', { name: 'Siguiente' }));
  await screen.findByText('History 25');
  fireEvent.change(screen.getByLabelText('Buscar cursos'), { target: { value: '2026-2027' } });
  await user.click(screen.getByRole('button', { name: 'Buscar' }));
  await screen.findByText('2026-2027');
  expect(screen.queryByText('2025-2026')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
});

it('uses only documented users parameters and filters the current page locally', async () => {
  const get = vi.spyOn(api, 'get');
  const user = userEvent.setup(); renderPage(<UsersPage />);
  await screen.findByText('admin@uam.es');
  fireEvent.change(screen.getByLabelText('Buscar usuarios'), { target: { value: 'maria' } });
  await user.click(screen.getByRole('button', { name: 'Buscar' }));
  expect(screen.queryByText('admin@uam.es')).not.toBeInTheDocument();
  expect(get.mock.calls.filter(([path]) => path === '/users/')).toEqual([['/users/', { page: 1, page_size: '25' }]]);
  await user.selectOptions(screen.getByLabelText('Registros por página'), '50');
  await waitFor(() => expect(get).toHaveBeenLastCalledWith('/users/', { page: 1, page_size: '50' }));
});

it('filters audit events before pagination and clears all filters', async () => {
  db.audit_logs = Array.from({ length: 30 }, (_, i) => ({ id: `audit-${i}`, event_type: i === 29 ? 'TARGET' : 'OTHER', actor: 'u-admin', actor_email: 'admin@uam.es', entity_type: 'user', entity_id: 'u-javier', ip_address: '127.0.0.1', timestamp: '2026-10-17T10:00:00Z', payload: {} }));
  const user = userEvent.setup(); renderPage(<AuditPage />);
  await screen.findAllByText('OTHER');
  fireEvent.change(screen.getByLabelText('Evento'), { target: { value: 'TARGET' } });
  await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
  await screen.findByText('TARGET');
  expect(screen.queryByText('OTHER')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
  await screen.findAllByText('OTHER');
});

it('combines every documented audit filter, including dates', async () => {
  const base = { id: 'a', event_type: 'UPDATE', actor: 'u-admin', actor_email: 'admin@uam.es', entity_type: 'user', entity_id: 'u-javier', ip_address: '127.0.0.1', timestamp: '2026-10-17T10:00:00Z', payload: {} };
  db.audit_logs = [base, { ...base, id: 'b', ip_address: '10.0.0.1' }, { ...base, id: 'c', timestamp: '2026-10-16T10:00:00Z' }];
  const data = await api.get('/audit-logs/', { actor_id: 'u-admin', event_type: 'UPDATE', entity_type: 'user', entity_id: 'u-javier', ip_address: '127.0.0.1', timestamp_from: '2026-10-17T00:00:00Z', timestamp_to: '2026-10-17T23:59:59Z', page_size: 1 });
  expect(data.count).toBe(1); expect(data.results[0].id).toBe('a');
});
