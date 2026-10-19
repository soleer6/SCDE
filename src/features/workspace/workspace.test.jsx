/* Workspace in mock mode: overview by role, empty states and the subject page. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../../app/i18n.js';
import { AuthProvider } from '../../lib/auth/AuthProvider.jsx';
import { ToastProvider } from '../../ui';
import AppRouter from '../../app/AppRouter.jsx';
import { api } from '../../lib/api/client.js';
import { ApiError } from '../../lib/api/errors.js';
import { tokenStore } from '../../lib/api/tokens.js';
import { db } from '../../lib/mock/db.js';
import { clearSubjectsCache } from './api.js';

async function loginAs(email, password, isStaff = false) {
  const data = await api.post('/auth/login/', { email, password }, { auth: false });
  tokenStore.set(data.access_token, data.refresh_token);
  localStorage.setItem('scde.user', JSON.stringify({ id: data.user.id, email, firstName: data.user.first_name, lastName: data.user.last_name, isStaff }));
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

/** Spies GET requests; `failOnce(path)` makes the next request to that path fail. */
function spyGets() {
  const original = api.get;
  const failing = new Set();
  const spy = vi.spyOn(api, 'get').mockImplementation((path, ...rest) => {
    if (failing.delete(path)) return Promise.reject(new ApiError('SERVER_ERROR', 500));
    return original.call(api, path, ...rest);
  });
  return {
    count: (match) => spy.mock.calls.filter(([path]) => match.test(path)).length,
    failOnce: (path) => failing.add(path),
  };
}

beforeEach(async () => {
  localStorage.clear();
  db.reset();
  await i18n.changeLanguage('es');
});

afterEach(() => vi.restoreAllMocks());

describe('overview', () => {
  it('shows the grading queue and pending reviews to a coordinator', async () => {
    await loginAs('maria.perez@uam.es', 'prof123');
    renderAt('/');
    expect(await screen.findByRole('heading', { name: 'Hola, María' })).toBeInTheDocument();
    const queue = await screen.findByRole('table', { name: 'Cola de corrección' });
    expect(within(queue).getAllByRole('row').length).toBeGreaterThan(1);
    const reviews = screen.getByRole('table', { name: 'Solicitudes de revisión' });
    expect(within(reviews).getByText('Derivadas')).toBeInTheDocument();
    // No student section for someone who only teaches.
    expect(screen.queryByRole('heading', { name: 'Mis exámenes' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Cálculo I/ })).toHaveAttribute('href', '/subjects/s-mat101');
  });

  it('lists only the exams of the subjects a student is enrolled in', async () => {
    await loginAs('carla.ortega@estudiante.uam.es', 'est123');
    renderAt('/');
    const exams = await screen.findByRole('table', { name: 'Mis exámenes' });
    expect(within(exams).getAllByText(/^MAT101 · /)).toHaveLength(2);
    expect(within(exams).queryByText(/^FIS101|^PRG102/)).not.toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Cola de corrección' })).not.toBeInTheDocument();
  });

  it('points a manager without subjects to the management area', async () => {
    await loginAs('admin@uam.es', 'admin123', true);
    renderAt('/');
    expect(await screen.findByText('No participas en ninguna asignatura')).toBeInTheDocument();
    expect(screen.getByText('Como gestor, administra asignaturas y miembros desde Gestión.')).toBeInTheDocument();
  });
});

describe('subjects', () => {
  it('recovers a failed subject list with retry', async () => {
    await loginAs('carla.ortega@estudiante.uam.es', 'est123');
    const gets = spyGets();
    gets.failOnce('/my-subjects/');
    renderAt('/subjects');
    const retry = await screen.findByRole('button', { name: 'Reintentar' });
    await userEvent.setup().click(retry);
    expect(await screen.findByRole('link', { name: /Cálculo I/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Física I/ })).not.toBeInTheDocument();
  });

  it('shows grading progress to a coordinator and loads the exam list once', async () => {
    await loginAs('maria.perez@uam.es', 'prof123');
    const gets = spyGets();
    renderAt('/subjects/s-mat101');
    const table = await screen.findByRole('table', { name: 'Exámenes' });
    expect(within(table).getByRole('columnheader', { name: 'Corregidos' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Gestionar asignatura' })).toHaveAttribute('href', '/subjects/s-mat101/manage');
    expect(screen.getByRole('button', { name: 'Nuevo examen' })).toBeInTheDocument();
    // Regression: the list used to be fetched before the role was known and again after.
    expect(gets.count(/^\/subjects\/s-mat101\/exams\/$/)).toBe(1);
    expect(gets.count(/^\/exams\/e-mat-p1\/instances\/$/)).toBe(1);
  });

  it('hides teaching columns and actions from a student', async () => {
    await loginAs('carla.ortega@estudiante.uam.es', 'est123');
    renderAt('/subjects/s-mat101');
    const table = await screen.findByRole('table', { name: 'Exámenes' });
    expect(within(table).getByText('Parcial 1')).toBeInTheDocument();
    expect(within(table).queryByRole('columnheader', { name: 'Corregidos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Gestionar asignatura' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nuevo examen' })).not.toBeInTheDocument();
  });

  it('denies a subject the user does not belong to', async () => {
    await loginAs('carla.ortega@estudiante.uam.es', 'est123');
    renderAt('/subjects/s-fis101');
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Exámenes' })).not.toBeInTheDocument();
  });
});
