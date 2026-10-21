import '@testing-library/jest-dom/vitest';
import { afterEach, beforeAll, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import i18n from '@scde-integration/src/app/i18n.js';
import { AuthProvider, useAuth } from '@scde-integration/src/lib/auth/AuthProvider.jsx';
import { api, USE_MOCK } from '@scde-integration/src/lib/api/client.js';
import { tokenStore } from '@scde-integration/src/lib/api/tokens.js';
import ProfilePage from '@scde-integration/src/features/profile/ProfilePage.jsx';
import UsersPage from '@scde-integration/src/features/admin/UsersPage.jsx';
import CoursesPage from '@scde-integration/src/features/admin/CoursesPage.jsx';
import SubjectsPage from '@scde-integration/src/features/subject-admin/SubjectsPage.jsx';
import ManagePage from '@scde-integration/src/features/subject-admin/ManagePage.jsx';
import PermissionsEditor from '@scde-integration/src/features/subject-admin/PermissionsEditor.jsx';

let fixture;
beforeAll(async () => {
  fixture = JSON.parse(await readFile(process.env.SCDE_FIXTURE_FILE || join(process.env.LOCALAPPDATA, 'SCDE/integration/fixtures-codex.local.json'), 'utf8'));
  expect(USE_MOCK).toBe(false);
  await i18n.changeLanguage('es');
});
afterEach(cleanup);

async function signIn(role) {
  localStorage.clear();
  tokenStore.clear();
  const data = await api.post('/auth/login/', { email: fixture[role], password: fixture.password }, { auth: false });
  expect(data.user.organization_id).toBe(fixture.organizationId);
  tokenStore.set(data.access_token, data.refresh_token);
  localStorage.setItem('scde.user', JSON.stringify({
    id: data.user.id, email: data.user.email, firstName: data.user.first_name, lastName: data.user.last_name,
    organizationId: data.user.organization_id, isStaff: role === 'manager', isSuperadmin: false,
  }));
}
// Test-only observer of the actual session provider.
// eslint-disable-next-line react-refresh/only-export-components
function SessionEmail() {
  const { session } = useAuth();
  return <output data-testid="session-email">{session.email}</output>;
}
function mount(page, path = '/') {
  return render(<MemoryRouter initialEntries={[path]}><AuthProvider><SessionEmail />{page}</AuthProvider></MemoryRouter>);
}

it('saves a real profile email and updates the active session only after Django accepts it', async () => {
  await signIn('student');
  mount(<ProfilePage />);
  const email = await screen.findByLabelText('Email', {}, { timeout: 10000 });
  expect(email).toHaveValue(fixture.student);
  const changed = `ui-${Date.now()}@scde.local`;
  try {
    fireEvent.change(email, { target: { value: changed } });
    fireEvent.submit(email.closest('form'));
    await waitFor(() => expect(screen.getByTestId('session-email')).toHaveTextContent(changed), { timeout: 10000 });
    expect(JSON.parse(localStorage.getItem('scde.user')).email).toBe(changed);
    expect((await api.get('/profile/')).email).toBe(changed);
    cleanup();
    mount(<ProfilePage />);
    expect(await screen.findByLabelText('Email', {}, { timeout: 10000 })).toHaveValue(changed);
    expect(screen.getByTestId('session-email')).toHaveTextContent(changed);
  } finally {
    await api.patch('/profile/', { email: fixture.student });
  }
});

it('renders PostgreSQL users and the active course through the production HTTP client', async () => {
  await signIn('manager');
  mount(<UsersPage />);
  expect(await screen.findByText(fixture.manager, {}, { timeout: 10000 })).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  cleanup();
  const current = await api.get('/courses/current/');
  mount(<CoursesPage />);
  expect(await screen.findByText(current.label, {}, { timeout: 10000 })).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

async function createAdminSubject() {
  const manager = await api.get('/profile/');
  return api.post('/subjects/', { name: 'Administración de componentes', code: `UI-${Date.now()}`, coordinator_id: manager.id });
}

it('creates and edits a subject through the real administration form', async () => {
  await signIn('manager');
  const manager = await api.get('/profile/');
  const code = `UI-${Date.now()}`;
  mount(<SubjectsPage />);
  const create = await screen.findByRole('button', { name: 'Crear asignatura' });
  await waitFor(() => expect(create).toBeEnabled());
  fireEvent.click(create);
  const dialog = within(screen.getByRole('dialog'));
  for (const [label, value] of [['Nombre', 'Asignatura de componentes'], ['Código', code], ['Identificador del coordinador', manager.id]]) {
    fireEvent.change(dialog.getByLabelText(label), { target: { value } });
  }
  fireEvent.click(dialog.getByRole('button', { name: 'Guardar' }));
  const row = (await screen.findByText(code, {}, { timeout: 10000 })).closest('tr');
  fireEvent.click(within(row).getByRole('button', { name: 'Editar asignatura' }));
  const edit = within(screen.getByRole('dialog'));
  fireEvent.change(edit.getByLabelText('Nombre'), { target: { value: 'Asignatura verificada' } });
  fireEvent.click(edit.getByRole('button', { name: 'Guardar' }));
  await screen.findByText('Asignatura verificada', {}, { timeout: 10000 });
  const current = await api.get('/courses/current/');
  const saved = (await api.get('/search/', { course_id: current.id, q: code })).results.find(s => s.code === code);
  expect((await api.get(`/subjects/${saved.id}/`)).name).toBe('Asignatura verificada');
});

it('creates/renames a group and assigns a real student through the management forms', async () => {
  await signIn('manager');
  const subject = await createAdminSubject();
  const student = await api.post('/auth/login/', { email: fixture.student, password: fixture.password }, { auth: false });
  expect(student.user.organization_id).toBe(fixture.organizationId);
  mount(<Routes><Route path="/subjects/:subjectId/manage" element={<ManagePage />} /></Routes>, `/subjects/${subject.id}/manage`);
  await screen.findByText(fixture.manager, {}, { timeout: 10000 });
  fireEvent.click(screen.getByRole('tab', { name: 'Grupos' }));
  const create = screen.getByRole('button', { name: 'Crear grupo' });
  await waitFor(() => expect(create).toBeEnabled());
  fireEvent.click(create);
  fireEvent.change(screen.getByLabelText('Nombre del grupo'), { target: { value: 'Grupo de componentes' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
  const row = (await screen.findByText('Grupo de componentes', {}, { timeout: 10000 })).closest('tr');
  fireEvent.click(within(row).getByRole('button', { name: 'Renombrar grupo' }));
  fireEvent.change(screen.getByLabelText('Nombre del grupo'), { target: { value: 'Grupo verificado' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
  await screen.findByText('Grupo verificado', {}, { timeout: 10000 });
  const group = (await api.get(`/subjects/${subject.id}/groups/`)).results.find(g => g.label === 'Grupo verificado');
  fireEvent.click(screen.getByRole('tab', { name: 'Miembros' }));
  const add = screen.getByRole('button', { name: 'Añadir miembro' });
  await waitFor(() => expect(add).toBeEnabled());
  fireEvent.click(add);
  expect(screen.queryByRole('option', { name: 'Coordinador' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Identificador de usuario'), { target: { value: student.user.id } });
  fireEvent.change(screen.getByLabelText('Identificador de grupo (opcional)'), { target: { value: group.id } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
  await screen.findByText(fixture.student, {}, { timeout: 10000 });
  expect((await api.get(`/subjects/${subject.id}/members/`)).results.find(m => m.user_id === student.user.id).group_id).toBe(group.id);
});

it('restores permission inheritance with null and verifies the stored override is removed', async () => {
  await signIn('manager');
  const subject = await createAdminSubject();
  const teacher = await api.post('/auth/login/', { email: fixture.teacher, password: fixture.password }, { auth: false });
  expect(teacher.user.organization_id).toBe(fixture.organizationId);
  const member = await api.post(`/subjects/${subject.id}/members/`, { user_id: teacher.user.id, role: 'TEACHER' });
  await api.patch(`/memberships/${member.id}/permissions/`, { permissions: { can_manage_groups: true } });
  // Direct lookups lack raw overrides and GET omits permissions that are false.
  mount(<PermissionsEditor member={{ id: member.id }} />);
  const groups = await screen.findByRole('combobox', { name: /Gestionar grupos/ }, { timeout: 10000 });
  expect(groups).toHaveValue('true');
  fireEvent.change(groups, { target: { value: 'inherit' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
  await screen.findByText('Cambios guardados', {}, { timeout: 10000 });
  expect((await api.get(`/subjects/${subject.id}/members/`)).results.find(m => m.id === member.id).permission_overrides).toEqual({});
  cleanup();
  await signIn('teacher');
  await expect(api.get(`/subjects/${subject.id}/groups/`)).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
});

it('renders the real permission denial for a student opening member management', async () => {
  await signIn('student');
  const subjects = await api.get('/my-subjects/');
  expect(subjects.length).toBeGreaterThan(0);
  mount(<Routes><Route path="/subjects/:subjectId/manage" element={<ManagePage />} /></Routes>, `/subjects/${subjects[0].id}/manage`);
  expect(await screen.findByRole('alert', {}, { timeout: 10000 })).toHaveTextContent('No tienes permiso para esta acción.');
  expect(screen.getByRole('button', { name: 'Añadir miembro' })).toBeDisabled();
});

it('recovers concurrent real HTTP requests by rotating a rejected access token once', async () => {
  await signIn('teacher');
  const refresh = tokenStore.getRefresh();
  tokenStore.set('expired-integration-token', refresh);
  const [profile, tasks] = await Promise.all([api.get('/profile/'), api.get('/my-tasks/')]);
  expect(profile.email).toBe(fixture.teacher);
  expect(Array.isArray(tasks.grading_tasks)).toBe(true);
  expect(tokenStore.getAccess()).not.toBe('expired-integration-token');
  expect(tokenStore.getRefresh()).not.toBe(refresh);
});
