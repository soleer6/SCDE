import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../../../app/i18n.js';
import AppRouter from '../../../app/AppRouter.jsx';
import { AuthProvider } from '../../../lib/auth/AuthProvider.jsx';
import { api, USE_MOCK } from '../../../lib/api/client.js';
import { ToastProvider } from '../../../ui';
import { clearSubjectsCache } from '../api.js';
import { otherSession, signIn } from '../../grading/real-backend/session.js';
vi.mock('react-pdf', () => ({ pdfjs: { GlobalWorkerOptions: {} }, Document: () => null, Page: () => null }));
let fx, manager;
beforeAll(async () => {
  expect(USE_MOCK).toBe(false);
  fx = JSON.parse((await readFile(join(process.env.LOCALAPPDATA, 'SCDE/integration/fixtures-a-h01.local.json'), 'utf8')).trimStart());
  manager = await otherSession({ ...fx, password: fx.managerPassword }, 'manager');
  await i18n.changeLanguage('es');
});
afterEach(async () => {
  cleanup(); vi.restoreAllMocks();
  await manager.patch(`/memberships/${fx.membershipId}/permissions/`, { permissions: { can_create_exams: null, can_create_rubric: null, can_assign_correctors: null, can_export_grades: null } });
  await manager.patch('/config/', { role_permission_defaults: {} });
});
const override = async (permissions) => expect((await manager.patch(`/memberships/${fx.membershipId}/permissions/`, { permissions })).status).toBe(200);
const refresh = () => act(() => window.dispatchEvent(new Event('focus')));
async function mount(path = `/subjects/${fx.subjectId}`, role = 'teacher', password = fx.password) {
  await signIn({ ...fx, password }, role);
  render(<MemoryRouter initialEntries={[path]}><AuthProvider><ToastProvider><AppRouter /></ToastProvider></AuthProvider></MemoryRouter>);
}
async function subjectReady() { await screen.findByRole('table', { name: 'Exámenes' }, { timeout: 10000 }); }

it('actual subject page follows grant/revoke, organization defaults and null inheritance', async () => {
  await override({ can_create_exams: false }); await mount(); await subjectReady();
  expect(screen.queryByRole('button', { name: 'Nuevo examen' })).not.toBeInTheDocument();
  await override({ can_create_exams: true }); refresh();
  await userEvent.click(await screen.findByRole('button', { name: 'Nuevo examen' }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  await override({ can_create_exams: false }); refresh(); await subjectReady();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Nuevo examen' })).not.toBeInTheDocument();
  expect((await manager.patch('/config/', { role_permission_defaults: { TEACHER: { can_create_exams: true } } })).status).toBe(200);
  await override({ can_create_exams: null }); refresh();
  await screen.findByRole('button', { name: 'Nuevo examen' });
  await manager.patch('/config/', { role_permission_defaults: { TEACHER: { can_create_exams: false } } });
  refresh(); await subjectReady(); expect(screen.queryByRole('button', { name: 'Nuevo examen' })).not.toBeInTheDocument();
});
it('direct setup guard follows effective grants and removes revoked tabs; Django rejects stale create and triggers refetch', async () => {
  await override({ can_create_exams: false, can_create_rubric: false, can_assign_correctors: false });
  await mount(`/exams/${fx.examId}/setup`);
  await screen.findByText('No tienes permisos para configurar este examen');
  await override({ can_create_exams: true }); refresh();
  await screen.findByRole('tab', { name: 'Datos' });
  await override({ can_create_exams: false });
  await act(async () => { await expect(api.post(`/subjects/${fx.subjectId}/exams/`, { name: 'Rejected H01' })).rejects.toMatchObject({ status: 403 }); });
  await screen.findByText('No tienes permisos para configurar este examen');
  expect(screen.queryByRole('tab')).not.toBeInTheDocument();
});
it('foreign tenant fails closed and cannot discover or alter the original membership', async () => {
  await mount(`/subjects/${fx.subjectId}`, 'foreign', fx.foreignPassword);
  await screen.findByRole('button', { name: 'Reintentar' });
  expect(screen.queryByRole('button', { name: 'Nuevo examen' })).not.toBeInTheDocument();
  expect(await api.get('/my-subjects/')).toEqual([]);
  await expect(api.get(`/memberships/${fx.membershipId}/permissions/`)).rejects.toMatchObject({ status: 404 });
});
it('exam dashboard export buttons follow effective grants and a real 403 revocation', async () => {
  await override({ can_export_grades: false }); await mount(`/exams/${fx.examId}`);
  await screen.findByRole('heading', { name: 'Examen H01' });
  expect(screen.queryByRole('button', { name: 'Exportar notas' })).not.toBeInTheDocument();
  await override({ can_export_grades: true }); refresh();
  await screen.findByRole('button', { name: 'Exportar notas' });
  await override({ can_export_grades: false });
  await act(async () => { await expect(api.get(`/exams/${fx.examId}/export/`, { export_format: 'json' })).rejects.toMatchObject({ status: 403 }); });
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Exportar notas' })).not.toBeInTheDocument());
});
it('membership inactivation removes granted controls on refocus; reactivation recovers', async () => {
  await override({ can_create_exams: true }); await mount(); await screen.findByRole('button', { name: 'Nuevo examen' });
  const active = (value) => {
    expect(fx.membershipId).toMatch(/^[a-f0-9-]{36}$/); expect(fx.organizationId).toMatch(/^[a-f0-9-]{36}$/);
    execFileSync('docker', ['exec', '-e', 'PYTHONPATH=/app:/runtime', 'scde-integration-api-1', 'python', '-c',
      `import django; django.setup(); from apps.subjects.models.subjects import SubjectMembership; assert SubjectMembership.unfiltered.filter(pk='${fx.membershipId}', organization_id='${fx.organizationId}', subject__code='H01').update(is_active=${value}) == 1`]);
  };
  try {
    active('False'); refresh(); await subjectReady();
    expect(screen.queryByRole('button', { name: 'Nuevo examen' })).not.toBeInTheDocument();
    expect(await api.get('/my-subjects/')).toEqual([]);
  } finally { active('True'); }
  refresh(); await screen.findByRole('button', { name: 'Nuevo examen' });
});
it('a successful own permission edit invalidates discovery through the common API client', async () => {
  await mount(`/subjects/${fx.subjectId}`, 'coordinator'); await subjectReady();
  const spy = vi.spyOn(api, 'get');
  const response = await api.patch(`/memberships/${fx.coordinatorMembershipId}/permissions/`, { permissions: { can_export_grades: false } });
  expect(response).toHaveProperty('permissions');
  await waitFor(() => expect(spy.mock.calls.some(([p]) => p === '/my-subjects/')).toBe(true));
  await api.patch(`/memberships/${fx.coordinatorMembershipId}/permissions/`, { permissions: { can_export_grades: null } });
  clearSubjectsCache();
});

