import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../../lib/api/client.js';
import { ApiError } from '../../lib/api/errors.js';
import { db } from '../../lib/mock/db.js';
import { loginAs, renderPage, resetDemo } from './test-utils.jsx';
import UsersPage from './UsersPage.jsx';
import CoursesPage from './CoursesPage.jsx';
import ConfigPage from './ConfigPage.jsx';
import AuditPage from './AuditPage.jsx';

describe('organization administration in mock mode', () => {
  beforeEach(async () => { await resetDemo(); await loginAs(); });

  it.each(['create', 'edit'])('keeps the user %s dialog open during saving and releases it after failure', async (mode) => {
    const user = userEvent.setup(); renderPage(<UsersPage />);
    const row = (await screen.findByText('javier.ruiz@uam.es')).closest('tr');
    expect(screen.getByRole('region', { name: 'Usuarios' })).not.toHaveFocus();
    const originalUsers = structuredClone(db.users);
    const open = () => mode === 'create'
      ? user.click(screen.getByRole('button', { name: 'Crear usuario' }))
      : user.click(within(row).getByRole('button', { name: 'Editar usuario' }));
    await open();
    const element = screen.getByRole('dialog');
    const dialog = within(element);
    const body = { email: 'guardado@uam.es', first_name: 'Ana', last_name: 'García', nia: '12345', ...(mode === 'create' ? { dni: '12345678Z' } : {}), is_staff: false };
    const fill = (scope) => {
      for (const [label, name] of [['Email', 'email'], ['Nombre', 'first_name'], ['Apellidos', 'last_name'], ['NIA', 'nia'], ...(mode === 'create' ? [['DNI', 'dni']] : [])]) {
        fireEvent.change(scope.getByLabelText(label), { target: { value: body[name] } });
      }
    };
    fill(dialog);
    let rejectSave;
    const request = new Promise((_, reject) => { rejectSave = reject; });
    const operation = vi.spyOn(api, mode === 'create' ? 'post' : 'patch').mockImplementationOnce(() => request);
    const path = mode === 'create' ? '/users/' : '/users/u-javier/';
    try {
      const form = dialog.getByRole('button', { name: 'Guardar' }).closest('form');
      act(() => { fireEvent.submit(form); fireEvent.keyDown(window, { key: 'Escape' }); });
      expect(screen.getByRole('dialog')).toBe(element);
      expect(form).toHaveAttribute('aria-busy', 'true');
      await user.keyboard('{Escape}');
      await user.click(dialog.getByRole('button', { name: /^(Close|Cerrar)$/ }));
      fireEvent.mouseDown(element.parentElement);
      expect(screen.getByRole('dialog')).toBe(element);
      expect(operation.mock.calls).toEqual([[path, body]]);
      expect(db.users).toEqual(originalUsers);
      await act(async () => { rejectSave(new ApiError('PERMISSION_DENIED', 403)); });
      expect((await dialog.findByRole('alert')).parentElement).toHaveFocus();
      expect(dialog.getByLabelText('Email')).toHaveValue(body.email);
      expect(dialog.getByLabelText('Nombre')).toHaveValue(body.first_name);
      expect(dialog.getByLabelText('Apellidos')).toHaveValue(body.last_name);
      expect(dialog.getByLabelText('NIA')).toHaveValue(body.nia);
      if (mode === 'create') expect(dialog.getByLabelText('DNI')).toHaveValue(body.dni);
      expect(dialog.getByRole('button', { name: 'Guardar' })).toBeEnabled();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      await open();
      const retry = within(screen.getByRole('dialog'));
      fill(retry);
      await user.click(retry.getByRole('button', { name: 'Guardar' }));
      expect(await screen.findByText(body.email)).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(operation.mock.calls).toEqual([[path, body], [path, body]]);
      const results = screen.getByRole('region', { name: 'Usuarios' });
      await waitFor(() => expect(results).toHaveFocus());
      await user.tab();
      expect(screen.getAllByRole('button', { name: 'Editar usuario' })[0]).toHaveFocus();
      expect(db.users).toHaveLength(originalUsers.length + (mode === 'create' ? 1 : 0));
      const saved = db.users.find((u) => u.email === body.email);
      expect(saved).toMatchObject({ ...body, is_active: true });
      if (mode === 'edit') {
        expect(saved.id).toBe('u-javier');
        expect(saved.dni).toBe(originalUsers.find((u) => u.id === 'u-javier').dni);
      }
    } finally { operation.mockRestore(); }
  });

  it('sends one creation while saving and unlocks retry after a failed request', async () => {
    const user = userEvent.setup(); renderPage(<UsersPage />);
    await screen.findByText('admin@uam.es');
    await user.click(screen.getByRole('button', { name: 'Crear usuario' }));
    const dialog = within(screen.getByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Email'), { target: { value: 'unico@uam.es' } });
    fireEvent.change(dialog.getByLabelText('Nombre'), { target: { value: 'Ana' } });
    fireEvent.change(dialog.getByLabelText('Apellidos'), { target: { value: 'García' } });
    let rejectSave;
    const pendingSave = new Promise((_, reject) => { rejectSave = reject; });
    const post = vi.spyOn(api, 'post').mockImplementationOnce(() => pendingSave);
    try {
      const form = dialog.getByRole('button', { name: 'Guardar' }).closest('form');
      act(() => { fireEvent.submit(form); fireEvent.submit(form); });
      expect(post).toHaveBeenCalledOnce();
      expect(post.mock.calls[0][0]).toBe('/users/');
      expect(form).toHaveAttribute('aria-busy', 'true');
      expect(dialog.getByLabelText('Email')).toBeDisabled();
      fireEvent.submit(form);
      expect(post).toHaveBeenCalledOnce();
      await act(async () => { rejectSave(new ApiError('PERMISSION_DENIED', 403)); });
      expect(await dialog.findByRole('alert')).toHaveTextContent('No tienes permiso para esta acción.');
      expect(form).not.toHaveAttribute('aria-busy');
      expect(dialog.getByLabelText('Email')).toHaveValue('unico@uam.es');
      expect(db.users.some((row) => row.email === 'unico@uam.es')).toBe(false);
      await user.click(dialog.getByRole('button', { name: 'Guardar' }));
      expect(await screen.findByText('unico@uam.es')).toBeInTheDocument();
      expect(post).toHaveBeenCalledTimes(2);
      expect(db.users.filter((row) => row.email === 'unico@uam.es')).toHaveLength(1);
    } finally { post.mockRestore(); }
  });

  it('creates a user, validates duplicate emails, and never exposes passwords', async () => {
    const user = userEvent.setup(); renderPage(<UsersPage />);
    await screen.findByText('maria.perez@uam.es');
    await user.click(screen.getByRole('button', { name: 'Crear usuario' }));
    const dialog = within(screen.getByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Email'), { target: { value: 'admin@uam.es' } });
    fireEvent.change(dialog.getByLabelText('Nombre'), { target: { value: 'Ana' } });
    fireEvent.change(dialog.getByLabelText('Apellidos'), { target: { value: 'García' } });
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));
    expect(await dialog.findByText('Ya existe un usuario con ese email.')).toBeInTheDocument();
    expect(dialog.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(dialog.getByLabelText('Email')).toHaveAccessibleDescription('Ya existe un usuario con ese email.');
    expect(dialog.getByLabelText('Nombre')).not.toHaveAttribute('aria-invalid');
    fireEvent.change(dialog.getByLabelText('Email'), { target: { value: 'ana@uam.es' } });
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('ana@uam.es')).toBeInTheDocument();
    const result = await api.get('/users/');
    expect(result.results.find((u) => u.email === 'ana@uam.es')).not.toHaveProperty('password');
    expect(result).toHaveProperty('total_pages');
  }, 15000);

  it('recovers repeated general save errors with the keyboard without losing user details', async () => {
    const user = userEvent.setup(); renderPage(<UsersPage />);
    await screen.findByText('admin@uam.es');
    await user.click(screen.getByRole('button', { name: 'Crear usuario' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText('Email'), 'recuperacion@uam.es');
    await user.type(dialog.getByLabelText('Nombre'), 'Ana');
    await user.type(dialog.getByLabelText('Apellidos'), 'García');
    const admin = db.users.find((u) => u.id === 'u-admin');
    const roles = { is_staff: admin.is_staff, is_superadmin: admin.is_superadmin };
    Object.assign(admin, { is_staff: false, is_superadmin: false });
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));
    const error = await dialog.findByRole('alert');
    expect(error).toHaveTextContent('No tienes permiso para esta acción.');
    expect(error.parentElement).toHaveFocus();
    expect(dialog.getByLabelText('Email')).not.toHaveAttribute('aria-invalid');
    expect(db.users.some((u) => u.email === 'recuperacion@uam.es')).toBe(false);
    await user.tab();
    expect(dialog.getByRole('button', { name: 'Guardar' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect((await dialog.findByRole('alert')).parentElement).toHaveFocus();
    expect(dialog.getByLabelText('Email')).toHaveValue('recuperacion@uam.es');
    expect(dialog.getByLabelText('Nombre')).toHaveValue('Ana');
    expect(dialog.getByLabelText('Apellidos')).toHaveValue('García');
    Object.assign(admin, roles);
    await user.tab();
    await user.keyboard('{Enter}');
    expect(await screen.findByText('recuperacion@uam.es')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(db.users.filter((u) => u.email === 'recuperacion@uam.es')).toHaveLength(1);
  }, 15000);

  it('requires confirmation before deactivating a user', async () => {
    const user = userEvent.setup(); renderPage(<UsersPage />);
    const row = (await screen.findByText('javier.ruiz@uam.es')).closest('tr');
    await user.click(within(row).getByRole('button', { name: 'Cambiar estado' }));
    expect(db.users.find((u) => u.id === 'u-javier').is_active).toBe(true);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar' }));
    await screen.findByText('Inactivo');
    expect(db.users.find((u) => u.id === 'u-javier').is_active).toBe(false);
  });

  it.each([
    ['Cambiar estado', 'patch', '/users/u-javier/'],
    ['Restablecer contraseña', 'post', '/users/u-javier/reset-password/'],
  ])('sends one confirmation for %s and unlocks retry after failure', async (action, method, path) => {
    const user = userEvent.setup(); renderPage(<UsersPage />);
    const row = (await screen.findByText('javier.ruiz@uam.es')).closest('tr');
    await user.click(within(row).getByRole('button', { name: action }));
    const dialogElement = screen.getByRole('dialog');
    const dialog = within(dialogElement);
    const confirm = dialog.getByRole('button', { name: 'Confirmar' });
    const originalUser = structuredClone(db.users.find((u) => u.id === 'u-javier'));
    let rejectRequest;
    const request = new Promise((_, reject) => { rejectRequest = reject; });
    const operation = vi.spyOn(api, method).mockImplementationOnce(() => request);
    try {
      act(() => {
        confirm.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        confirm.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fireEvent.keyDown(window, { key: 'Escape' });
      });
      expect(screen.getByRole('dialog')).toBe(dialogElement);
      expect(operation).toHaveBeenCalledOnce();
      expect(operation.mock.calls[0][0]).toBe(path);
      expect(confirm).toBeDisabled();
      fireEvent.click(confirm);
      expect(operation).toHaveBeenCalledOnce();
      await user.keyboard('{Escape}');
      await user.click(dialog.getByRole('button', { name: /^(Close|Cerrar)$/ }));
      fireEvent.mouseDown(dialogElement.parentElement);
      expect(dialogElement).toBeInTheDocument();
      expect(operation).toHaveBeenCalledOnce();
      expect(db.users.find((u) => u.id === 'u-javier')).toEqual(originalUser);
      await act(async () => { rejectRequest(new ApiError('PERMISSION_DENIED', 403)); });
      const error = await dialog.findByRole('alert');
      expect(error).toHaveTextContent('No tienes permiso para esta acción.');
      await waitFor(() => expect(error.parentElement).toHaveFocus());
      expect(confirm).toBeEnabled();
      expect(dialog.getByText('javier.ruiz@uam.es')).toBeInTheDocument();
      await user.click(confirm);
      expect(await screen.findByRole('status')).toHaveTextContent(action === 'Cambiar estado' ? 'Cambios guardados' : 'Restablecimiento solicitado');
      expect(operation).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(db.users.find((u) => u.id === 'u-javier').is_active).toBe(action !== 'Cambiar estado');
      await waitFor(() => expect(screen.getByRole('region', { name: 'Usuarios' })).toHaveFocus());
    } finally { operation.mockRestore(); }
  });

  it.each(['Cambiar estado', 'Restablecer contraseña'])('recovers repeated confirmation errors for %s with keyboard retry', async (action) => {
    const user = userEvent.setup(); renderPage(<UsersPage />);
    const row = (await screen.findByText('javier.ruiz@uam.es')).closest('tr');
    await user.click(within(row).getByRole('button', { name: action }));
    const dialog = within(screen.getByRole('dialog'));
    const admin = db.users.find((u) => u.id === 'u-admin');
    const roles = { is_staff: admin.is_staff, is_superadmin: admin.is_superadmin };
    const originalUser = structuredClone(db.users.find((u) => u.id === 'u-javier'));
    Object.assign(admin, { is_staff: false, is_superadmin: false });
    await user.click(dialog.getByRole('button', { name: 'Confirmar' }));
    const error = await dialog.findByRole('alert');
    expect(error).toHaveTextContent('No tienes permiso para esta acción.');
    expect(error.parentElement).toHaveFocus();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(dialog.getByText('javier.ruiz@uam.es')).toBeInTheDocument();
    expect(db.users.find((u) => u.id === 'u-javier')).toEqual(originalUser);
    await user.tab();
    expect(dialog.getByRole('button', { name: 'Confirmar' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect((await dialog.findByRole('alert')).parentElement).toHaveFocus();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(db.users.find((u) => u.id === 'u-javier')).toEqual(originalUser);
    Object.assign(admin, roles);
    await user.tab();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('status')).toHaveTextContent(action === 'Cambiar estado' ? 'Cambios guardados' : 'Restablecimiento solicitado');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(db.users.find((u) => u.id === 'u-javier').is_active).toBe(action !== 'Cambiar estado');
    await waitFor(() => expect(screen.getByRole('region', { name: 'Usuarios' })).toHaveFocus());
  }, 15000);

  it('searches users and renders a useful empty state', async () => {
    const user = userEvent.setup(); renderPage(<UsersPage />);
    await screen.findByText('admin@uam.es');
    fireEvent.change(screen.getByLabelText('Buscar usuarios'), { target: { value: 'nobody@example.com' } });
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(await screen.findByText('No hay registros')).toBeInTheDocument();
    const results = screen.getByRole('region', { name: 'Usuarios' });
    expect(results).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(results).toHaveFocus();
    await user.tab();
    expect(within(results).getByRole('button', { name: 'Crear usuario' })).toHaveFocus();
  });

  it('describes page-local search and keeps its filter when paging with the keyboard', async () => {
    const template = db.users.find((u) => u.id === 'u-admin');
    db.users = [template, ...Array.from({ length: 25 }, (_, i) => ({ ...template, id: `user-${i + 1}`, email: `user-${i + 1}@uam.es`, first_name: `Persona ${i + 1}`, is_superadmin: false }))];
    const user = userEvent.setup(); renderPage(<UsersPage />);
    await screen.findByText('user-1@uam.es');
    const results = screen.getByRole('region', { name: 'Usuarios' });
    expect(results).not.toHaveFocus();
    const search = screen.getByRole('textbox', { name: 'Buscar usuarios' });
    expect(search).toHaveAccessibleDescription('Filtra por nombre, email o NIA solo en esta página. El total corresponde a todos los usuarios.');
    await user.click(search);
    await user.type(search, 'user-25@uam.es{Enter}');
    expect(await screen.findByText('No hay registros')).toBeInTheDocument();
    expect(results).toHaveFocus();
    expect(screen.getByText('Página 1 de 2 · 26 registros')).toBeInTheDocument();
    const next = screen.getByRole('button', { name: 'Siguiente' });
    const get = api.get;
    let finishPage;
    const request = vi.spyOn(api, 'get').mockImplementationOnce((...args) => new Promise((resolve) => {
      finishPage = async () => resolve(await get(...args));
    }));
    next.focus();
    await user.keyboard('{Enter}');
    expect(request).toHaveBeenCalledWith('/users/', { page: 2, page_size: '25' });
    expect(results).not.toHaveFocus();
    await act(async () => { await finishPage(); });
    request.mockRestore();
    expect(await screen.findByText('user-25@uam.es')).toBeInTheDocument();
    expect(results).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Editar usuario' })).toHaveFocus();
    expect(screen.getByText('Página 2 de 2 · 26 registros')).toBeInTheDocument();
    expect(search).toHaveValue('user-25@uam.es');
    expect(search).toHaveAccessibleDescription('Filtra por nombre, email o NIA solo en esta página. El total corresponde a todos los usuarios.');
    expect(next).toBeDisabled();
    let finishSize;
    const resize = vi.spyOn(api, 'get').mockImplementationOnce((...args) => new Promise((resolve) => {
      finishSize = async () => resolve(await get(...args));
    }));
    await user.selectOptions(screen.getByLabelText('Registros por página'), '50');
    expect(resize).toHaveBeenCalledWith('/users/', { page: 1, page_size: '50' });
    expect(results).not.toHaveFocus();
    await act(async () => { await finishSize(); });
    resize.mockRestore();
    await screen.findByText('user-25@uam.es');
    expect(results).toHaveFocus();
    expect(screen.getByText('Página 1 de 1 · 26 registros')).toBeInTheDocument();
    expect(search).toHaveValue('user-25@uam.es');
  }, 15000);

  it('recovers a failed user query with keyboard retry and keeps the page filter', async () => {
    const admin = db.users.find((u) => u.id === 'u-admin');
    admin.is_active = false;
    const originalUsers = structuredClone(db.users);
    const user = userEvent.setup(); renderPage(<UsersPage />);
    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent('No tienes permiso para esta acción.');
    await waitFor(() => expect(error.parentElement).toHaveFocus());
    expect(screen.queryByRole('button', { name: 'Editar usuario' })).not.toBeInTheDocument();
    const search = screen.getByRole('textbox', { name: 'Buscar usuarios' });
    await user.click(search);
    await user.type(search, 'nobody@example.com{Enter}');
    error.parentElement.focus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect((await screen.findByRole('alert')).parentElement).toHaveFocus();
    expect(search).toHaveValue('nobody@example.com');
    admin.is_active = true;
    await user.tab();
    await user.keyboard('{Enter}');
    expect(await screen.findByText('No hay registros')).toBeInTheDocument();
    await waitFor(() => expect(search).toHaveFocus());
    expect(search).toHaveValue('nobody@example.com');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(db.users).toEqual(originalUsers.map((row) => row.id === admin.id ? { ...row, is_active: true } : row));
    await user.clear(search);
    await user.type(search, 'javier.ruiz@uam.es{Enter}');
    expect(await screen.findByText('javier.ruiz@uam.es')).toBeInTheDocument();
    expect(screen.queryByText('maria.perez@uam.es')).not.toBeInTheDocument();
  }, 15000);

  it('shows the active course and creates a course without writing is_active', async () => {
    const user = userEvent.setup(); renderPage(<CoursesPage />);
    expect(await screen.findByText('Curso activo')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Crear curso' }));
    const dialog = within(screen.getByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Nombre del curso'), { target: { value: '2027-2028' } });
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('2027-2028')).toBeInTheDocument();
    expect(db.courses.filter((c) => c.is_active)).toHaveLength(1);
  });

  it('recovers the same course search after organization access is restored', async () => {
    const user = userEvent.setup(); renderPage(<CoursesPage />);
    await screen.findByText('Curso activo');
    const search = screen.getByRole('textbox', { name: 'Buscar cursos' });
    await user.type(search, '2030-2031{Enter}');
    expect(await screen.findByText('No hay registros')).toBeInTheDocument();
    const admin = db.users.find((u) => u.id === 'u-admin');
    admin.is_active = false;
    await user.keyboard('{Enter}');
    expect(await screen.findByText('No tienes permiso para esta acción.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar curso' })).not.toBeInTheDocument();
    admin.is_active = true;
    await user.click(search);
    await user.keyboard('{Enter}');
    expect(await screen.findByText('No hay registros')).toBeInTheDocument();
    expect(screen.queryByText('No tienes permiso para esta acción.')).not.toBeInTheDocument();
    expect(search).toHaveValue('2030-2031');
    expect(search).toHaveFocus();
    expect(db.courses.filter((c) => c.is_active)).toHaveLength(1);
  }, 15000);

  it('recovers a failed course query by retrying and resubmitting with the keyboard', async () => {
    const admin = db.users.find((u) => u.id === 'u-admin');
    const roles = { is_staff: admin.is_staff, is_superadmin: admin.is_superadmin };
    Object.assign(admin, { is_staff: false, is_superadmin: false });
    const originalCourses = structuredClone(db.courses);
    const user = userEvent.setup(); renderPage(<CoursesPage />);
    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent('No tienes permiso para esta acción.');
    await waitFor(() => expect(error.parentElement).toHaveFocus());
    expect(screen.queryByRole('button', { name: 'Editar curso' })).not.toBeInTheDocument();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toHaveFocus();
    await user.keyboard('{Enter}');
    const retriedError = await screen.findByRole('alert');
    expect(retriedError.parentElement).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Buscar' })).toHaveFocus();
    await user.tab({ shift: true });
    const search = screen.getByRole('textbox', { name: 'Buscar cursos' });
    expect(search).toHaveFocus();
    Object.assign(admin, roles);
    await user.keyboard('{Enter}');
    expect(await screen.findByText('Curso activo')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(search).toHaveFocus();
    expect(db.courses).toEqual(originalCourses);
  }, 15000);

  it('saves config and displays field errors for invalid JSON', async () => {
    const user = userEvent.setup(); renderPage(<ConfigPage />);
    const input = await screen.findByLabelText('Motor OCR predeterminado');
    expect(input).not.toHaveFocus();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'otro-motor' } });
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await screen.findByText('Cambios guardados');
    await waitFor(() => expect(screen.getByRole('status')).toHaveFocus());
    await user.tab();
    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveFocus();
    expect(db.org_config.default_ocr_engine).toBe('otro-motor');
    fireEvent.change(screen.getByLabelText('Columnas de exportación de notas (JSON)'), { target: { value: 'invalid' } });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Valor no válido.')).toBeInTheDocument();
    const columns = screen.getByLabelText('Columnas de exportación de notas (JSON)');
    expect(columns).toHaveAttribute('aria-invalid', 'true');
    expect(columns).toHaveAccessibleDescription('Valor no válido.');
    expect(columns).toHaveFocus();
    fireEvent.change(columns, { target: { value: '[]' } });
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await screen.findByText('Cambios guardados');
    await waitFor(() => expect(screen.getByRole('status')).toHaveFocus());
    expect(columns).not.toHaveAttribute('aria-invalid');
    expect(columns).not.toHaveAttribute('aria-describedby');
  });

  it('recovers repeated configuration loading errors with keyboard retry and focuses the recovered form', async () => {
    const admin = db.users.find((u) => u.id === 'u-admin');
    const originalConfig = structuredClone(db.org_config);
    admin.is_active = false;
    const user = userEvent.setup(); renderPage(<ConfigPage />);
    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent('No tienes permiso para esta acción.');
    await waitFor(() => expect(error.parentElement).toHaveFocus());
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Motor OCR predeterminado')).not.toBeInTheDocument();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toHaveFocus();
    await user.keyboard('{Enter}');
    const repeatedError = await screen.findByRole('alert');
    await waitFor(() => expect(repeatedError.parentElement).toHaveFocus());
    expect(db.org_config).toEqual(originalConfig);
    admin.is_active = true;
    await user.tab();
    await user.keyboard('{Enter}');
    const input = await screen.findByLabelText('Motor OCR predeterminado');
    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toHaveValue(originalConfig.default_ocr_engine);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.tab();
    expect(screen.getByLabelText('Umbral de confianza (0–1)')).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
    expect(db.org_config).toEqual(originalConfig);
  });

  it('focuses a general save error and retries configuration with the keyboard without losing edits', async () => {
    const user = userEvent.setup(); renderPage(<ConfigPage />);
    const input = await screen.findByLabelText('Motor OCR predeterminado');
    const originalConfig = structuredClone(db.org_config);
    fireEvent.change(input, { target: { value: 'motor-recuperado' } });
    const admin = db.users.find((u) => u.id === 'u-admin');
    admin.is_active = false;
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent('No tienes permiso para esta acción.');
    expect(error.parentElement).toHaveFocus();
    expect(input).toHaveValue('motor-recuperado');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(db.org_config).toEqual(originalConfig);
    await user.tab({ shift: true });
    expect(screen.getByLabelText('Columnas de exportación de notas (JSON)')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect((await screen.findByRole('alert')).parentElement).toHaveFocus();
    expect(db.org_config).toEqual(originalConfig);
    admin.is_active = true;
    await user.tab();
    const patch = api.patch;
    let finishSave;
    const operation = vi.spyOn(api, 'patch').mockImplementationOnce((...args) => new Promise((resolve) => {
      finishSave = async () => resolve(await patch(...args));
    }));
    await user.keyboard('{Enter}');
    expect(operation).toHaveBeenCalledOnce();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(db.org_config).toEqual(originalConfig);
    await act(async () => { await finishSave(); });
    operation.mockRestore();
    expect(await screen.findByRole('status')).toHaveTextContent('Cambios guardados');
    await waitFor(() => expect(screen.getByRole('status')).toHaveFocus());
    await user.tab();
    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveFocus();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(db.org_config).toEqual({ ...originalConfig, default_ocr_engine: 'motor-recuperado' });
  }, 15000);

  it('paginates the audit log and opens event payloads', async () => {
    db.audit_logs = Array.from({ length: 26 }, (_, i) => ({ id: `audit-${i}`, event_type: `EVENT_${i}`, actor: 'u-admin', actor_email: 'admin@uam.es', ip_address: null, timestamp: '2026-10-17T10:00:00Z', entity_type: 'user', entity_id: 'u-javier', payload: { changed: true } }));
    const user = userEvent.setup(); renderPage(<AuditPage />);
    await screen.findByText('EVENT_0');
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await user.click(await screen.findByText('EVENT_25'));
    expect(within(screen.getByRole('dialog')).getByText(/"changed": true/)).toBeInTheDocument();
  });

  it('rejects reversed audit dates and recovers by correcting or clearing the filters', async () => {
    const template = db.audit_logs[0];
    db.audit_logs = [
      { ...template, id: 'early', event_type: 'EARLY', timestamp: new Date('2026-10-17T09:00').toISOString() },
      { ...template, id: 'late', event_type: 'LATE', timestamp: new Date('2026-10-17T15:00').toISOString() },
    ];
    const user = userEvent.setup(); renderPage(<AuditPage />);
    await screen.findByText('EARLY');
    const from = screen.getByLabelText('Desde (hora local)');
    const to = screen.getByLabelText('Hasta (hora local)');
    expect(from).toHaveAccessibleDescription(/Las fechas usan la hora local de este dispositivo/);
    expect(to).toHaveAccessibleDescription(/Desde debe ser anterior o igual a Hasta/);
    fireEvent.change(from, { target: { value: '2026-10-17T14:00' } });
    fireEvent.change(to, { target: { value: '2026-10-17T10:00' } });
    expect(from).toBeInvalid();
    expect(to).toBeInvalid();
    await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
    expect(screen.getByText('EARLY')).toBeInTheDocument();
    expect(screen.getByText('LATE')).toBeInTheDocument();
    fireEvent.change(to, { target: { value: '2026-10-17T16:00' } });
    expect(from).toBeValid();
    expect(to).toBeValid();
    await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
    await screen.findByText('LATE');
    expect(screen.queryByText('EARLY')).not.toBeInTheDocument();
    fireEvent.change(to, { target: { value: '2026-10-17T10:00' } });
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(from).toHaveValue('');
    expect(to).toHaveValue('');
    expect(from).toBeValid();
    expect(to).toBeValid();
    expect(await screen.findByText('EARLY')).toBeInTheDocument();
    expect(screen.getByText('LATE')).toBeInTheDocument();
    expect(db.audit_logs).toHaveLength(2);
  });

  it('denies organization endpoints to teaching users', async () => {
    await loginAs('maria.perez@uam.es', 'prof123');
    for (const path of ['/users/', '/config/', '/audit-logs/', '/users/export/']) await expect(api.get(path)).rejects.toMatchObject({ status: 403 });
    renderPage(<UsersPage />);
    expect(await screen.findByText('No tienes permiso para esta acción.')).toBeInTheDocument();
  });
});
