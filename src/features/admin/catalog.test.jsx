import { beforeEach, expect, it, vi, afterEach } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../../lib/api/client.js';
import { ApiError } from '../../lib/api/errors.js';
import { db } from '../../lib/mock/db.js';
import { loginAs, renderPage, resetDemo } from './test-utils.jsx';
import CoursesPage from './CoursesPage.jsx';
import UsersPage from './UsersPage.jsx';
import AuditPage from './AuditPage.jsx';

beforeEach(async () => { await resetDemo(); await loginAs(); });
afterEach(() => vi.restoreAllMocks());

it.each(['create', 'edit'])('keeps the course %s dialog open until saving settles and allows recovery', async (mode) => {
  const user = userEvent.setup(); renderPage(<CoursesPage />);
  const originalCourses = structuredClone(db.courses);
  const row = (await screen.findByText('2025-2026')).closest('tr');
  const results = screen.getByRole('region', { name: 'Cursos' });
  expect(results).not.toHaveFocus();
  const open = () => mode === 'create'
    ? user.click(screen.getByRole('button', { name: 'Crear curso' }))
    : user.click(within(row).getByRole('button', { name: 'Editar curso' }));
  await open();
  const dialogElement = screen.getByRole('dialog');
  const dialog = within(dialogElement);
  const label = 'Curso recuperado';
  const body = { label, start_date: '2027-09-01', end_date: '2028-06-30' };
  const fill = (scope) => {
    fireEvent.change(scope.getByLabelText('Nombre del curso'), { target: { value: label } });
    fireEvent.change(scope.getByLabelText('Fecha de inicio'), { target: { value: body.start_date } });
    fireEvent.change(scope.getByLabelText('Fecha de fin'), { target: { value: body.end_date } });
  };
  fill(dialog);
  let rejectSave;
  const request = new Promise((_, reject) => { rejectSave = reject; });
  const operation = vi.spyOn(api, mode === 'create' ? 'post' : 'patch').mockImplementationOnce(() => request);
  const path = mode === 'create' ? '/courses/' : `/courses/${originalCourses.find((c) => c.label === '2025-2026').id}/`;
  const form = dialog.getByRole('button', { name: 'Guardar' }).closest('form');
  // Closing in the submit cycle must also wait for the result, before any render.
  act(() => {
    fireEvent.submit(form);
    fireEvent.keyDown(window, { key: 'Escape' });
  });
  expect(screen.getByRole('dialog')).toBe(dialogElement);
  expect(form).toHaveAttribute('aria-busy', 'true');
  await user.keyboard('{Escape}');
  await user.click(dialog.getByRole('button', { name: /^(Close|Cerrar)$/ }));
  fireEvent.mouseDown(dialogElement.parentElement);
  expect(screen.getByRole('dialog')).toBe(dialogElement);
  expect(operation.mock.calls).toEqual([[path, body]]);
  expect(db.courses).toEqual(originalCourses);
  await act(async () => { rejectSave(new ApiError('PERMISSION_DENIED', 403)); });
  const error = await dialog.findByRole('alert');
  expect(error.parentElement).toHaveFocus();
  expect(dialog.getByLabelText('Nombre del curso')).toHaveValue(label);
  expect(dialog.getByLabelText('Fecha de inicio')).toHaveValue(body.start_date);
  expect(dialog.getByLabelText('Fecha de fin')).toHaveValue(body.end_date);
  expect(dialog.getByRole('button', { name: 'Guardar' })).toBeEnabled();
  // A failed save releases the close guard; a later dialog can save normally.
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await open();
  const retryDialog = within(screen.getByRole('dialog'));
  fill(retryDialog);
  const originalGet = api.get.bind(api);
  let releaseReload;
  const reloadGate = new Promise((resolve) => { releaseReload = resolve; });
  const get = vi.spyOn(api, 'get').mockImplementationOnce(async (...args) => {
    await reloadGate;
    return originalGet(...args);
  });
  await user.click(retryDialog.getByRole('button', { name: 'Guardar' }));
  await waitFor(() => expect(get).toHaveBeenCalledWith('/search/', { page: 1, search: '' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(results).not.toHaveFocus();
  await act(async () => { releaseReload(); });
  expect(await screen.findByText(label)).toBeInTheDocument();
  await waitFor(() => expect(results).toHaveFocus());
  await user.tab();
  expect(within(results).getAllByRole('button', { name: 'Editar curso' })[0]).toHaveFocus();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(operation.mock.calls).toEqual([[path, body], [path, body]]);
  expect(db.courses).toHaveLength(originalCourses.length + (mode === 'create' ? 1 : 0));
  const saved = db.courses.find((c) => c.label === label);
  expect(saved).toMatchObject({ ...body, is_active: mode === 'edit' ? originalCourses.find((c) => c.label === '2025-2026').is_active : false });
});

it('lists historical courses, searches on the server and paginates', async () => {
  db.courses.push(...Array.from({ length: 26 }, (_, i) => ({ ...db.courses[1], id: `old-${i}`, label: `History ${i}` })));
  const user = userEvent.setup(); renderPage(<CoursesPage />);
  await screen.findByText('2025-2026');
  const results = screen.getByRole('region', { name: 'Cursos' });
  expect(results).not.toHaveFocus();
  const originalGet = api.get.bind(api);
  let releasePage;
  const pageGate = new Promise((resolve) => { releasePage = resolve; });
  const get = vi.spyOn(api, 'get').mockImplementationOnce(async (...args) => {
    await pageGate;
    return originalGet(...args);
  });
  await user.click(screen.getByRole('button', { name: 'Siguiente' }));
  await waitFor(() => expect(get).toHaveBeenCalledWith('/search/', { page: 2, search: '' }));
  expect(results).not.toHaveFocus();
  expect(within(results).queryByRole('table')).not.toBeInTheDocument();
  await act(async () => { releasePage(); });
  await screen.findByText('History 25');
  await waitFor(() => expect(results).toHaveFocus());
  await user.tab();
  expect(within(results).getAllByRole('button', { name: 'Editar curso' })[0]).toHaveFocus();
  let releaseSearch;
  const searchGate = new Promise((resolve) => { releaseSearch = resolve; });
  get.mockImplementationOnce(async (...args) => {
    await searchGate;
    return originalGet(...args);
  });
  fireEvent.change(screen.getByLabelText('Buscar cursos'), { target: { value: '2026-2027' } });
  await user.click(screen.getByRole('button', { name: 'Buscar' }));
  await waitFor(() => expect(get).toHaveBeenLastCalledWith('/search/', { page: 1, search: '2026-2027' }));
  expect(results).not.toHaveFocus();
  await act(async () => { releaseSearch(); });
  await screen.findByText('2026-2027');
  await waitFor(() => expect(results).toHaveFocus());
  expect(screen.queryByText('2025-2026')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
  const search = screen.getByLabelText('Buscar cursos');
  await user.click(search);
  await user.keyboard('{Enter}');
  await waitFor(() => expect(results).toHaveFocus());
  expect(get).toHaveBeenLastCalledWith('/search/', { page: 1, search: '2026-2027' });
  fireEvent.change(search, { target: { value: 'missing' } });
  await user.click(screen.getByRole('button', { name: 'Buscar' }));
  await within(results).findByText('No hay registros');
  await waitFor(() => expect(results).toHaveFocus());
  await user.tab();
  expect(within(results).getByRole('button', { name: 'Crear curso' })).toHaveFocus();
});

it('retries the same course search with Enter after a request failure', async () => {
  const user = userEvent.setup(); renderPage(<CoursesPage />);
  await screen.findByText('2025-2026');
  const results = screen.getByRole('region', { name: 'Cursos' });
  const get = vi.spyOn(api, 'get');
  get.mockRejectedValueOnce(new Error('Temporary network failure'));
  const search = screen.getByRole('textbox', { name: 'Buscar cursos' });
  await user.click(search);
  await user.type(search, '2026-2027{Enter}');
  await screen.findByRole('button', { name: 'Reintentar' });
  expect(screen.getByRole('alert').parentElement).toHaveFocus();
  expect(screen.queryByText('2026-2027')).not.toBeInTheDocument();
  expect(search).toHaveValue('2026-2027');
  await user.click(search);
  await user.keyboard('{Enter}');
  await screen.findByText('2026-2027');
  await waitFor(() => expect(results).toHaveFocus());
  expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
  expect(screen.queryByText('2025-2026')).not.toBeInTheDocument();
  expect(get.mock.calls).toEqual([
    ['/search/', { page: 1, search: '2026-2027' }],
    ['/search/', { page: 1, search: '2026-2027' }],
  ]);
  expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
  expect(db.courses).toHaveLength(2);
  // An error discards the query destination; generic retry returns to search.
  get.mockRejectedValueOnce(new Error('Temporary network failure'));
  await user.click(search);
  await user.keyboard('{Enter}');
  expect((await screen.findByRole('alert')).parentElement).toHaveFocus();
  await user.tab();
  expect(screen.getByRole('button', { name: 'Reintentar' })).toHaveFocus();
  await user.keyboard('{Enter}');
  await screen.findByText('2026-2027');
  await waitFor(() => expect(search).toHaveFocus());
  expect(search).toHaveValue('2026-2027');
  expect(results).not.toHaveFocus();
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
  await waitFor(() => expect(search).toHaveFocus());
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
  expect(event).not.toHaveFocus();
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
  get.mockRejectedValueOnce(new Error('Temporary network failure'));
  await user.keyboard('{Enter}');
  expect((await screen.findByRole('alert')).parentElement).toHaveFocus();
  await user.tab();
  expect(screen.getByRole('button', { name: 'Reintentar' })).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(await screen.findByText('entity-25')).toBeInTheDocument();
  await waitFor(() => expect(event).toHaveFocus());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByText(/Página 2 de 2/)).toBeInTheDocument();
  expect(event).toHaveValue('TARGET');
  expect(get.mock.calls).toEqual(Array.from({ length: 3 }, () => ['/audit-logs/', { page: 2, page_size: '25', event_type: 'TARGET' }]));
  expect(db.audit_logs).toEqual(originalAudit);
}, 15000);

it('filters audit events before pagination and clears all filters', async () => {
  db.audit_logs = Array.from({ length: 30 }, (_, i) => ({ id: `audit-${i}`, event_type: i === 29 ? 'TARGET' : 'OTHER', actor: 'u-admin', actor_email: 'admin@uam.es', entity_type: 'user', entity_id: 'u-javier', ip_address: '127.0.0.1', timestamp: '2026-10-17T10:00:00Z', payload: {} }));
  const user = userEvent.setup(); renderPage(<AuditPage />);
  await screen.findAllByText('OTHER');
  const results = screen.getByRole('region', { name: 'Registro de auditoría' });
  expect(results).not.toHaveFocus();
  await user.click(screen.getByRole('button', { name: 'Siguiente' }));
  await screen.findByText(/Página 2 de 2/);
  await waitFor(() => expect(results).toHaveFocus());
  await user.tab();
  expect(within(results).getAllByRole('row')[1]).toHaveFocus();
  fireEvent.change(screen.getByLabelText('Evento'), { target: { value: 'TARGET' } });
  const originalGet = api.get.bind(api);
  let releaseFilter;
  const filterGate = new Promise((resolve) => { releaseFilter = resolve; });
  const get = vi.spyOn(api, 'get').mockImplementationOnce(async (...args) => {
    await filterGate;
    return originalGet(...args);
  });
  await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
  await waitFor(() => expect(get).toHaveBeenCalledWith('/audit-logs/', { page: 1, page_size: '25', event_type: 'TARGET' }));
  expect(results).not.toHaveFocus();
  expect(within(results).queryByRole('table')).not.toBeInTheDocument();
  await act(async () => { releaseFilter(); });
  await screen.findByText('TARGET');
  await waitFor(() => expect(results).toHaveFocus());
  expect(screen.queryByText('OTHER')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
  await user.tab();
  expect(within(results).getAllByRole('row')[1]).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(await screen.findByRole('dialog')).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(within(results).getAllByRole('row')[1]).toHaveFocus();
  fireEvent.change(screen.getByLabelText('Evento'), { target: { value: 'MISSING' } });
  await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
  await within(results).findByText('No hay registros');
  await waitFor(() => expect(results).toHaveFocus());
  await user.tab();
  expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
  await screen.findAllByText('OTHER');
  await waitFor(() => expect(results).toHaveFocus());
  expect(screen.getByLabelText('Evento')).toHaveValue('');
  expect(screen.getByText(/Página 1 de 2/)).toBeInTheDocument();
});

it('combines every documented audit filter, including dates', async () => {
  const base = { id: 'a', event_type: 'UPDATE', actor: 'u-admin', actor_email: 'admin@uam.es', entity_type: 'user', entity_id: 'u-javier', ip_address: '127.0.0.1', timestamp: '2026-10-17T10:00:00Z', payload: {} };
  db.audit_logs = [base, { ...base, id: 'b', ip_address: '10.0.0.1' }, { ...base, id: 'c', timestamp: '2026-10-16T10:00:00Z' }];
  const data = await api.get('/audit-logs/', { actor_id: 'u-admin', event_type: 'UPDATE', entity_type: 'user', entity_id: 'u-javier', ip_address: '127.0.0.1', timestamp_from: '2026-10-17T00:00:00Z', timestamp_to: '2026-10-17T23:59:59Z', page_size: 1 });
  expect(data.count).toBe(1); expect(data.results[0].id).toBe('a');
});
