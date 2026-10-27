import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../../lib/auth/AuthProvider.jsx';
import { api } from '../../lib/api/client.js';
import { tokenStore } from '../../lib/api/tokens.js';
import { ApiError } from '../../lib/api/errors.js';
import { can } from '../../lib/permissions.js';
import { db } from '../../lib/mock/db.js';
import { ToastProvider } from '../../ui';
import i18n from '../../app/i18n.js';
import AppRouter from '../../app/AppRouter.jsx';
import { clearSubjectsCache, useMySubjects } from './api.js';

async function login(email = 'javier.ruiz@uam.es') {
  const data = await api.post('/auth/login/', { email, password: 'prof123' }, { auth: false });
  tokenStore.set(data.access_token, data.refresh_token);
  localStorage.setItem('scde.user', JSON.stringify({ id: data.user.id, organizationId: data.user.organization_id }));
  clearSubjectsCache();
}
function Probe() {
  const { session, updateSession } = useAuth();
  const subjects = useMySubjects();
  const nav = useNavigate();
  return <>
    <output>{subjects.loading ? 'loading' : subjects.error ? 'error' : can(session, subjects.membershipOf('s-mat101'), 'can_create_exams') ? 'allowed' : 'denied'}</output>
    <button onClick={subjects.reload}>reload</button>
    <button onClick={() => nav('/other')}>context</button>
    <button onClick={() => updateSession({ organizationId: 'foreign' })}>tenant</button>
  </>;
}
const mount = (element = <Probe />, path = '/') => render(<MemoryRouter initialEntries={[path]}><AuthProvider><ToastProvider>{element}</ToastProvider></AuthProvider></MemoryRouter>);
const member = () => db.memberships.find((m) => m.user_id === 'u-javier' && m.subject_id === 's-mat101');
beforeEach(async () => { localStorage.clear(); db.reset(); clearSubjectsCache(); await i18n.changeLanguage('es'); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('uses a strict complete effective map; roles and missing/unknown values grant nothing', () => {
  expect(can({}, 'COORDINATOR', 'can_create_exams')).toBe(false);
  expect(can({}, { membership_id: 'm', effective_permissions: { can_create_exams: 'true' } }, 'can_create_exams')).toBe(false);
  expect(can({}, { effective_permissions: { can_create_exams: true } }, 'can_create_exams')).toBe(false);
  expect(can({ isStaff: true }, null, 'can_create_exams')).toBe(true);
  expect(can({ isStaff: true }, null, 'unknown')).toBe(false);
});
it('updates grant, revoke, live organization default and null inheritance without role fallback', async () => {
  await login(); mount(); expect(await screen.findByText('denied')).toBeInTheDocument();
  member().permission_overrides.can_create_exams = true;
  await userEvent.click(screen.getByText('reload')); expect(await screen.findByText('allowed')).toBeInTheDocument();
  member().permission_overrides.can_create_exams = false;
  db.org_config.role_permission_defaults = { TEACHER: { can_create_exams: true } };
  await userEvent.click(screen.getByText('reload')); expect(await screen.findByText('denied')).toBeInTheDocument();
  member().permission_overrides.can_create_exams = null;
  await userEvent.click(screen.getByText('reload')); expect(await screen.findByText('allowed')).toBeInTheDocument();
  db.org_config.role_permission_defaults.TEACHER.can_create_exams = false;
  act(() => window.dispatchEvent(new Event('focus'))); expect(await screen.findByText('denied')).toBeInTheDocument();
});
it('removes the actual create button and open dialog after a revocation', async () => {
  await login(); member().permission_overrides.can_create_exams = true;
  mount(<AppRouter />, '/subjects/s-mat101');
  await userEvent.click(await screen.findByRole('button', { name: 'Nuevo examen' }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  member().permission_overrides.can_create_exams = false;
  act(() => clearSubjectsCache());
  await screen.findByRole('table', { name: 'Exámenes' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Nuevo examen' })).not.toBeInTheDocument();
});
it('exam actions follow effective coordinator revocations and later grants', async () => {
  await login('maria.perez@uam.es');
  const m = db.memberships.find((x) => x.user_id === 'u-maria' && x.subject_id === 's-mat101');
  m.permission_overrides = { can_create_exams: false, can_create_rubric: false, can_assign_correctors: false,
    can_publish_grades: false, can_export_grades: false, can_manage_reviews: false, can_resolve_issues: false };
  mount(<AppRouter />, '/exams/e-mat-p2');
  await screen.findByRole('table', { name: 'Instancias del examen' });
  expect(screen.queryByRole('button', { name: 'Exportar notas' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Configurar examen' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Publicar notas/ })).not.toBeInTheDocument();
  m.permission_overrides.can_export_grades = true;
  act(() => clearSubjectsCache()); await screen.findByRole('button', { name: 'Exportar notas' });
  m.permission_overrides.can_export_grades = false;
  act(() => clearSubjectsCache());
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Exportar notas' })).not.toBeInTheDocument());
});
it('fails closed while refreshing and on error, retries with a fresh request', async () => {
  await login(); member().permission_overrides.can_create_exams = true;
  mount(); await screen.findByText('allowed');
  let reject;
  const spy = vi.spyOn(api, 'get').mockImplementationOnce(() => new Promise((_, r) => { reject = r; }));
  act(() => clearSubjectsCache());
  expect(screen.getByText('loading')).toBeInTheDocument(); expect(screen.queryByText('allowed')).not.toBeInTheDocument();
  await act(async () => reject(new ApiError('NETWORK_ERROR', 0)));
  expect(await screen.findByText('error')).toBeInTheDocument();
  spy.mockRestore(); member().permission_overrides.can_create_exams = false;
  await userEvent.click(screen.getByText('reload')); await screen.findByText('denied');
});
it('ignores an older granted response after a newer revocation', async () => {
  await login(); let resolve;
  const spy = vi.spyOn(api, 'get').mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
  mount(); await waitFor(() => expect(resolve).toBeTypeOf('function'));
  act(() => clearSubjectsCache()); await screen.findByText('denied');
  await act(async () => resolve([{ id: 's-mat101', membership_id: 'old', effective_permissions: { can_create_exams: true } }]));
  expect(screen.getByText('denied')).toBeInTheDocument(); spy.mockRestore();
});
it('refetches on route and tenant context changes and excludes inconsistent foreign membership', async () => {
  await login(); member().permission_overrides.can_create_exams = true;
  const spy = vi.spyOn(api, 'get'); mount(); await screen.findByText('allowed');
  member().permission_overrides.can_create_exams = false;
  await userEvent.click(screen.getByText('context')); await screen.findByText('denied');
  member().organization_id = 'foreign';
  await userEvent.click(screen.getByText('tenant')); await screen.findByText('denied');
  expect(spy.mock.calls.filter(([p]) => p === '/my-subjects/')).toHaveLength(3);
});
it('excludes inactive memberships, courses and accounts', async () => {
  await login(); member().permission_overrides.can_create_exams = true;
  mount(); await screen.findByText('allowed');
  member().is_active = false; act(() => clearSubjectsCache()); await screen.findByText('denied');
  member().is_active = true; db.courses.find((c) => c.id === 'c-2627').is_active = false;
  act(() => clearSubjectsCache()); await screen.findByText('denied');
  db.users.find((u) => u.id === 'u-javier').is_active = false;
  act(() => clearSubjectsCache()); await screen.findByText('denied');
});
it('refetches on an actual 403 without looping repeated denials', async () => {
  await login(); member().permission_overrides.can_create_exams = true;
  const spy = vi.spyOn(api, 'get'); mount(); await screen.findByText('allowed');
  member().permission_overrides.can_create_exams = false;
  await act(async () => { await expect(api.get('/subjects/s-prg102/')).rejects.toMatchObject({ status: 403 }); });
  await screen.findByText('denied');
  const before = spy.mock.calls.filter(([p]) => p === '/my-subjects/').length;
  await act(async () => { await expect(api.get('/subjects/s-prg102/')).rejects.toMatchObject({ status: 403 }); });
  expect(spy.mock.calls.filter(([p]) => p === '/my-subjects/')).toHaveLength(before);
});
