/* Teacher exam view in mock mode: filters, grade export and review period. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  localStorage.setItem(
    'scde.user',
    JSON.stringify({
      id: data.user.id,
      email,
      firstName: data.user.first_name,
      lastName: data.user.last_name,
      isStaff: Boolean(decodeJwt(data.access_token)?.is_staff),
    }),
  );
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

const instancesOf = (examId) => db.instances.filter((i) => i.exam_id === examId);
const bodyRows = (table) => within(table).getAllByRole('row').slice(1);
// jsdom's Blob has no text(); FileReader reads it.
const readText = (blob) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsText(blob);
  });

// jsdom has no object URLs; the export test replaces them with spies.
URL.createObjectURL ??= () => 'blob:mock';
URL.revokeObjectURL ??= () => {};

beforeEach(async () => {
  localStorage.clear();
  db.reset();
  await i18n.changeLanguage('es');
});

afterEach(() => vi.restoreAllMocks());

describe('teacher exam view', () => {
  it('filters the instances by state and explains an empty filter', async () => {
    await loginAs('maria.perez@uam.es', 'prof123');
    renderAt('/exams/e-mat-p2');
    const user = userEvent.setup();
    const table = await screen.findByRole('table', { name: 'Instancias del examen' });
    expect(bodyRows(table)).toHaveLength(8);

    const todo = screen.getByRole('tab', { name: /^Por corregir/ });
    expect(todo).toHaveTextContent('4');
    await user.click(todo);
    expect(todo).toHaveAttribute('aria-selected', 'true');
    const filtered = screen.getByRole('table', { name: 'Instancias del examen' });
    expect(bodyRows(filtered)).toHaveLength(4);

    await user.click(screen.getByRole('tab', { name: /^Publicadas/ }));
    expect(screen.queryByRole('table', { name: 'Instancias del examen' })).not.toBeInTheDocument();
    expect(screen.getByText('Ninguna instancia en este estado')).toBeInTheDocument();
    expect(screen.getByText('Publica todas las notas para poder abrir la revisión.')).toBeInTheDocument();
  });

  it('downloads the grades as CSV with the subject and exam in the file name', async () => {
    await loginAs('maria.perez@uam.es', 'prof123');
    let blob;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
      blob = b;
      return 'blob:grades';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function noNavigation() {});
    renderAt('/exams/e-mat-p2');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Exportar notas' }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(click.mock.contexts[0].download).toBe('MAT101-Parcial 2.csv');
    const lines = (await readText(blob)).split('\n');
    expect(lines[0]).toBe('nia,email,total_score');
    expect(lines).toHaveLength(1 + instancesOf('e-mat-p2').length);
  });

  it('downloads the grades as JSON on request', async () => {
    await loginAs('maria.perez@uam.es', 'prof123');
    let blob;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
      blob = b;
      return 'blob:grades';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function noNavigation() {});
    renderAt('/exams/e-mat-p2');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Exportar JSON' }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(click.mock.contexts[0].download).toBe('MAT101-Parcial 2.json');
    const rows = JSON.parse(await readText(blob));
    expect(rows).toHaveLength(instancesOf('e-mat-p2').length);
    expect(Object.keys(rows[0])).toEqual(['nia', 'email', 'total_score']);
  });

  it('shows the request count only to whoever manages the reviews', async () => {
    await loginAs('maria.perez@uam.es', 'prof123');
    const { unmount } = renderAt('/exams/e-mat-p1');
    const panel = (await screen.findByRole('heading', { name: 'Revisión' }, { timeout: 8000 })).closest('section, .ui-panel');
    expect(await within(panel).findByText('Solicitudes')).toBeInTheDocument();
    unmount();

    const exam = db.exams.find((e) => e.id === 'e-mat-p1');
    const m = db.memberships.find((x) => x.user_id === 'u-maria' && x.subject_id === exam.subject_id);
    m.permission_overrides = { ...(m.permission_overrides || {}), can_manage_reviews: false };
    renderAt('/exams/e-mat-p1');
    const after = (await screen.findByRole('heading', { name: 'Revisión' }, { timeout: 8000 })).closest('section, .ui-panel');
    expect(await within(after).findByText('Abierta')).toBeInTheDocument();
    expect(within(after).queryByText('Solicitudes')).not.toBeInTheDocument();
  });

  it('reports a partial publication and keeps the retry available', async () => {
    const list = instancesOf('e-mat-p2');
    list.forEach((i) => {
      i.status = 'GRADED';
      i.has_issues = false;
    });
    list[0].has_issues = true;
    await loginAs('maria.perez@uam.es', 'prof123');
    renderAt('/exams/e-mat-p2');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /^Publicar \d+ notas/ }, { timeout: 8000 }));
    const alert = await screen.findByText(/siguen corregidas pero sin publicar/);
    const box = alert.closest('[role="alert"]');
    expect(within(box).getByText(/tiene incidencias sin resolver/)).toBeInTheDocument();
    expect(within(box).getAllByRole('listitem')).toHaveLength(1);
    expect(list.filter((i) => i.status === 'PUBLISHED')).toHaveLength(list.length - 1);
    expect(list[0].status).toBe('GRADED');
    expect(await screen.findByRole('button', { name: /^Publicar 1 nota/ })).toBeInTheDocument();
  });

  it('opens the review period once every grade is published, and forgets a refused attempt', async () => {
    instancesOf('e-mat-p2').forEach((i) => {
      i.status = 'PUBLISHED';
    });
    await loginAs('maria.perez@uam.es', 'prof123');
    renderAt('/exams/e-mat-p2');
    const user = userEvent.setup();
    expect(await screen.findByText(/Aún no hay periodo de revisión/)).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Abrir revisión' }));
    let dialog = await screen.findByRole('dialog', {
      name: 'Abrir periodo de revisión',
    });
    const to = within(dialog).getByLabelText('Hasta');
    await user.clear(to);
    await user.type(to, '2020-01-01T10:00');
    await user.click(within(dialog).getByRole('button', { name: 'Abrir revisión' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('La fecha de inicio debe ser anterior a la de fin.');
    expect(db.reviews.some((r) => r.exam_id === 'e-mat-p2')).toBe(false);

    // Closing discards the refused attempt: the dialog opens again clean and with fresh dates.
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await user.click(screen.getByRole('button', { name: 'Abrir revisión' }));
    dialog = await screen.findByRole('dialog', {
      name: 'Abrir periodo de revisión',
    });
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    expect(new Date(within(dialog).getByLabelText('Hasta').value) > new Date(within(dialog).getByLabelText('Desde').value)).toBe(true);

    await user.click(within(dialog).getByRole('button', { name: 'Abrir revisión' }));
    expect(await screen.findByText('Periodo de revisión creado')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByText('Abierta')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir revisión' })).not.toBeInTheDocument();
    await waitFor(() => expect(instancesOf('e-mat-p2').every((i) => i.status === 'IN_REVIEW')).toBe(true));
  });
});
