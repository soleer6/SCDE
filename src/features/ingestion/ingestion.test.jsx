/* Scan incidents and ingestion tools in mock mode (contract + UI). */
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../../app/i18n.js';
import { AuthProvider } from '../../lib/auth/AuthProvider.jsx';
import { ToastProvider } from '../../ui';
import AppRouter from '../../app/AppRouter.jsx';
import { api } from '../../lib/api/client.js';
import { decodeJwt, tokenStore } from '../../lib/api/tokens.js';
import { db } from '../../lib/mock/db.js';
import { clearSubjectsCache } from '../workspace/api.js';

async function loginAs(email, password) {
  const data = await api.post('/auth/login/', { email, password }, { auth: false });
  tokenStore.set(data.access_token, data.refresh_token);
  localStorage.setItem('scde.user', JSON.stringify({ id: data.user.id, email, firstName: data.user.first_name, lastName: data.user.last_name, isStaff: Boolean(decodeJwt(data.access_token)?.is_staff) }));
  clearSubjectsCache();
}

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <ToastProvider>
          <AppRouter />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );

const rowOf = async (text) => (await screen.findAllByText(text))[0].closest('tr');
const inst = (id) => db.instances.find((i) => i.id === id);
const pagesOf = (id) => db.pages.filter((p) => p.instance_id === id).sort((a, b) => a.page_number - b.page_number);

beforeEach(async () => {
  localStorage.clear();
  db.reset();
  await i18n.changeLanguage('es');
});

describe('page management contract (mock = backend services)', () => {
  it('moves pages only within the same exam and completes an assembling instance', async () => {
    await loginAs('javier.ruiz@uam.es', 'prof123');
    const extra = pagesOf('i-e-fis-p1-5').find((p) => p.issue_type === 'EXTRA_PAGE');
    await expect(api.post(`/instances/i-e-fis-p1-5/pages/${extra.id}/move/`, { target_instance_id: 'i-e-mat-p2-1' })).rejects.toMatchObject({ code: 'DIFFERENT_EXAM' });
    await expect(api.post(`/instances/i-e-fis-p1-5/pages/${extra.id}/move/`, { target_instance_id: 'nope' })).rejects.toMatchObject({ code: 'TARGET_NOT_FOUND' });
    expect(await api.post(`/instances/i-e-fis-p1-5/pages/${extra.id}/move/`, { target_instance_id: 'i-e-fis-p1-6' })).toEqual({ detail: 'Page moved.' });
    expect(inst('i-e-fis-p1-6').status).toBe('RECEIVED');
    expect(inst('i-e-fis-p1-5').has_issues).toBe(false);
    // MISSING_PAGE is never cleared by the backend services (docs/tfg/03-backend-gaps.md#gap-6).
    expect(inst('i-e-fis-p1-6').issue_types).toContain('MISSING_PAGE');
  });

  it('reorders, accepts and discards pages; orphan list and attach are restricted', async () => {
    await loginAs('javier.ruiz@uam.es', 'prof123');
    const [p1, p2] = pagesOf('i-e-fis-p1-1');
    await api.patch('/instances/i-e-fis-p1-1/pages/reorder/', { page_ids: [p2.id, p1.id] });
    expect(pagesOf('i-e-fis-p1-1').map((p) => p.id)).toEqual([p2.id, p1.id]);
    await api.del(`/instances/i-e-fis-p1-1/pages/${p1.id}/`);
    expect(db.pages.find((p) => p.id === p1.id).status).toBe('DISCARDED');
    await expect(api.get('/orphan-pages/')).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await loginAs('admin@uam.es', 'admin123');
    const orphans = await api.get('/orphan-pages/');
    expect(orphans).toHaveLength(2);
    expect(Object.keys(orphans[0]).sort()).toEqual(['created_at', 'id', 'image_url', 'instance_id', 'issue_type', 'page_number', 'recognized_at', 'status', 'storage_ref']);
    await api.post('/instances/i-e-fis-p1-6/pages/attach/', { page_id: orphans[0].id });
    await expect(api.post('/instances/i-e-fis-p1-6/pages/attach/', { page_id: orphans[0].id })).rejects.toMatchObject({ code: 'PAGE_NOT_ORPHAN' });
    expect(inst('i-e-fis-p1-6').status).toBe('RECEIVED');
  });

  it('rejects assigning a student who already has an instance of the exam', async () => {
    await loginAs('javier.ruiz@uam.es', 'prof123');
    await expect(api.patch('/instances/i-e-fis-p1-6/', { student_id: 'u-elena' })).rejects.toMatchObject({ code: 'DUPLICATE_STUDENT' });
    const out = await api.patch('/instances/i-e-fis-p1-6/', { student_id: 'u-hugo' });
    expect(out.student_email).toMatch(/^hugo\./);
    expect(out.issue_types).toEqual(['MISSING_PAGE']);
  });
});

