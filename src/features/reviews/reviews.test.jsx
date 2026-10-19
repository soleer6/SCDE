/* Teacher review inbox in mock mode: replies, focus and stale requests. */
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../../app/i18n.js';
import { AuthProvider } from '../../lib/auth/AuthProvider.jsx';
import { ToastProvider } from '../../ui';
import AppRouter from '../../app/AppRouter.jsx';
import { api } from '../../lib/api/client.js';
import { tokenStore } from '../../lib/api/tokens.js';
import { db } from '../../lib/mock/db.js';
import { clearSubjectsCache } from '../workspace/api.js';

async function loginAs(email, password) {
  const data = await api.post('/auth/login/', { email, password }, { auth: false });
  tokenStore.set(data.access_token, data.refresh_token);
  localStorage.setItem('scde.user', JSON.stringify({ id: data.user.id, email, firstName: data.user.first_name, lastName: data.user.last_name, isStaff: false }));
  clearSubjectsCache();
}

const renderInbox = () =>
  render(
    <MemoryRouter initialEntries={['/reviews']}>
      <AuthProvider>
        <ToastProvider>
          <AppRouter />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );

/** A second pending request (problem «Límites») on another instance of the same exam. */
function addSecondRequest() {
  const other = db.instances.find((i) => i.exam_id === 'e-mat-p1' && i.id !== 'i-e-mat-p1-3' && i.student_id);
  db.review_requests.push({
    id: 'rr-2', instance_id: other.id, problem_id: 'p-e-mat-p1-1', student_message: '', resolved: false,
    resolved_at: null, resolver_message: '', created_at: '2026-10-14T09:00:00Z',
  });
}

const itemOf = async (problem) => (await screen.findByRole('heading', { name: new RegExp(`^${problem}`) })).closest('li');

beforeEach(async () => {
  localStorage.clear();
  db.reset();
  await i18n.changeLanguage('es');
  await loginAs('maria.perez@uam.es', 'prof123');
});

describe('review inbox', () => {
  it('names each action after its request and keeps other replies when one is resolved', async () => {
    addSecondRequest();
    renderInbox();
    const derivadas = await itemOf('Derivadas');
    const limites = await itemOf('Límites');
    expect(screen.getByRole('listitem', { name: /^Derivadas/ })).toBe(derivadas);
    expect(within(derivadas).getByRole('button', { name: /^Resolver: Derivadas · / })).toBeInTheDocument();
    expect(within(limites).getByRole('link', { name: /^Abrir examen: Límites · / })).toBeInTheDocument();
    expect(within(limites).getByText('Sin comentario del estudiante.')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.type(within(limites).getByLabelText('Respuesta al estudiante'), 'Borrador sin enviar');
    await user.click(within(derivadas).getByRole('button', { name: /^Resolver/ }));

    expect(await screen.findByText('Solicitud resuelta')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('heading', { name: /^Derivadas/ })).not.toBeInTheDocument());
    // The list stays mounted while reloading: the other draft survives and receives the focus.
    const remaining = screen.getByRole('heading', { name: /^Límites/ });
    expect(within(remaining.closest('li')).getByLabelText('Respuesta al estudiante')).toHaveValue('Borrador sin enviar');
    await waitFor(() => expect(remaining).toHaveFocus());
    expect(db.review_requests.find((r) => r.id === 'rr-1')).toMatchObject({ resolved: true });
  });

  it('refreshes the list and explains it when someone else already resolved the request', async () => {
    renderInbox();
    const item = await itemOf('Derivadas');
    // Another corrector resolves it after the page loaded.
    Object.assign(db.review_requests.find((r) => r.id === 'rr-1'), { resolved: true, resolver_message: 'Revisado' });

    await userEvent.setup().click(within(item).getByRole('button', { name: /^Resolver/ }));

    expect(await screen.findByText('Otra persona ya resolvió esta solicitud. La lista se ha actualizado.')).toBeInTheDocument();
    expect(await screen.findByText('No hay solicitudes pendientes')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('region', { name: 'Solicitudes de revisión' })).toHaveFocus());
    expect(db.review_requests.find((r) => r.id === 'rr-1').resolver_message).toBe('Revisado');
  });

  it('shows the empty state when there is nothing to review', async () => {
    db.review_requests.forEach((r) => Object.assign(r, { resolved: true }));
    renderInbox();
    expect(await screen.findByText('No hay solicitudes pendientes')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Solicitudes de revisión' })).queryByRole('listitem')).not.toBeInTheDocument();
  });
});
