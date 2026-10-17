import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../../lib/api/client.js';
import { db } from '../../lib/mock/db.js';
import { loginAs, renderPage, resetDemo } from './test-utils.jsx';
import UsersPage from './UsersPage.jsx';

const upload = (content, name = 'users.json') => {
  const form = new FormData(); form.append('file', new File([content], name, { type: name.endsWith('.csv') ? 'text/csv' : 'application/json' })); return form;
};
beforeEach(async () => { await resetDemo(); await loginAs(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('imports users through the page and displays partial results', async () => {
  db.users.find((u) => u.id === 'u-javier').is_active = false;
  const rows = [
    { first_name: 'Ana', last_name: 'García', email: 'ana@uam.es', dni: '12345678X', nia: '0001' },
    { first_name: 'Javier', last_name: 'Ruiz nuevo', email: 'javier.ruiz@uam.es' },
    { first_name: 'Lucía nueva', last_name: 'Gestora', email: 'admin@uam.es' },
    { first_name: 'Inválido', last_name: 'Error', email: 'invalid-email' },
  ];
  const user = userEvent.setup(); const spy = vi.spyOn(api, 'upload'); renderPage(<UsersPage />);
  await screen.findByText('admin@uam.es');
  await user.click(screen.getByRole('button', { name: 'Importar usuarios' }));
  expect(screen.getByRole('button', { name: 'Importar archivo' })).toBeDisabled();
  await user.upload(screen.getByLabelText('Archivo CSV o JSON'), new File([JSON.stringify(rows)], 'users.json', { type: 'application/json' }));
  expect(screen.getByLabelText('Archivo CSV o JSON').files).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Importar archivo' })).toBeEnabled();
  // jsdom keeps its internal FileList empty after userEvent.upload; submit the selected file via React.
  fireEvent.submit(screen.getByRole('button', { name: 'Importar archivo' }).closest('form'));
  expect(spy).toHaveBeenCalledOnce();
  await screen.findByText('Importación completada');
  const stats = within(screen.getByRole('dialog'));
  for (const label of ['Creados', 'Reactivados', 'Actualizados', 'Filas con errores']) expect(stats.getByText(label).nextElementSibling).toHaveTextContent('1');
  expect(stats.getByText('Filas procesadas').nextElementSibling).toHaveTextContent('4');
  expect(stats.getByRole('button', { name: 'Descargar errores' })).toBeInTheDocument();
  expect(spy.mock.calls[0][0]).toBe('/users/import/');
  expect([...spy.mock.calls[0][1].keys()]).toEqual(['file']);
  expect(db.users.find((u) => u.id === 'u-javier')).toMatchObject({ is_active: true, last_name: 'Ruiz nuevo' });
  expect(db.users.find((u) => u.email === 'ana@uam.es')).toMatchObject({ dni: '12345678X', nia: '0001', is_staff: false });
  await user.keyboard('{Escape}');
  expect(await screen.findByText('ana@uam.es')).toBeInTheDocument();
}, 15000);

it('reads CSV with BOM, CRLF, escaped quotes, commas and blank lines', async () => {
  const result = await api.upload('/users/import/', upload('\uFEFFfirst_name,last_name,email,dni,nia\r\nAna,"García, ""López""",ana@uam.es,,0007\r\n\r\nPedro,Pérez,pedro@uam.es,,0008\r\n', 'users.csv'));
  expect(result).toEqual({ created: 2, reactivated: 0, updated: 0, total_processed: 2, total_errors: 0, errors: [] });
  expect(db.users.find((u) => u.email === 'ana@uam.es')).toMatchObject({ last_name: 'García, "López"', nia: '0007' });
});

it('shows invalid file errors and allows retrying with a corrected file', async () => {
  const user = userEvent.setup(); renderPage(<UsersPage />);
  await screen.findByText('admin@uam.es');
  await user.click(screen.getByRole('button', { name: 'Importar usuarios' }));
  await user.upload(screen.getByLabelText('Archivo CSV o JSON'), new File(['{broken'], 'broken.json', { type: 'application/json' }));
  fireEvent.submit(screen.getByRole('button', { name: 'Importar archivo' }).closest('form'));
  expect(await screen.findByText('Valor no válido.')).toBeInTheDocument();
  await user.upload(screen.getByLabelText('Archivo CSV o JSON'), new File([JSON.stringify([{ first_name: 'Ana', last_name: 'García', email: 'ana@uam.es' }])], 'fixed.json', { type: 'application/json' }));
  fireEvent.submit(screen.getByRole('button', { name: 'Importar archivo' }).closest('form'));
  await screen.findByText('Importación completada');
  expect(screen.queryByText('Valor no válido.')).not.toBeInTheDocument();
}, 15000);

it('rejects missing or malformed files and does not mutate data', async () => {
  const count = db.users.length;
  await expect(api.upload('/users/import/', new FormData())).rejects.toMatchObject({ fields: { file: ['FIELD_REQUIRED'] } });
  for (const [content, name] of [['{}', 'object.json'], ['[]', 'empty.json'], ['email,email\na,b', 'duplicate.csv'], ['email\n"open', 'unclosed.csv'], ['anything', 'unsupported.txt']]) {
    await expect(api.upload('/users/import/', upload(content, name))).rejects.toMatchObject({ fields: { file: ['INVALID'] } });
  }
  expect(db.users).toHaveLength(count);
});

it('denies import to a non-staff account before processing its file', async () => {
  await loginAs('maria.perez@uam.es', 'prof123');
  await expect(api.upload('/users/import/', upload('[]'))).rejects.toMatchObject({ status: 403 });
});

it('downloads opaque error objects without assuming their fields', async () => {
  const user = userEvent.setup();
  const create = vi.fn(() => 'blob:errors');
  const oldCreate = URL.createObjectURL; const oldRevoke = URL.revokeObjectURL;
  URL.createObjectURL = create; URL.revokeObjectURL = vi.fn();
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  try {
    renderPage(<UsersPage />); await screen.findByText('admin@uam.es');
    await user.click(screen.getByRole('button', { name: 'Importar usuarios' }));
    await user.upload(screen.getByLabelText('Archivo CSV o JSON'), new File(['[{}]'], 'invalid.json', { type: 'application/json' }));
    fireEvent.submit(screen.getByRole('button', { name: 'Importar archivo' }).closest('form'));
    await screen.findByText('Importación completada');
    await user.click(screen.getByRole('button', { name: 'Descargar errores' }));
    await waitFor(() => expect(create).toHaveBeenCalledOnce());
    expect(create.mock.calls[0][0].type).toBe('application/json');
    expect(click.mock.instances[0].download).toBe('import-errors.json');
  } finally { URL.createObjectURL = oldCreate; URL.revokeObjectURL = oldRevoke; }
}, 15000);

it('exports JSON including DNI without authentication secrets', async () => {
  // Node Response cannot consume jsdom Blob bytes; use the matching native Blob for this transport test.
  vi.stubGlobal('Blob', NodeBlob);
  db.users.find((u) => u.id === 'u-admin').dni = '12345678X';
  const blob = await api.blob('/users/export/', { export_format: 'json' });
  const rows = JSON.parse(await blob.text());
  expect(rows.find((u) => u.id === 'u-admin').dni).toBe('12345678X');
  expect(rows[0]).not.toHaveProperty('password');
});
