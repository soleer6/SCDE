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
  await user.selectOptions(input, 'true');
  await user.click(screen.getByRole('button', { name: 'Guardar' }));
  expect(await screen.findByLabelText(/Gestionar grupos · Por defecto: No · Efectivo: Sí/)).toBeInTheDocument();
  expect(db.memberships.find((m) => m.id === 'm-2').permission_overrides).toEqual({ can_manage_groups: true });
  await user.selectOptions(screen.getByLabelText(/Gestionar grupos · Por defecto: No · Efectivo: Sí/), 'inherit');
  await user.click(screen.getByRole('button', { name: 'Guardar' }));
  await screen.findByLabelText(/Gestionar grupos · Por defecto: No · Efectivo: No/);
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
it('offers management links to staff via the subject export', async () => {
  await loginAs(); renderPage(<SubjectsPage />);
  await screen.findByText('MAT101');
  expect(screen.getAllByRole('link', { name: 'Administrar' })[0]).toHaveAttribute('href', '/subjects/s-mat101/manage');
});
