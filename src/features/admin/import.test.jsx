import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../../lib/api/client.js';
import { ApiError } from '../../lib/api/errors.js';
import { db } from '../../lib/mock/db.js';
import { loginAs, renderPage, resetDemo } from './test-utils.jsx';
import UsersPage from './UsersPage.jsx';
import SubjectsPage from '../subject-admin/SubjectsPage.jsx';

const upload = (content, name = 'users.json') => {
  const form = new FormData(); form.append('file', new File([content], name, { type: name.endsWith('.csv') ? 'text/csv' : 'application/json' })); return form;
};
beforeEach(async () => { await resetDemo(); await loginAs(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it.each(['users', 'subjects'])('keeps the %s import open while uploading and permits closing after failure', async (kind) => {
  const user = userEvent.setup();
  renderPage(kind === 'users' ? <UsersPage /> : <SubjectsPage />);
  await screen.findByText(kind === 'users' ? 'admin@uam.es' : 'MAT101');
  const open = () => user.click(screen.getByRole('button', { name: kind === 'users' ? 'Importar usuarios' : 'Importar asignaturas' }));
  await open();
  const element = screen.getByRole('dialog');
  const dialog = within(element);
  const file = new File(['[]'], `${kind}.json`, { type: 'application/json' });
  const input = dialog.getByLabelText('Archivo CSV o JSON');
  await user.upload(input, file);
  const usersBefore = structuredClone(db.users);
  const subjectsBefore = structuredClone(db.subjects);
  let rejectImport;
  const request = new Promise((_, reject) => { rejectImport = reject; });
  const operation = vi.spyOn(api, 'upload').mockImplementationOnce(() => request);
  try {
    const form = dialog.getByRole('button', { name: 'Importar archivo' }).closest('form');
    act(() => { fireEvent.submit(form); fireEvent.submit(form); fireEvent.keyDown(window, { key: 'Escape' }); });
    expect(screen.getByRole('dialog')).toBe(element);
    await user.keyboard('{Escape}');
    await user.click(dialog.getByRole('button', { name: /^(Close|Cerrar)$/ }));
    fireEvent.mouseDown(element.parentElement);
    expect(screen.getByRole('dialog')).toBe(element);
    expect(form).toHaveAttribute('aria-busy', 'true');
    expect(input).toBeDisabled();
    expect(operation).toHaveBeenCalledOnce();
    expect(operation.mock.calls[0][0]).toBe(`/${kind}/import/`);
    expect([...operation.mock.calls[0][1].keys()]).toEqual(['file']);
    expect(operation.mock.calls[0][1].get('file')).toBe(file);
    expect(db.users).toEqual(usersBefore);
    expect(db.subjects).toEqual(subjectsBefore);
    await act(async () => { rejectImport(new ApiError('PERMISSION_DENIED', 403)); });
    expect((await dialog.findByRole('alert')).parentElement).toHaveFocus();
    expect(input.files[0]).toBe(file);
    expect(input).toBeEnabled();
    expect(dialog.getByRole('button', { name: 'Importar archivo' })).toBeEnabled();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await open();
    expect(screen.getByLabelText('Archivo CSV o JSON').files).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Importar archivo' })).toBeDisabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  } finally { operation.mockRestore(); }
}, 15000);

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
  expect(screen.getByLabelText('Archivo CSV o JSON')).toHaveAccessibleDescription(/CSV con cabecera/);
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

it('imports once during repeated submits, recovers after failure and requires a new file after success', async () => {
  const user = userEvent.setup(); renderPage(<UsersPage />);
  await screen.findByText('admin@uam.es');
  await user.click(screen.getByRole('button', { name: 'Importar usuarios' }));
  const fileInput = screen.getByLabelText('Archivo CSV o JSON');
  const file = new File([JSON.stringify([{ first_name: 'Ana', last_name: 'García', email: 'unica@uam.es' }])], 'users.json', { type: 'application/json' });
  await user.upload(fileInput, file);
  let rejectImport;
  const pendingImport = new Promise((_, reject) => { rejectImport = reject; });
  const uploadSpy = vi.spyOn(api, 'upload').mockImplementationOnce(() => pendingImport);
  try {
    const submit = screen.getByRole('button', { name: 'Importar archivo' });
    const form = submit.closest('form');
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    expect(uploadSpy).toHaveBeenCalledOnce();
    expect(uploadSpy.mock.calls[0][0]).toBe('/users/import/');
    expect(uploadSpy.mock.calls[0][1].get('file')).toBe(file);
    expect(form).toHaveAttribute('aria-busy', 'true');
    expect(fileInput).toBeDisabled();
    fireEvent.submit(form);
    expect(uploadSpy).toHaveBeenCalledOnce();
    await act(async () => { rejectImport(new ApiError('PERMISSION_DENIED', 403)); });
    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes permiso para esta acción.');
    expect(form).not.toHaveAttribute('aria-busy');
    expect(fileInput).toBeEnabled();
    expect(fileInput.files[0]).toBe(file);
    expect(db.users.some((row) => row.email === 'unica@uam.es')).toBe(false);
    fireEvent.submit(form);
    await screen.findByText('Importación completada');
    expect(uploadSpy).toHaveBeenCalledTimes(2);
    expect(db.users.filter((row) => row.email === 'unica@uam.es')).toHaveLength(1);
    expect(submit).toBeDisabled();
    fireEvent.submit(form);
    expect(uploadSpy).toHaveBeenCalledTimes(2);
    await user.upload(fileInput, new File([JSON.stringify([{ first_name: 'Eva', last_name: 'López', email: 'otra@uam.es' }])], 'next.json', { type: 'application/json' }));
    expect(submit).toBeEnabled();
    fireEvent.submit(form);
    await screen.findByText('Importación completada');
    expect(uploadSpy).toHaveBeenCalledTimes(3);
    expect(db.users.filter((row) => row.email === 'otra@uam.es')).toHaveLength(1);
  } finally { uploadSpy.mockRestore(); }
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
  await user.tab();
  expect(screen.getByRole('button', { name: 'Importar archivo' })).toHaveFocus();
  const usersBefore = JSON.stringify(db.users);
  fireEvent.submit(screen.getByRole('button', { name: 'Importar archivo' }).closest('form'));
  expect(await screen.findByText('Valor no válido.')).toBeInTheDocument();
  const fileInput = screen.getByLabelText('Archivo CSV o JSON');
  expect(fileInput).toHaveAttribute('aria-invalid', 'true');
  expect(fileInput).toHaveAccessibleDescription('Valor no válido.');
  await waitFor(() => expect(fileInput).toHaveFocus());
  expect(fileInput).toBeEnabled();
  expect(fileInput.files[0].name).toBe('broken.json');
  expect(JSON.stringify(db.users)).toBe(usersBefore);
  await user.upload(screen.getByLabelText('Archivo CSV o JSON'), new File([JSON.stringify([{ first_name: 'Ana', last_name: 'García', email: 'ana@uam.es' }])], 'fixed.json', { type: 'application/json' }));
  expect(fileInput).not.toHaveAttribute('aria-invalid');
  expect(fileInput).toHaveAccessibleDescription(/CSV con cabecera/);
  await user.tab();
  expect(screen.getByRole('button', { name: 'Importar archivo' })).toHaveFocus();
  fireEvent.submit(screen.getByRole('button', { name: 'Importar archivo' }).closest('form'));
  await screen.findByText('Importación completada');
  expect(screen.queryByText('Valor no válido.')).not.toBeInTheDocument();
}, 15000);

it('focuses general import errors and retries the same file after access is restored', async () => {
  const user = userEvent.setup(); renderPage(<UsersPage />);
  await screen.findByText('admin@uam.es');
  await user.click(screen.getByRole('button', { name: 'Importar usuarios' }));
  const fileInput = screen.getByLabelText('Archivo CSV o JSON');
  await user.upload(fileInput, new File([JSON.stringify([{ first_name: 'Ana', last_name: 'García', email: 'ana@uam.es' }])], 'users.json', { type: 'application/json' }));
  const submit = screen.getByRole('button', { name: 'Importar archivo' });
  const admin = db.users.find((row) => row.id === 'u-admin');
  admin.is_active = false;
  const usersBefore = JSON.stringify(db.users);
  fireEvent.submit(submit.closest('form'));
  const error = await screen.findByText('No tienes permiso para esta acción.');
  await waitFor(() => expect(error.closest('[tabindex="-1"]')).toHaveFocus());
  expect(fileInput).not.toHaveAttribute('aria-invalid');
  expect(fileInput.files[0].name).toBe('users.json');
  expect(JSON.stringify(db.users)).toBe(usersBefore);
  await user.tab({ shift: true });
  expect(submit).toHaveFocus();
  // Submit via React: jsdom native file validation does not see userEvent's FileList.
  fireEvent.submit(submit.closest('form'));
  const repeatedError = await screen.findByText('No tienes permiso para esta acción.');
  await waitFor(() => expect(repeatedError.closest('[tabindex="-1"]')).toHaveFocus());
  expect(JSON.stringify(db.users)).toBe(usersBefore);
  await user.tab({ shift: true });
  expect(submit).toHaveFocus();
  await user.tab({ shift: true });
  expect(fileInput).toHaveFocus();
  admin.is_active = true;
  await user.tab();
  expect(submit).toHaveFocus();
  fireEvent.submit(submit.closest('form'));
  await screen.findByText('Importación completada');
  expect(screen.queryByText('No tienes permiso para esta acción.')).not.toBeInTheDocument();
  expect(db.users.filter((row) => row.email === 'ana@uam.es')).toHaveLength(1);
  expect(fileInput.files[0].name).toBe('users.json');
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
