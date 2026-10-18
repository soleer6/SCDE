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

it('retries the same course search with Enter after a request failure', async () => {
  const user = userEvent.setup(); renderPage(<CoursesPage />);
  await screen.findByText('2025-2026');
  const get = vi.spyOn(api, 'get');
  get.mockRejectedValueOnce(new Error('Temporary network failure'));
  const search = screen.getByRole('textbox', { name: 'Buscar cursos' });
  await user.click(search);
  await user.type(search, '2026-2027{Enter}');
  await screen.findByRole('button', { name: 'Reintentar' });
  expect(screen.queryByText('2026-2027')).not.toBeInTheDocument();
  expect(search).toHaveValue('2026-2027');
  await user.click(search);
  await user.keyboard('{Enter}');
  await screen.findByText('2026-2027');
  expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
  expect(screen.queryByText('2025-2026')).not.toBeInTheDocument();
  expect(get.mock.calls).toEqual([
    ['/search/', { page: 1, search: '2026-2027' }],
    ['/search/', { page: 1, search: '2026-2027' }],
  ]);
  expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
  expect(db.courses).toHaveLength(2);
});

it('uses only documented users parameters and filters the current page locally', async () => {
  db.users.push(...Array.from({ length: 26 }, (_, i) => ({ ...db.users[0], id: `extra-${i}`, email: `extra${i}@uam.es`, is_staff: false })));
  const get = vi.spyOn(api, 'get');
  const user = userEvent.setup(); renderPage(<UsersPage />);
  await screen.findByText('admin@uam.es');
  fireEvent.change(screen.getByLabelText('Buscar usuarios'), { target: { value: 'maria' } });
  await user.click(screen.getByRole('button', { name: 'Buscar' }));
  expect(screen.queryByText('admin@uam.es')).not.toBeInTheDocument();
  expect(get.mock.calls.filter(([path]) => path === '/users/')).toEqual([['/users/', { page: 1, page_size: '25' }]]);
  await user.click(screen.getByRole('button', { name: 'Siguiente' }));
  await screen.findByText(/Página 2 de 2/);
  fireEvent.change(screen.getByLabelText('Buscar usuarios'), { target: { value: 'extra25' } });
  await user.click(screen.getByRole('button', { name: 'Buscar' }));
  await screen.findByText('extra25@uam.es');
  expect(get).toHaveBeenLastCalledWith('/users/', { page: 2, page_size: '25' });
  await user.selectOptions(screen.getByLabelText('Registros por página'), '50');
  await waitFor(() => expect(get).toHaveBeenLastCalledWith('/users/', { page: 1, page_size: '50' }));
});

it('recovers a failed users page with keyboard retry and preserves the local search', async () => {
  db.users.push(...Array.from({ length: 26 }, (_, i) => ({ ...db.users[0], id: `extra-${i}`, email: `extra${i}@uam.es`, is_staff: false })));
  const originalUsers = structuredClone(db.users);
  const user = userEvent.setup(); renderPage(<UsersPage />);
  await screen.findByText('admin@uam.es');
  const search = screen.getByLabelText('Buscar usuarios');
  await user.type(search, 'extra25{Enter}');
  const get = vi.spyOn(api, 'get');
  get.mockRejectedValueOnce(new Error('Temporary network failure'));
  await user.click(screen.getByRole('button', { name: 'Siguiente' }));
  expect((await screen.findByRole('alert')).parentElement).toHaveFocus();
  expect(screen.queryByText('extra25@uam.es')).not.toBeInTheDocument();
  expect(search).toHaveValue('extra25');
  await user.tab();
  expect(screen.getByRole('button', { name: 'Reintentar' })).toHaveFocus();
  get.mockRejectedValueOnce(new Error('Temporary network failure'));
  await user.keyboard('{Enter}');
  expect((await screen.findByRole('alert')).parentElement).toHaveFocus();
  await user.tab();
  await user.keyboard('{Enter}');
  expect(await screen.findByText('extra25@uam.es')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByText(/Página 2 de 2/)).toBeInTheDocument();
  expect(search).toHaveValue('extra25');
  expect(get.mock.calls).toEqual(Array.from({ length: 3 }, () => ['/users/', { page: 2, page_size: '25' }]));
  expect(db.users).toEqual(originalUsers);
}, 15000);

it('recovers a failed audit page with keyboard retry and preserves server filters', async () => {
  const template = db.audit_logs[0];
  db.audit_logs = Array.from({ length: 26 }, (_, i) => ({ ...template, id: `audit-${i}`, event_type: 'TARGET', entity_id: `entity-${i}` }));
  const originalAudit = structuredClone(db.audit_logs);
  const user = userEvent.setup(); renderPage(<AuditPage />);
  await screen.findByText('entity-0');
  const event = screen.getByLabelText('Evento');
  await user.type(event, 'TARGET');
  await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
  await screen.findByText('entity-0');
  const get = vi.spyOn(api, 'get');
  get.mockRejectedValueOnce(new Error('Temporary network failure'));
  await user.click(screen.getByRole('button', { name: 'Siguiente' }));
  expect((await screen.findByRole('alert')).parentElement).toHaveFocus();
  expect(screen.queryByText('entity-0')).not.toBeInTheDocument();
  expect(event).toHaveValue('TARGET');
  await user.tab();
  expect(screen.getByRole('button', { name: 'Reintentar' })).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(await screen.findByText('entity-25')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByText(/Página 2 de 2/)).toBeInTheDocument();
  expect(event).toHaveValue('TARGET');
  expect(get.mock.calls).toEqual(Array.from({ length: 2 }, () => ['/audit-logs/', { page: 2, page_size: '25', event_type: 'TARGET' }]));
  expect(db.audit_logs).toEqual(originalAudit);
}, 15000);

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
