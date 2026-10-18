import { beforeEach, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../../lib/api/client.js';
import { db } from '../../lib/mock/db.js';
import { loginAs, renderPage, resetDemo } from '../admin/test-utils.jsx';
import ManagePage from './ManagePage.jsx';
import SubjectsPage from './SubjectsPage.jsx';

beforeEach(async () => { await resetDemo(); await loginAs('maria.perez@uam.es', 'prof123'); });
const manage = () => renderPage(<ManagePage />, '/subjects/s-mat101/manage', '/subjects/:subjectId/manage');
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
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
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
  await user.selectOptions(screen.getByLabelText(/Gestionar grupos · Por defecto: No · Efectivo: Sí/), 'inherit');
  await user.click(screen.getByRole('button', { name: 'Guardar' }));
  await screen.findByLabelText(/Gestionar grupos · Por defecto: No · Efectivo: No/);
  expect(db.memberships.find((m) => m.id === 'm-2').permission_overrides).toEqual({});
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