describe('scan incidents page', () => {
  // Kept apart from the incident flow so that each test renders a single lazy
  // route (exam page vs. issues page); isolated, the flow takes ~0.8 s.
  it('links the exam page to its pending incidents', async () => {
    await loginAs('javier.ruiz@uam.es', 'prof123');
    renderAt('/exams/e-fis-p1');
    const link = await screen.findByRole('link', { name: 'Resolver incidencias (2)' });
    expect(link).toHaveAttribute('href', '/exams/e-fis-p1/issues');
  });

  it('lets the coordinator identify the student and accept an extra page', async () => {
    await loginAs('javier.ruiz@uam.es', 'prof123');
    renderAt('/exams/e-fis-p1/issues');
    expect(await screen.findByRole('heading', { name: 'Incidencias de escaneo' })).toBeInTheDocument();

    const user = userEvent.setup();
    const table = await screen.findByRole('table', { name: 'Exámenes escaneados' });
    await user.click(await rowOf('Faltan páginas'));
    await user.selectOptions(await screen.findByLabelText('Estudiante'), 'u-hugo');
    await user.click(screen.getByRole('button', { name: 'Guardar datos' }));
    await waitFor(() => expect(inst('i-e-fis-p1-6').student_id).toBe('u-hugo'));
    // The refresh after saving updates the same table instead of unmounting it.
    expect(await within(table).findByText('Hugo Navarro')).toBeInTheDocument();
    expect(table).toBeInTheDocument();

    await user.click(await rowOf('Páginas por revisar'));
    await user.click(await screen.findByRole('button', { name: 'Aceptar' }));
    await waitFor(() => expect(inst('i-e-fis-p1-5').has_issues).toBe(false));
  });

  it('moves a page to another exam of the same test from the dialog', async () => {
    await loginAs('javier.ruiz@uam.es', 'prof123');
    renderAt('/exams/e-fis-p1/issues');
    const user = userEvent.setup();
    await user.click(await rowOf('Páginas por revisar'));
    const pages = await screen.findByRole('table', { name: 'Páginas escaneadas del examen' });
    // Regression: the dialog stayed mounted and offered the target picked for
    // another page (or cancelled), one click away from moving the wrong page.
    const second = within(pages).getAllByRole('row')[2];
    await user.click(within(second).getByRole('button', { name: 'Mover' }));
    let dialog = await screen.findByRole('dialog', { name: 'Mover la página 2' });
    await user.selectOptions(within(dialog).getByLabelText('Examen de destino'), 'i-e-fis-p1-6');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    const third = within(pages).getAllByRole('row')[3];
    await user.click(within(third).getByRole('button', { name: 'Mover' }));
    dialog = await screen.findByRole('dialog', { name: 'Mover la página 3' });
    expect(within(dialog).getByLabelText('Examen de destino')).toHaveValue('');
    expect(within(dialog).getByRole('button', { name: 'Mover' })).toBeDisabled();
    await user.selectOptions(within(dialog).getByLabelText('Examen de destino'), 'i-e-fis-p1-6');
    await user.click(within(dialog).getByRole('button', { name: 'Mover' }));
    await waitFor(() => expect(inst('i-e-fis-p1-6').status).toBe('RECEIVED'));
  });

  it('tells a teacher without the permission that they cannot resolve issues', async () => {
    await loginAs('maria.perez@uam.es', 'prof123');
    renderAt('/exams/e-fis-p1/issues');
    expect(await screen.findByText('No puedes resolver incidencias en esta asignatura')).toBeInTheDocument();
  });

  it('lets a manager attach an orphan page to the selected exam', async () => {
    await loginAs('admin@uam.es', 'admin123');
    renderAt('/exams/e-fis-p1/issues');
    const user = userEvent.setup();
    await user.click(await rowOf('Faltan páginas'));
    const orphans = await screen.findByRole('table', { name: 'Páginas escaneadas sin examen asignado' });
    await user.click(within(orphans).getAllByRole('button', { name: 'Adjuntar aquí' })[0]);
    await waitFor(() => expect(pagesOf('i-e-fis-p1-6')).toHaveLength(2));
  });
});

describe('scans page (manager)', () => {
  it('uploads a scan and lists it among the pages without an exam', async () => {
    await loginAs('admin@uam.es', 'admin123');
    renderAt('/scans');
    expect(await screen.findByRole('heading', { name: 'Escaneos' })).toBeInTheDocument();
    expect(await screen.findByText('easyocr')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.upload(screen.getByLabelText('Archivo'), new File(['%PDF'], 'aula-3.pdf', { type: 'application/pdf' }));
    await user.click(screen.getByRole('button', { name: 'Subir escaneo' }));
    expect(await screen.findByText('aula-3.pdf')).toBeInTheDocument();
    await waitFor(() => expect(db.pages.filter((p) => !p.instance_id)).toHaveLength(3));
    expect(await screen.findByText('Reconociendo')).toBeInTheDocument();
  });
});
