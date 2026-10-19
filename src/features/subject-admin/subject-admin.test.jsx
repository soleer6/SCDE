import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../../lib/api/client.js';
import { ApiError } from '../../lib/api/errors.js';
import { db } from '../../lib/mock/db.js';
import { loginAs, renderPage, resetDemo } from '../admin/test-utils.jsx';
import ManagePage from './ManagePage.jsx';
import SubjectsPage from './SubjectsPage.jsx';
import { createSubject, deleteSubject, updateSubject } from './api.js';
import { subjectCrudMocks } from './mocks.js';

beforeEach(async () => { await resetDemo(); await loginAs('maria.perez@uam.es', 'prof123'); });
const manage = () => renderPage(<ManagePage />, '/subjects/s-mat101/manage', '/subjects/:subjectId/manage');
it.each(['member', 'create-group', 'edit-group'])('keeps the %s form open while saving and releases closing after failure', async (kind) => {
  const user = userEvent.setup(); manage();
  const isMember = kind === 'member';
  if (!isMember) await user.click(screen.getByRole('tab', { name: 'Grupos' }));
  const row = (await screen.findByText(isMember ? 'javier.ruiz@uam.es' : 'Grupo 611')).closest('tr');
  const results = screen.getByRole('region', { name: isMember ? 'Miembros' : 'Grupos' });
  expect(results).not.toHaveFocus();
  const open = () => kind === 'edit-group'
    ? user.click(within(row).getByRole('button', { name: 'Renombrar grupo' }))
    : user.click(screen.getByRole('button', { name: isMember ? 'Añadir miembro' : 'Crear grupo' }));
  const groupsBefore = structuredClone(db.groups);
  const membersBefore = structuredClone(db.memberships);
  const body = isMember ? { user_id: 'u-admin', role: 'TEACHER', group_id: null } : { label: 'Grupo recuperado' };
  const path = isMember ? '/subjects/s-mat101/members/' : `/subjects/s-mat101/groups/${kind === 'edit-group' ? 'g-MAT101-a/' : ''}`;
  const fill = (scope) => {
    if (isMember) {
      fireEvent.change(scope.getByLabelText('Identificador de usuario'), { target: { value: body.user_id } });
      fireEvent.change(scope.getByRole('combobox'), { target: { value: body.role } });
    } else fireEvent.change(scope.getByLabelText('Nombre del grupo'), { target: { value: body.label } });
  };
  await open();
  const dialogElement = screen.getByRole('dialog');
  const dialog = within(dialogElement);
  fill(dialog);
  let rejectSave;
  const request = new Promise((_, reject) => { rejectSave = reject; });
  const operation = vi.spyOn(api, kind === 'edit-group' ? 'patch' : 'post').mockImplementationOnce(() => request);
  try {
    const form = dialog.getByRole('button', { name: 'Guardar' }).closest('form');
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
    expect(db.groups).toEqual(groupsBefore);
    expect(db.memberships).toEqual(membersBefore);
    await act(async () => { rejectSave(new ApiError('PERMISSION_DENIED', 403)); });
    const error = await dialog.findByRole('alert');
    await waitFor(() => expect(error.parentElement).toHaveFocus());
    if (isMember) {
      expect(dialog.getByLabelText('Identificador de usuario')).toHaveValue(body.user_id);
      expect(dialog.getByRole('combobox')).toHaveValue(body.role);
      expect(dialog.getByLabelText('Identificador de grupo (opcional)')).toHaveValue('');
    } else expect(dialog.getByLabelText('Nombre del grupo')).toHaveValue(body.label);
    expect(dialog.getByRole('button', { name: 'Guardar' })).toBeEnabled();
    expect(db.groups).toEqual(groupsBefore);
    expect(db.memberships).toEqual(membersBefore);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await open();
    const retryDialog = within(screen.getByRole('dialog'));
    fill(retryDialog);
    const get = api.get;
    let resolveReload;
    const reload = vi.spyOn(api, 'get').mockImplementationOnce((...args) => new Promise((resolve) => {
      resolveReload = async () => resolve(await get(...args));
    }));
    await user.click(retryDialog.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(reload).toHaveBeenCalledWith(isMember ? '/subjects/s-mat101/members/' : '/subjects/s-mat101/groups/', { page: 1 });
    expect(results).not.toHaveFocus();
    await act(async () => { await resolveReload(); });
    reload.mockRestore();
    expect(await screen.findByText(isMember ? 'admin@uam.es' : body.label)).toBeInTheDocument();
    await waitFor(() => expect(results).toHaveFocus());
    await user.tab();
    expect(within(results).getAllByRole('button', { name: isMember ? 'Consultar permisos' : 'Renombrar grupo' })[0]).toHaveFocus();
    expect(operation.mock.calls).toEqual([[path, body], [path, body]]);
    if (isMember) {
      expect(db.memberships).toHaveLength(membersBefore.length + 1);
      expect(db.memberships.find((m) => m.user_id === body.user_id && m.subject_id === 's-mat101')).toMatchObject({ ...body, is_active: true });
      expect(db.groups).toEqual(groupsBefore);
    } else {
      expect(db.groups).toHaveLength(groupsBefore.length + (kind === 'create-group' ? 1 : 0));
      expect(db.groups.find((g) => g.label === body.label)).toMatchObject({ subject_id: 's-mat101', ...(kind === 'edit-group' ? { id: 'g-MAT101-a' } : {}) });
      expect(db.memberships).toEqual(membersBefore);
    }
  } finally { operation.mockRestore(); }
});
it('preserves permission edits after a pending save fails and retries the exact overrides once', async () => {
  const user = userEvent.setup(); manage();
  const row = (await screen.findByText('javier.ruiz@uam.es')).closest('tr');
  await user.click(within(row).getByRole('button', { name: 'Consultar permisos' }));
  const groups = await screen.findByRole('combobox', { name: /Gestionar grupos/ });
  const rubric = screen.getByRole('combobox', { name: /Crear rúbrica/ });
  await user.selectOptions(groups, 'true');
  await user.selectOptions(rubric, 'false');
  const before = structuredClone(db.memberships.find((m) => m.id === 'm-2'));
  const save = screen.getByRole('button', { name: 'Guardar' });
  const form = save.closest('form');
  const body = { permissions: { can_create_rubric: false, can_manage_groups: true } };
  const patch = api.patch.bind(api);
  let rejectRequest;
  const request = new Promise((_, reject) => { rejectRequest = reject; });
  const operation = vi.spyOn(api, 'patch').mockImplementationOnce(() => request);
  try {
    act(() => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    fireEvent.submit(form);
    expect(operation).toHaveBeenCalledOnce();
    expect(operation).toHaveBeenCalledWith('/memberships/m-2/permissions/', body);
    expect(save).toBeDisabled();
    expect(form).toHaveAttribute('aria-busy', 'true');
    for (const select of screen.getAllByRole('combobox')) expect(select).toBeDisabled();
    expect(db.memberships.find((m) => m.id === 'm-2')).toEqual(before);
    await act(async () => { rejectRequest(new ApiError('PERMISSION_DENIED', 403)); });
    const error = await screen.findByRole('alert');
    await waitFor(() => expect(error.parentElement).toHaveFocus());
    expect(save).toBeEnabled();
    expect(groups).toHaveValue('true');
    expect(rubric).toHaveValue('false');
    expect(db.memberships.find((m) => m.id === 'm-2')).toEqual(before);
    let finishSave;
    operation.mockImplementationOnce((...args) => new Promise((resolve) => {
      finishSave = async () => resolve(await patch(...args));
    }));
    await user.tab();
    expect(save).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(db.memberships.find((m) => m.id === 'm-2')).toEqual(before);
    await act(async () => { await finishSave(); });
    await screen.findByText('Cambios guardados');
    await waitFor(() => expect(screen.getByRole('status')).toHaveFocus());
    await user.tab();
    expect(save).toHaveFocus();
    expect(operation).toHaveBeenCalledTimes(2);
    expect(operation.mock.calls[1]).toEqual(['/memberships/m-2/permissions/', body]);
    expect(db.memberships.find((m) => m.id === 'm-2').permission_overrides).toEqual(body.permissions);
    expect(screen.getByRole('combobox', { name: /Gestionar grupos · Por defecto: No · Efectivo: Sí/ })).toHaveValue('true');
    expect(screen.getByRole('combobox', { name: /Crear rúbricas · Por defecto: Sí · Efectivo: No/ })).toHaveValue('false');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  } finally { operation.mockRestore(); }
});
it.each(['member', 'group'])('sends one %s removal while pending and permits retry after failure', async (kind) => {
  const user = userEvent.setup(); manage();
  if (kind === 'group') await user.click(screen.getByRole('tab', { name: 'Grupos' }));
  const target = kind === 'member' ? 'elena.rodriguez@estudiante.uam.es' : 'Grupo 611';
  const row = (await screen.findByText(target)).closest('tr');
  await user.click(within(row).getByRole('button', { name: kind === 'member' ? 'Retirar miembro' : 'Eliminar grupo' }));
  const dialogElement = screen.getByRole('dialog');
  const dialog = within(dialogElement);
  const confirm = dialog.getByRole('button', { name: 'Confirmar' });
  const groupsBefore = structuredClone(db.groups);
  const membersBefore = structuredClone(db.memberships);
  const record = kind === 'member'
    ? db.memberships.find((m) => m.user_id === db.users.find((u) => u.email === target).id && m.subject_id === 's-mat101')
    : db.groups.find((g) => g.label === target);
  const path = `/subjects/s-mat101/${kind === 'member' ? 'members' : 'groups'}/${record.id}/`;
  let rejectRequest;
  const request = new Promise((_, reject) => { rejectRequest = reject; });
  const operation = vi.spyOn(api, 'del').mockImplementationOnce(() => request);
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
    await user.keyboard('{Escape}');
    await user.click(dialog.getByRole('button', { name: /^(Close|Cerrar)$/ }));
    fireEvent.mouseDown(dialogElement.parentElement);
    expect(dialogElement).toBeInTheDocument();
    expect(operation).toHaveBeenCalledOnce();
    expect(db.groups).toEqual(groupsBefore);
    expect(db.memberships).toEqual(membersBefore);
    await act(async () => { rejectRequest(new ApiError('PERMISSION_DENIED', 403)); });
    const error = await dialog.findByRole('alert');
    await waitFor(() => expect(error.parentElement).toHaveFocus());
    expect(dialog.getByText(target)).toBeInTheDocument();
    expect(confirm).toBeEnabled();
    expect(db.groups).toEqual(groupsBefore);
    expect(db.memberships).toEqual(membersBefore);
    const results = screen.getByRole('region', { name: kind === 'member' ? 'Miembros' : 'Grupos' });
    const reload = vi.spyOn(api, 'get').mockRejectedValueOnce(new ApiError('PERMISSION_DENIED', 403));
    await user.click(confirm);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const reloadError = await within(results).findByRole('alert');
    await waitFor(() => expect(reloadError.parentElement).toHaveFocus());
    expect(results).not.toHaveFocus();
    reload.mockRestore();
    const get = api.get;
    let resolveReload;
    const retry = vi.spyOn(api, 'get').mockImplementationOnce((...args) => new Promise((resolve) => {
      resolveReload = async () => resolve(await get(...args));
    }));
    await user.tab();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toHaveFocus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(retry).toHaveBeenCalledOnce());
    expect(results).not.toHaveFocus();
    await act(async () => { await resolveReload(); });
    retry.mockRestore();
    await waitFor(() => expect(results).toHaveFocus());
    await user.tab();
    expect(within(results).getAllByRole('button', { name: kind === 'member' ? 'Consultar permisos' : 'Renombrar grupo' })[0]).toHaveFocus();
    expect(operation).toHaveBeenCalledTimes(2);
    expect(operation.mock.calls[1][0]).toBe(path);
    if (kind === 'member') {
      expect(db.memberships.find((m) => m.id === record.id).is_active).toBe(false);
      expect(db.groups).toEqual(groupsBefore);
    } else {
      expect(db.groups.some((g) => g.id === record.id)).toBe(false);
      expect(db.memberships.filter((m) => m.group_id === record.id)).toHaveLength(0);
    }
  } finally { operation.mockRestore(); }
});
it.each(['member', 'group'])('cancels a denied %s removal and restores the triggering row focus', async (kind) => {
  const user = userEvent.setup(); manage();
  if (kind === 'group') await user.click(screen.getByRole('tab', { name: 'Grupos' }));
  const target = kind === 'member' ? 'elena.rodriguez@estudiante.uam.es' : 'Grupo 611';
  const otherTarget = kind === 'member' ? 'javier.ruiz@uam.es' : 'Grupo 612';
  const actionName = kind === 'member' ? 'Retirar miembro' : 'Eliminar grupo';
  const opener = within((await screen.findByText(target)).closest('tr')).getByRole('button', { name: actionName });
  await user.click(opener);
  const coordinator = db.memberships.find((m) => m.id === 'm-1');
  coordinator.permission_overrides = { [kind === 'member' ? 'can_manage_members' : 'can_manage_groups']: false };
  const groupsBefore = structuredClone(db.groups);
  const membersBefore = structuredClone(db.memberships);
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar' }));
  const error = await screen.findByRole('alert');
  await waitFor(() => expect(error.parentElement).toHaveFocus());
  if (kind === 'member') await user.keyboard('{Escape}');
  else {
    await user.tab({ shift: true });
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: /^(Close|Cerrar)$/ })).toHaveFocus();
    await user.keyboard('{Enter}');
  }
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(db.groups).toEqual(groupsBefore);
  expect(db.memberships).toEqual(membersBefore);
  const otherOpener = within(screen.getByText(otherTarget).closest('tr')).getByRole('button', { name: actionName });
  await user.click(otherOpener);
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByText(otherTarget)).toBeInTheDocument();
  expect(within(dialog).queryByText(target)).not.toBeInTheDocument();
  expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
  await user.keyboard('{Escape}');
  expect(otherOpener).toHaveFocus();
  expect(db.groups).toEqual(groupsBefore);
  expect(db.memberships).toEqual(membersBefore);
});
it.each(['members', 'groups'])('recovers a denied %s list with repeated keyboard retries', async (kind) => {
  await loginAs('javier.ruiz@uam.es', 'prof123');
  const user = userEvent.setup(); manage();
  if (kind === 'groups') await user.click(screen.getByRole('tab', { name: 'Grupos' }));
  const membership = db.memberships.find((m) => m.id === 'm-2');
  const groupsBefore = structuredClone(db.groups);
  const membersBefore = structuredClone(db.memberships);
  const actionName = kind === 'members' ? 'Añadir miembro' : 'Crear grupo';
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const error = await screen.findByRole('alert');
    await waitFor(() => expect(error.parentElement).toHaveFocus());
    expect(error).toHaveTextContent('No tienes permiso para esta acción.');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: actionName })).toBeDisabled();
    expect(db.groups).toEqual(groupsBefore);
    expect(db.memberships).toEqual(membersBefore);
    await user.tab();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toHaveFocus();
    if (attempt === 1) membership.permission_overrides = { [kind === 'members' ? 'can_manage_members' : 'can_manage_groups']: true };
    await user.keyboard('{Enter}');
  }
  await screen.findByText(kind === 'members' ? 'elena.rodriguez@estudiante.uam.es' : 'Grupo 611');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: actionName })).toBeEnabled();
  expect(db.groups).toEqual(groupsBefore);
  expect(db.memberships.filter((m) => m.id !== membership.id)).toEqual(membersBefore.filter((m) => m.id !== membership.id));
});
it.each(['member', 'group'])('recovers a denied %s removal with repeated keyboard retries', async (kind) => {
  const user = userEvent.setup(); manage();
  const coordinator = db.memberships.find((m) => m.id === 'm-1');
  const groupsBefore = structuredClone(db.groups);
  const membersBefore = structuredClone(db.memberships);
  if (kind === 'group') await user.click(screen.getByRole('tab', { name: 'Grupos' }));
  const target = kind === 'member' ? 'elena.rodriguez@estudiante.uam.es' : 'Grupo 611';
  const row = (await screen.findByText(target)).closest('tr');
  await user.click(within(row).getByRole('button', { name: kind === 'member' ? 'Retirar miembro' : 'Eliminar grupo' }));
  const permission = kind === 'member' ? 'can_manage_members' : 'can_manage_groups';
  coordinator.permission_overrides = { [permission]: false };
  const dialog = screen.getByRole('dialog');
  await user.click(within(dialog).getByRole('button', { name: 'Confirmar' }));
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const error = await within(dialog).findByRole('alert');
    await waitFor(() => expect(error.parentElement).toHaveFocus());
    expect(error).toHaveTextContent('No tienes permiso para esta acción.');
    expect(within(dialog).getByText(target)).toBeInTheDocument();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(db.groups).toEqual(groupsBefore);
    expect(db.memberships.filter((m) => m.id !== coordinator.id)).toEqual(membersBefore.filter((m) => m.id !== coordinator.id));
    await user.tab();
    expect(within(dialog).getByRole('button', { name: 'Confirmar' })).toHaveFocus();
    if (attempt === 1) coordinator.permission_overrides = {};
    await user.keyboard('{Enter}');
  }
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  if (kind === 'member') {
    const student = db.users.find((u) => u.email === target);
    expect(db.memberships.find((m) => m.user_id === student.id && m.subject_id === 's-mat101').is_active).toBe(false);
    expect(db.groups).toEqual(groupsBefore);
  } else {
    const deleted = groupsBefore.find((g) => g.label === target);
    expect(db.groups.some((g) => g.id === deleted.id)).toBe(false);
    expect(db.memberships.filter((m) => m.group_id === deleted.id)).toHaveLength(0);
  }
});
it('creates, renames and deletes a subject group', async () => {
  const user = userEvent.setup(); manage();
  await user.click(screen.getByRole('tab', { name: 'Grupos' }));
  await screen.findByText('Grupo 611');
  await user.click(screen.getByRole('button', { name: 'Crear grupo' }));
  fireEvent.change(screen.getByLabelText('Nombre del grupo'), { target: { value: 'Laboratorio' } });
  await user.click(screen.getByRole('button', { name: 'Guardar' }));
  const row = (await screen.findByText('Laboratorio')).closest('tr');
  await user.click(within(row).getByRole('button', { name: 'Renombrar grupo' }));
  fireEvent.change(screen.getByLabelText('Nombre del grupo'), { target: { value: 'Laboratorio B' } });
  await user.click(screen.getByRole('button', { name: 'Guardar' }));
  const renamed = (await screen.findByText('Laboratorio B')).closest('tr');
  await user.click(within(renamed).getByRole('button', { name: 'Eliminar grupo' }));
  expect(db.groups.some((g) => g.label === 'Laboratorio B')).toBe(true);
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar' }));
  await waitFor(() => expect(db.groups.some((g) => g.label === 'Laboratorio B')).toBe(false));
}, 15000);
it('assigns and removes a subject member', async () => {
  const user = userEvent.setup(); manage();
  await screen.findByText('elena.rodriguez@estudiante.uam.es');
  await user.click(screen.getByRole('button', { name: 'Añadir miembro' }));
  fireEvent.change(screen.getByLabelText('Identificador de usuario'), { target: { value: 'u-admin' } });
  await user.click(screen.getByRole('button', { name: 'Guardar' }));
  const row = (await screen.findByText('admin@uam.es')).closest('tr');
  await user.click(within(row).getByRole('button', { name: 'Retirar miembro' }));
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar' }));
  await waitFor(() => expect(db.memberships.find((m) => m.user_id === 'u-admin' && m.subject_id === 's-mat101').is_active).toBe(false));
});
it('displays effective permissions and saves overrides separately from defaults', async () => {
  const user = userEvent.setup(); manage();
  const row = (await screen.findByText('javier.ruiz@uam.es')).closest('tr');
  await user.click(within(row).getByRole('button', { name: 'Consultar permisos' }));
  const input = await screen.findByLabelText(/Gestionar grupos · Por defecto: No · Efectivo: No/);
  expect(screen.getByRole('combobox', { name: /Crear exámenes/ })).toHaveFocus();
  await user.selectOptions(input, 'true');
  await user.click(screen.getByRole('button', { name: 'Guardar' }));
  expect(await screen.findByLabelText(/Gestionar grupos · Por defecto: No · Efectivo: Sí/)).toBeInTheDocument();
  expect(db.memberships.find((m) => m.id === 'm-2').permission_overrides).toEqual({ can_manage_groups: true });
  await waitFor(() => expect(screen.getByRole('status')).toHaveFocus());
  await user.selectOptions(screen.getByLabelText(/Gestionar grupos · Por defecto: No · Efectivo: Sí/), 'inherit');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Guardar' }));
  await screen.findByLabelText(/Gestionar grupos · Por defecto: No · Efectivo: No/);
  expect(db.memberships.find((m) => m.id === 'm-2').permission_overrides).toEqual({});
  await waitFor(() => expect(screen.getByRole('status')).toHaveFocus());
});
it('lets a delegate open a known membership and save permissions with the keyboard', async () => {
  db.memberships.find((m) => m.id === 'm-2').permission_overrides = { can_delegate_perms: true };
  await loginAs('javier.ruiz@uam.es', 'prof123');
  const user = userEvent.setup(); manage();
  await screen.findByText('No tienes permiso para esta acción.');
  await user.click(screen.getByRole('tab', { name: 'Permisos' }));
  await user.tab();
  const membership = screen.getByRole('textbox', { name: 'Identificador de membresía' });
  expect(membership).toHaveFocus();
  expect(membership).toHaveAccessibleDescription('Usa el identificador de una membresía de esta asignatura si solo tienes permiso de delegación.');
  await user.type(membership, 'm-3{Enter}');
  const first = await screen.findByRole('combobox', { name: /Crear exámenes/ });
  await waitFor(() => expect(first).toHaveFocus());
  // Native select keyboard handling varies by platform; set the option and
  // exercise the focus order and form submission with Tab/Enter.
  const groups = screen.getByRole('combobox', { name: /Gestionar grupos/ });
  await user.selectOptions(groups, 'true');
  await user.tab();
  const save = screen.getByRole('button', { name: 'Guardar' });
  expect(save).toHaveFocus();
  await user.keyboard('{Enter}');
  await screen.findByText('Cambios guardados');
  await waitFor(() => expect(screen.getByRole('status')).toHaveFocus());
  await user.tab();
  expect(save).toHaveFocus();
  expect(db.memberships.find((m) => m.id === 'm-3').permission_overrides).toEqual({ can_manage_groups: true });
  expect(screen.getByRole('combobox', { name: /Gestionar grupos · Por defecto: Sí · Efectivo: Sí/ })).toHaveValue('true');
  expect(first).not.toHaveFocus();
});
it('retries the same membership lookup with Enter after access is restored', async () => {
  await loginAs('javier.ruiz@uam.es', 'prof123');
  const user = userEvent.setup(); manage();
  await screen.findByText('No tienes permiso para esta acción.');
  await user.click(screen.getByRole('tab', { name: 'Permisos' }));
  const membership = screen.getByRole('textbox', { name: 'Identificador de membresía' });
  await user.type(membership, 'm-1{Enter}');
  await screen.findByText('No tienes permiso para esta acción.');
  expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
  expect(db.memberships.find((m) => m.id === 'm-1').permission_overrides).toEqual({});

  // A coordinator restores delegation while the failed lookup remains open.
  db.memberships.find((m) => m.id === 'm-2').permission_overrides = { can_delegate_perms: true };
  expect(membership).toHaveValue('m-1');
  await user.click(membership);
  await user.keyboard('{Enter}');
  const first = await screen.findByRole('combobox', { name: /Crear exámenes/ });
  await waitFor(() => expect(first).toHaveFocus());
  expect(screen.queryByText('No tienes permiso para esta acción.')).not.toBeInTheDocument();
  expect(db.memberships.find((m) => m.id === 'm-1').permission_overrides).toEqual({});
});
it('retries a failed membership lookup by submitting the same identifier again', async () => {
  const user = userEvent.setup(); manage();
  await user.click(screen.getByRole('tab', { name: 'Permisos' }));
  const membership = screen.getByRole('textbox', { name: 'Identificador de membresía' });
  await user.type(membership, 'm-new{Enter}');
  await screen.findByText('No se ha encontrado el recurso.');
  expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
  // The record becomes available after the first request failed.
  db.memberships.push({ id: 'm-new', user_id: 'u-admin', subject_id: 's-mat101', role: 'TEACHER', group_id: null, permission_overrides: {}, is_active: true });
  await user.click(membership);
  await user.keyboard('{Enter}');
  const explanation = await screen.findByText('Este usuario tiene acceso de gestor; los permisos de asignatura no limitan su acceso.');
  await waitFor(() => expect(explanation).toHaveFocus());
  expect(membership).toHaveValue('m-new');
  expect(screen.queryByText('No se ha encontrado el recurso.')).not.toBeInTheDocument();
  expect(db.memberships.find((m) => m.id === 'm-new').permission_overrides).toEqual({});
});
it('focuses the manager access explanation when all permission controls are disabled', async () => {
  db.memberships.push({ id: 'm-admin', user_id: 'u-admin', subject_id: 's-mat101', role: 'TEACHER', group_id: null, permission_overrides: {}, is_active: true });
  const user = userEvent.setup(); manage();
  const row = (await screen.findByText('admin@uam.es')).closest('tr');
  await user.click(within(row).getByRole('button', { name: 'Consultar permisos' }));
  const explanation = await screen.findByText('Este usuario tiene acceso de gestor; los permisos de asignatura no limitan su acceso.');
  await waitFor(() => expect(explanation).toHaveFocus());
  for (const select of screen.getAllByRole('combobox')) expect(select).toBeDisabled();
  expect(db.memberships.find((m) => m.id === 'm-admin').permission_overrides).toEqual({});
});
it('keeps failed membership lookups and recovery reachable with the keyboard', async () => {
  const user = userEvent.setup(); manage();
  await user.click(screen.getByRole('tab', { name: 'Permisos' }));
  const membership = screen.getByRole('textbox', { name: 'Identificador de membresía' });
  await user.type(membership, 'missing-membership{Enter}');
  let error = await screen.findByRole('alert');
  await waitFor(() => expect(error.parentElement).toHaveFocus());
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
  await user.tab();
  expect(screen.getByRole('button', { name: 'Reintentar' })).toHaveFocus();
  await user.keyboard('{Enter}');
  error = await screen.findByRole('alert');
  await waitFor(() => expect(error.parentElement).toHaveFocus());
  // The error wrapper is outside the tab order; go back to the lookup form.
  await user.tab({ shift: true });
  expect(screen.getByRole('button', { name: 'Consultar permisos' })).toHaveFocus();
  await user.tab({ shift: true });
  expect(membership).toHaveFocus();
  await user.clear(membership);
  await user.type(membership, 'm-2{Enter}');
  const first = await screen.findByRole('combobox', { name: /Crear exámenes/ });
  await waitFor(() => expect(first).toHaveFocus());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(membership).toHaveValue('m-2');
  expect(db.memberships.find((m) => m.id === 'm-2').permission_overrides).toEqual({});
});
it('honors permission overrides and denies unrelated teachers and students', async () => {
  await loginAs('javier.ruiz@uam.es', 'prof123');
  await expect(api.get('/subjects/s-mat101/groups/')).rejects.toMatchObject({ status: 403 });
  db.memberships.find((m) => m.id === 'm-2').permission_overrides = { can_manage_groups: true };
  expect((await api.get('/subjects/s-mat101/groups/')).results).toHaveLength(2);
  await expect(api.get('/subjects/s-mat101/members/')).rejects.toMatchObject({ status: 403 });
  await loginAs('elena.rodriguez@estudiante.uam.es', 'est123');
  manage(); expect(await screen.findByText('No tienes permiso para esta acción.')).toBeInTheDocument();
});
it('offers management links through hierarchical search, independent of the export shape', async () => {
  await loginAs(); renderPage(<SubjectsPage />);
  await screen.findByText('MAT101');
  expect(screen.getAllByRole('link', { name: 'Administrar' })[0]).toHaveAttribute('href', '/subjects/s-mat101/manage');
  const exported = await api.get('/subjects/export/', { export_format: 'json', course_id: 'c-2627' });
  expect(exported[0]).not.toHaveProperty('id');
  expect(exported[0]).toMatchObject({ code: 'MAT101', coordinator_email: 'maria.perez@uam.es', groups: ['Grupo 611', 'Grupo 612'] });
  expect(exported[0].teachers).toContain('javier.ruiz@uam.es');
});

