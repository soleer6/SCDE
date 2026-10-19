/* Student review requests in mock mode: plurals, requests already made
 * elsewhere, a window that closes meanwhile and where the focus lands. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-pdf', () => ({
  pdfjs: { GlobalWorkerOptions: {} },
  Document: ({ children }) => <div data-testid="pdf-doc">{children}</div>,
  Page: () => <div data-testid="pdf-page" />,
}));

import i18n from '../../app/i18n.js';
import { AuthProvider } from '../../lib/auth/AuthProvider.jsx';
import { ToastProvider } from '../../ui';
import AppRouter from '../../app/AppRouter.jsx';
import { api } from '../../lib/api/client.js';
import { tokenStore } from '../../lib/api/tokens.js';
import { db } from '../../lib/mock/db.js';
import { clearSubjectsCache } from '../workspace/api.js';

globalThis.ResizeObserver ??= class {
  observe() {}
  disconnect() {}
};
URL.createObjectURL ??= () => 'blob:mock';
URL.revokeObjectURL ??= () => {};

const INSTANCE = 'i-e-mat-p1-1'; // Elena's, IN_REVIEW with the window OPEN

async function loginAs(email, password) {
  const data = await api.post('/auth/login/', { email, password }, { auth: false });
  tokenStore.set(data.access_token, data.refresh_token);
  localStorage.setItem('scde.user', JSON.stringify({ id: data.user.id, email, firstName: data.user.first_name, lastName: data.user.last_name, isStaff: false }));
  clearSubjectsCache();
}

const renderResult = () =>
  render(
    <MemoryRouter initialEntries={['/exams/e-mat-p1']}>
      <AuthProvider>
        <ToastProvider>
          <AppRouter />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );

/** The same request sent meanwhile from another tab. */
const requestElsewhere = (problemId) =>
  db.review_requests.push({
    id: `rr-${problemId}`, instance_id: INSTANCE, problem_id: problemId, student_message: 'Desde otra pestaña',
    resolved: false, resolved_at: null, resolver_message: '', created_at: '2026-10-14T09:00:00Z',
  });

beforeEach(async () => {
  localStorage.clear();
  db.reset();
  await i18n.changeLanguage('es');
  await loginAs('elena.rodriguez@estudiante.uam.es', 'est123');
});

describe('student review requests', () => {
  it('counts what the backend created and focuses the request list', async () => {
    renderResult();
    const user = userEvent.setup();
    await user.click(await screen.findByLabelText('Límites', {}, { timeout: 8000 }));
    expect(screen.getByRole('button', { name: 'Pedir revisión de 1 problema' })).toBeInTheDocument();
    await user.click(screen.getByLabelText('Derivadas'));
    requestElsewhere('p-e-mat-p1-2');
    await user.click(screen.getByRole('button', { name: 'Pedir revisión de 2 problemas' }));

    expect(await screen.findByText('Enviadas 1 de 2: el resto ya estaba solicitado.')).toBeInTheDocument();
    const list = await screen.findByRole('region', { name: 'Tus solicitudes' });
    await waitFor(() => expect(list).toHaveFocus());
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByLabelText('Derivadas · ya solicitada')).toBeDisabled();
    // The earlier message is kept, as get_or_create does.
    expect(db.review_requests.find((r) => r.problem_id === 'p-e-mat-p1-2' && r.instance_id === INSTANCE).student_message).toBe('Desde otra pestaña');
  });

  it('says so when every picked problem had already been requested', async () => {
    renderResult();
    const user = userEvent.setup();
    await user.click(await screen.findByLabelText('Límites', {}, { timeout: 8000 }));
    requestElsewhere('p-e-mat-p1-1');
    await user.click(screen.getByRole('button', { name: 'Pedir revisión de 1 problema' }));
    expect(await screen.findByText('Esos problemas ya tenían una solicitud de revisión.')).toBeInTheDocument();
    expect(await screen.findByLabelText('Límites · ya solicitada')).toBeDisabled();
    expect(db.review_requests.filter((r) => r.instance_id === INSTANCE)).toHaveLength(1);
  });

  it('replaces the form and moves the focus when the window closed meanwhile', async () => {
    renderResult();
    const user = userEvent.setup();
    await user.click(await screen.findByLabelText('Límites', {}, { timeout: 8000 }));
    await user.type(screen.getByLabelText('Motivo'), 'Falta un apartado');
    db.reviews.find((r) => r.exam_id === 'e-mat-p1').status = 'CLOSED';
    await user.click(screen.getByRole('button', { name: 'Pedir revisión de 1 problema' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('El periodo de revisión no está abierto.');
    expect(await screen.findByText('El periodo de revisión ha terminado')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByLabelText('Límites')).not.toBeInTheDocument());
    // The page stayed mounted: the notice that replaces the form takes the focus.
    await waitFor(() => expect(document.activeElement).toHaveTextContent('El periodo de revisión no está abierto.'));
    expect(document.activeElement.tagName).toBe('P');
    expect(db.review_requests.some((r) => r.instance_id === INSTANCE)).toBe(false);
  });
});
