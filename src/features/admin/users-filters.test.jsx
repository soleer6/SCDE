import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { fireEvent, screen, waitFor, within, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { AuthProvider } from '../../lib/auth/AuthProvider.jsx';
import { api } from '../../lib/api/client.js';
import { ApiError } from '../../lib/api/errors.js';
import { db } from '../../lib/mock/db.js';
import { loginAs, renderPage, resetDemo } from './test-utils.jsx';
import { downloadBlob } from './download.js';
import UsersPage from './UsersPage.jsx';

vi.mock('./download.js', () => ({ downloadBlob: vi.fn() }));
beforeEach(async () => {
  vi.stubGlobal('Blob', NodeBlob);
  vi.mocked(downloadBlob).mockClear();
  await resetDemo(); await loginAs();
  const template = db.users[0];
  db.users.push(...Array.from({ length: 31 }, (_, i) => ({ ...template, id: `lote-${i}`, first_name: 'Lote',
    last_name: i === 0 ? 'Coma, "Texto"' : `Persona ${i}`, email: `lote-${i}@example.test`, nia: `NIA-${i}`,
    is_staff: false, is_active: false, dni: i === 0 ? '12345678Z' : '',
  })), { ...template, id: 'active-lote', first_name: 'Lote', email: 'active@example.test', is_active: true, is_staff: false },
  { ...template, id: 'staff-lote', first_name: 'Lote', email: 'staff@example.test', is_active: false, is_staff: true },
  { ...template, id: 'foreign-lote', first_name: 'Lote', email: 'foreign@example.test', organization_id: 'foreign', is_active: false, is_staff: false });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('exports every filtered page in CSV/JSON with false criteria and ignores unapplied draft changes', async () => {
  const user = userEvent.setup(); renderPage(<UsersPage />);
  await screen.findByText('admin@uam.es');
  fireEvent.change(screen.getByLabelText('Buscar usuarios'), { target: { value: 'Lote' } });
  await user.selectOptions(screen.getByLabelText('Estado de cuenta'), 'false');
  await user.selectOptions(screen.getByLabelText('Tipo de usuario'), 'false');
  await user.click(screen.getByRole('button', { name: 'Buscar', exact: true }));
  await screen.findByText('Página 1 de 2 · 31 registros');
  await user.click(screen.getByRole('button', { name: 'Siguiente' }));
  await screen.findByText('Página 2 de 2 · 31 registros');
  const blob = vi.spyOn(api, 'blob');
  await user.selectOptions(screen.getByLabelText('Formato de exportación'), 'csv');
  await user.click(screen.getByRole('button', { name: 'Exportar usuarios' }));
  await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
  const csv = await downloadBlob.mock.calls[0][0].text();
  expect(csv).toContain('"Coma, ""Texto"""');
  expect(csv.trim().split('\r\n')).toHaveLength(32);
  expect(downloadBlob.mock.calls[0][1]).toBe('users.csv');
  expect(blob).toHaveBeenLastCalledWith('/users/export/', { search: 'Lote', is_active: 'false', is_staff: 'false', export_format: 'csv' });
  fireEvent.change(screen.getByLabelText('Buscar usuarios'), { target: { value: 'unapplied' } });
  await user.selectOptions(screen.getByLabelText('Formato de exportación'), 'json');
  await user.click(screen.getByRole('button', { name: 'Exportar usuarios' }));
  await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(2));
  const rows = JSON.parse(await downloadBlob.mock.calls[1][0].text());
  expect(rows).toHaveLength(31);
  expect(rows.every(row => row.is_active === false && row.is_staff === false)).toBe(true);
  expect(rows.some(row => row.email === 'foreign@example.test')).toBe(false);
  expect(Object.keys(rows[0]).sort()).toEqual(['first_name', 'last_name', 'email', 'dni', 'nia', 'is_active', 'is_staff'].sort());
  expect(blob).toHaveBeenLastCalledWith('/users/export/', { search: 'Lote', is_active: 'false', is_staff: 'false', export_format: 'json' });
}, 15000);

it('combines all five filters, matches NIA exactly and resets page after applying new criteria', async () => {
  renderPage(<UsersPage />, '/?search=Lote&is_active=false&is_staff=false&page=2');
  await screen.findByText('Página 2 de 2 · 31 registros');
  const user = userEvent.setup();
  fireEvent.change(screen.getByLabelText('Filtrar por email'), { target: { value: 'LOTE-0@' } });
  fireEvent.change(screen.getByLabelText('Filtrar por NIA'), { target: { value: 'nia-0' } });
  await user.click(screen.getByRole('button', { name: 'Buscar', exact: true }));
  await screen.findByText('Página 1 de 1 · 1 registros');
  expect(screen.getByText('lote-0@example.test')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Filtrar por NIA'), { target: { value: 'NIA-' } });
  await user.click(screen.getByRole('button', { name: 'Buscar', exact: true }));
  await screen.findByText('No hay registros');
});

function Back() { const navigate = useNavigate(); return <button onClick={() => navigate(-1)}>Atrás del navegador</button>; }
it('hydrates filters/page from URL and restores them after browser back', async () => {
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={['/?search=Lote&is_active=FALSE&is_staff=FALSE&page=2']}><AuthProvider><Back /><UsersPage /></AuthProvider></MemoryRouter>);
  await screen.findByText('Página 2 de 2 · 31 registros');
  expect(screen.getByLabelText('Estado de cuenta')).toHaveValue('false');
  fireEvent.change(screen.getByLabelText('Buscar usuarios'), { target: { value: 'no-match' } });
  await user.click(screen.getByRole('button', { name: 'Buscar', exact: true }));
  await screen.findByText('No hay registros');
  await user.click(screen.getByRole('button', { name: 'Atrás del navegador' }));
  await screen.findByText('Página 2 de 2 · 31 registros');
  expect(screen.getByLabelText('Buscar usuarios')).toHaveValue('Lote');
});

it('localizes INVALID_FILTER field messages, prevents export and recovers by clearing invalid URL criteria', async () => {
  const user = userEvent.setup(); renderPage(<UsersPage />, '/?is_active=invalid');
  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('Estado de cuenta');
  expect(alert).not.toHaveTextContent('Use true or false.');
  expect(screen.getByRole('button', { name: 'Exportar usuarios' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
  await screen.findByText('admin@uam.es');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(downloadBlob).not.toHaveBeenCalled();
  await expect(api.blob('/users/export/', { is_staff: '0', export_format: 'json' })).rejects.toMatchObject({ status: 400, code: 'INVALID_FILTER' });
});

it('does not download on export failure and retries the same applied criteria', async () => {
  const user = userEvent.setup(); renderPage(<UsersPage />, '/?search=Lote&is_active=false');
  await screen.findByText(/32 registros/);
  const blob = vi.spyOn(api, 'blob').mockRejectedValueOnce(new ApiError('INVALID_FILTER', 400, { is_active: ['Use true or false.'] }));
  await user.click(screen.getByRole('button', { name: 'Exportar usuarios' }));
  await screen.findByRole('alert');
  expect(downloadBlob).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Exportar usuarios' }));
  await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
  expect(blob).toHaveBeenLastCalledWith('/users/export/', { search: 'Lote', is_active: 'false', export_format: 'json' });
});

it('preserves the hidden DNI when blank and updates it only when a new value is entered', async () => {
  const user = userEvent.setup(); renderPage(<UsersPage />, '/?nia=NIA-0');
  const row = (await screen.findByText('lote-0@example.test')).closest('tr');
  const patch = vi.spyOn(api, 'patch');
  await user.click(within(row).getByRole('button', { name: 'Editar usuario' }));
  expect(screen.getByLabelText('Nuevo DNI (opcional)')).toHaveValue('');
  await user.click(screen.getByRole('button', { name: 'Guardar' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(patch.mock.calls[0][1]).not.toHaveProperty('dni');
  expect(db.users.find(row => row.id === 'lote-0').dni).toBe('12345678Z');
  await user.click(within((await screen.findByText('lote-0@example.test')).closest('tr')).getByRole('button', { name: 'Editar usuario' }));
  fireEvent.change(screen.getByLabelText('Nuevo DNI (opcional)'), { target: { value: '87654321X' } });
  await user.click(screen.getByRole('button', { name: 'Guardar' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(db.users.find(row => row.id === 'lote-0').dni).toBe('87654321X');
}, 15000);

it('returns to page one with the same filters when editing removes the last row of the final page', async () => {
  db.users = db.users.filter(row => !row.id.startsWith('lote-') || Number(row.id.slice(5)) < 26);
  const user = userEvent.setup();
  renderPage(<UsersPage />, '/?search=Lote&is_active=false&is_staff=false&page=2');
  await screen.findByText('Página 2 de 2 · 26 registros');
  await user.click(screen.getByRole('button', { name: 'Editar usuario' }));
  await user.click(screen.getByLabelText('Gestor de organización'));
  await user.click(screen.getByRole('button', { name: 'Guardar' }));
  await screen.findByText('Página 1 de 1 · 25 registros');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Estado de cuenta')).toHaveValue('false');
  expect(screen.getByLabelText('Tipo de usuario')).toHaveValue('false');
});