describe('subject creation, editing and deletion', () => {
beforeEach(async () => { await resetDemo(); await loginAs(); });
afterEach(() => vi.restoreAllMocks());
const body = { name: 'Sistemas digitales', code: 'SD100', coordinator_id: 'u-maria' };
const fill = (scope, values = body) => {
  for (const [label, key] of [['Nombre', 'name'], ['Código', 'code'], ['Identificador del coordinador', 'coordinator_id']]) {
    fireEvent.change(scope.getByLabelText(label), { target: { value: values[key] } });
  }
};

it('creates in the active course from a historical filter, edits the coordinator and deletes with confirmation', async () => {
  const user = userEvent.setup(); renderPage(<SubjectsPage />);
  await screen.findByText('MAT101');
  const results = screen.getByRole('region', { name: 'Asignaturas' });
  expect(results).not.toHaveFocus();
  fireEvent.change(screen.getByLabelText('Curso'), { target: { value: 'c-2526' } });
  await screen.findByText('No hay registros');
  await user.click(screen.getAllByRole('button', { name: 'Crear asignatura' })[0]);
  fill(within(screen.getByRole('dialog')));
  const post = vi.spyOn(api, 'post');
  await user.click(screen.getByRole('button', { name: 'Guardar' }));
  const row = (await screen.findByText('SD100')).closest('tr');
  await waitFor(() => expect(results).toHaveFocus());
  expect(post).toHaveBeenCalledWith('/subjects/', body);
  const created = db.subjects.find((s) => s.code === body.code);
  expect(created).toMatchObject({ course_id: 'c-2627', semester: '' });
  expect(db.memberships.find((m) => m.subject_id === created.id)).toMatchObject({ user_id: 'u-maria', role: 'COORDINATOR' });
  await user.click(within(row).getByRole('button', { name: 'Editar asignatura' }));
  const dialog = within(screen.getByRole('dialog'));
  fill(dialog, { ...body, name: 'Sistemas digitales II', coordinator_id: 'u-javier' });
  fireEvent.change(dialog.getByLabelText('Semestre (opcional)'), { target: { value: '2' } });
  await user.click(dialog.getByRole('button', { name: 'Guardar' }));
  const edited = (await screen.findByText('Sistemas digitales II')).closest('tr');
  await waitFor(() => expect(results).toHaveFocus());
  expect(created).toMatchObject({ coordinator_id: 'u-javier', semester: '2' });
  expect(db.memberships.find((m) => m.subject_id === created.id && m.user_id === 'u-maria').role).toBe('TEACHER');
  expect(db.memberships.find((m) => m.subject_id === created.id && m.user_id === 'u-javier').role).toBe('COORDINATOR');
  const remove = within(edited).getByRole('button', { name: 'Eliminar asignatura' });
  await user.click(remove);
  await user.keyboard('{Escape}');
  expect(remove).toHaveFocus();
  expect(db.subjects).toContain(created);
  await user.click(remove);
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(db.subjects).not.toContain(created);
  expect(db.memberships.filter((m) => m.subject_id === created.id)).toEqual([]);
  await waitFor(() => expect(results).toHaveFocus());
  await user.tab();
  expect(screen.getAllByRole('link', { name: 'Administrar' })[0]).toHaveFocus();
}, 15000);

it('preserves input and focuses a field error on duplicate creation, then recovers', async () => {
  const user = userEvent.setup(); renderPage(<SubjectsPage />);
  await screen.findByText('MAT101');
  await user.click(screen.getByRole('button', { name: 'Crear asignatura' }));
  const dialog = within(screen.getByRole('dialog'));
  fill(dialog, { ...body, code: 'MAT101' });
  await user.click(dialog.getByRole('button', { name: 'Guardar' }));
  const code = dialog.getByLabelText('Código');
  await waitFor(() => expect(code).toHaveAttribute('aria-invalid', 'true'));
  expect(code).toHaveFocus();
  expect(code).toHaveAccessibleDescription();
  expect(dialog.getByLabelText('Nombre')).toHaveValue(body.name);
  expect(db.subjects).toHaveLength(3);
  fireEvent.change(code, { target: { value: body.code } });
  await user.click(dialog.getByRole('button', { name: 'Guardar' }));
  expect(await screen.findByText(body.code)).toBeInTheDocument();
});

it.each(['create', 'edit', 'delete'])('guards duplicate %s submissions and closing until failure, then allows retry', async (mode) => {
  const user = userEvent.setup(); renderPage(<SubjectsPage />);
  const row = (await screen.findByText('MAT101')).closest('tr');
  if (mode === 'create') await user.click(screen.getByRole('button', { name: 'Crear asignatura' }));
  else await user.click(within(row).getByRole('button', { name: mode === 'edit' ? 'Editar asignatura' : 'Eliminar asignatura' }));
  const element = screen.getByRole('dialog');
  const dialog = within(element);
  if (mode === 'create') fill(dialog);
  const original = structuredClone(db.subjects);
  let reject;
  const operation = vi.spyOn(api, { create: 'post', edit: 'patch', delete: 'del' }[mode]).mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
  const submit = dialog.getByRole('button', { name: mode === 'delete' ? 'Confirmar' : 'Guardar' });
  act(() => {
    if (mode === 'delete') { fireEvent.click(submit); fireEvent.click(submit); }
    else { fireEvent.submit(submit.closest('form')); fireEvent.submit(submit.closest('form')); }
    fireEvent.keyDown(window, { key: 'Escape' });
  });
  await user.click(dialog.getByRole('button', { name: /^(Close|Cerrar)$/ }));
  fireEvent.mouseDown(element.parentElement);
  expect(screen.getByRole('dialog')).toBe(element);
  expect(operation).toHaveBeenCalledOnce();
  expect(db.subjects).toEqual(original);
  await act(async () => { reject(new ApiError('PERMISSION_DENIED', 403)); });
  expect((await dialog.findByRole('alert')).parentElement).toHaveFocus();
  expect(submit).toBeEnabled();
  if (mode === 'delete') {
    // Existing exams still prevent deletion when the network recovers.
    await user.click(submit);
    expect(await dialog.findByText('La asignatura tiene exámenes. Elimínalos antes de borrar la asignatura.')).toBeInTheDocument();
    expect(db.subjects).toEqual(original);
    await user.keyboard('{Escape}');
  } else {
    const results = screen.getByRole('region', { name: 'Asignaturas' });
    let failReload;
    const originalGet = api.get.bind(api);
    const get = vi.spyOn(api, 'get').mockImplementationOnce(() => new Promise((_, fail) => { failReload = fail; }));
    await user.click(submit);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(get).toHaveBeenCalledOnce());
    expect(results).not.toHaveFocus();
    await act(async () => { failReload(new Error('Temporary network failure')); });
    expect((await screen.findByRole('alert')).parentElement).toHaveFocus();
    expect(results).not.toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toHaveFocus();
    let finishReload;
    get.mockImplementationOnce((...args) => new Promise((resolve) => { finishReload = () => resolve(originalGet(...args)); }));
    await user.keyboard('{Enter}');
    await waitFor(() => expect(finishReload).toBeTypeOf('function'));
    expect(results).not.toHaveFocus();
    await act(async () => { finishReload(); });
    await waitFor(() => expect(results).toHaveFocus());
    await user.tab();
    expect(screen.getAllByRole('link', { name: 'Administrar' })[0]).toHaveFocus();
  }
  expect(operation).toHaveBeenCalledTimes(2);
});

it('returns exactly SubjectResponse and 201/204 status wrappers, with no detail-only fields', () => {
  const user = db.users.find((u) => u.email === 'admin@uam.es');
  const result = subjectCrudMocks.find((h) => h.method === 'POST').handler({ db, user, body });
  expect(result.status).toBe(201);
  expect(Object.keys(result.body).sort()).toEqual(['id', 'name', 'code', 'semester', 'course_id', 'coordinator_id', 'coordinator_email', 'created_at', 'updated_at'].sort());
  expect(result.body.coordinator_email).toBe('maria.perez@uam.es');
  expect(result.body.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(Number.isNaN(Date.parse(result.body.created_at))).toBe(false);
  db.groups.push({ id: 'created-group', subject_id: result.body.id, label: 'Grupo' });
  const deleted = subjectCrudMocks.find((h) => h.method === 'DELETE').handler({ db, user, params: { subject: result.body.id } });
  expect(deleted).toMatchObject({ status: 204, body: null });
  expect(db.groups.some((g) => g.subject_id === result.body.id)).toBe(false);
});

it('permits coordinator patches, rejects teacher writes and prevents cross-organization access', async () => {
  await loginAs('javier.ruiz@uam.es', 'prof123');
  await expect(createSubject(body)).rejects.toMatchObject({ status: 403 });
  await expect(updateSubject('s-mat101', { name: 'Denied' })).rejects.toMatchObject({ status: 403 });
  await expect(deleteSubject('s-fis101')).rejects.toMatchObject({ status: 403 });
  expect(await updateSubject('s-fis101', { name: 'Física avanzada' })).toMatchObject({ name: 'Física avanzada', code: 'FIS101' });
  await loginAs();
  const other = { ...db.users[0], id: 'external-user', organization_id: 'other-org' };
  db.users.push(other);
  db.subjects.push({ ...db.subjects[0], id: 'external-subject', coordinator_id: other.id });
  await expect(updateSubject('external-subject', { name: 'Denied' })).rejects.toMatchObject({ status: 404 });
  await expect(deleteSubject('external-subject')).rejects.toMatchObject({ status: 404 });
  await expect(createSubject({ ...body, coordinator_id: other.id })).rejects.toMatchObject({ status: 409 });
});

it('validates before mutating roles and blocks archived courses, exams and missing active courses', async () => {
  const snapshot = structuredClone(db.memberships);
  await expect(updateSubject('s-mat101', { code: 'FIS101', coordinator_id: 'u-javier' })).rejects.toMatchObject({ code: 'CODE_ALREADY_EXISTS' });
  expect(db.memberships).toEqual(snapshot);
  await expect(updateSubject('s-mat101', { coordinator_id: 'missing', name: 'Changed' })).rejects.toMatchObject({ status: 409 });
  expect(db.subjects[0].name).toBe('Cálculo I');
  await expect(createSubject({ ...body, name: 'x'.repeat(256) })).rejects.toMatchObject({ status: 400 });
  await expect(deleteSubject('s-mat101')).rejects.toMatchObject({ code: 'HAS_EXAMS', status: 409 });
  db.courses.find((c) => c.is_active).is_active = false;
  await expect(createSubject(body)).rejects.toMatchObject({ code: 'NO_ACTIVE_COURSE' });
  await expect(updateSubject('s-mat101', { name: 'Denied' })).rejects.toMatchObject({ code: 'COURSE_ARCHIVED', status: 403 });
  await expect(deleteSubject('s-mat101')).rejects.toMatchObject({ code: 'COURSE_ARCHIVED', status: 403 });
  expect(db.memberships).toEqual(snapshot);
});

it('returns to the previous page after deleting its final subject without resetting the search', async () => {
  db.subjects = Array.from({ length: 26 }, (_, i) => ({ ...db.subjects[0], id: `extra-${i}`, code: `TEST${i}`, name: `Subject ${i}` }));
  const user = userEvent.setup(); renderPage(<SubjectsPage />);
  await screen.findByText('TEST0');
  fireEvent.change(screen.getByLabelText('Buscar asignaturas'), { target: { value: 'TEST' } });
  await user.click(screen.getByRole('button', { name: 'Buscar' }));
  await screen.findByText('TEST0');
  await user.click(screen.getByRole('button', { name: 'Siguiente' }));
  const row = (await screen.findByText('TEST25')).closest('tr');
  await user.click(within(row).getByRole('button', { name: 'Eliminar asignatura' }));
  const originalGet = api.get.bind(api);
  let finishReload;
  vi.spyOn(api, 'get').mockImplementationOnce((...args) => new Promise((resolve) => { finishReload = () => resolve(originalGet(...args)); }));
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar' }));
  await waitFor(() => expect(finishReload).toBeTypeOf('function'));
  const results = screen.getByRole('region', { name: 'Asignaturas' });
  expect(results).not.toHaveFocus();
  await act(async () => { finishReload(); });
  await screen.findByText('TEST0');
  expect(screen.getByText(/Página 1 de 1/)).toBeInTheDocument();
  expect(screen.getByLabelText('Buscar asignaturas')).toHaveValue('TEST');
  await waitFor(() => expect(results).toHaveFocus());
  await user.tab();
  expect(screen.getAllByRole('link', { name: 'Administrar' })[0]).toHaveFocus();
});

it('disables editing and deleting historical subjects while allowing creation in the active course', async () => {
  db.subjects.push({ ...db.subjects[0], id: 'historical', code: 'OLD100', course_id: 'c-2526' });
  const user = userEvent.setup(); renderPage(<SubjectsPage />);
  await screen.findByText('MAT101');
  fireEvent.change(screen.getByLabelText('Curso'), { target: { value: 'c-2526' } });
  const row = (await screen.findByText('OLD100')).closest('tr');
  expect(within(row).getByRole('button', { name: 'Editar asignatura' })).toBeDisabled();
  expect(within(row).getByRole('button', { name: 'Eliminar asignatura' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Crear asignatura' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: 'Crear asignatura' }));
  expect(within(screen.getByRole('dialog')).getByText(/La asignatura se crea en el curso activo/)).toBeInTheDocument();
});

});
