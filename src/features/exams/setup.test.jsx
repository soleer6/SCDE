/* Exam setup page (RF-6.x, RF-8.x) in mock mode: the four tabs as the user sees them. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../../app/i18n.js';
import { AuthProvider } from '../../lib/auth/AuthProvider.jsx';
import { ToastProvider } from '../../ui';
import AppRouter from '../../app/AppRouter.jsx';
import { api } from '../../lib/api/client.js';
import { tokenStore } from '../../lib/api/tokens.js';
import { db } from '../../lib/mock/db.js';
import { listMockRoutes } from '../../lib/mock/router.js';
import { clearSubjectsCache } from '../workspace/api.js';
import { listSubjectMembers } from './api.js';

async function loginAs(email, password) {
  const data = await api.post('/auth/login/', { email, password }, { auth: false });
  tokenStore.set(data.access_token, data.refresh_token);
  localStorage.setItem('scde.user', JSON.stringify({ id: data.user.id, email, firstName: data.user.first_name, lastName: data.user.last_name, isStaff: false }));
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

/* GET /subjects/{id}/members/ is mocked by the subject-admin feature (codex/admin-ops):
 * the convocation and corrector tabs only run where both branches are merged. */
const withMembers = listMockRoutes().some((r) => r.startsWith('GET /subjects/:subject/members/'));

const tab = (name) => screen.findByRole('tab', { name: new RegExp(`^${name}`) });

afterEach(() => vi.restoreAllMocks());

beforeEach(async () => {
  localStorage.clear();
  db.reset();
  await i18n.changeLanguage('es');
});

describe('exam setup', () => {
  it('shows a teacher only the structure tab, without model creation', async () => {
    await loginAs('javier.ruiz@uam.es', 'prof123');
    renderAt('/exams/e-mat-p2/setup');
    expect(await screen.findByRole('heading', { name: 'Modelo A' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Modelos y problemas']);
    expect(screen.queryByRole('heading', { name: 'Nuevo modelo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Subir PDF en blanco|Sustituir PDF/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Editar rúbrica' })).toHaveLength(3);
  });

  it('refuses to configure an exam for a student', async () => {
    await loginAs('elena.rodriguez@estudiante.uam.es', 'est123');
    renderAt('/exams/e-mat-p2/setup');
    expect(await screen.findByText('No tienes permisos para configurar este examen')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('saves the details and keeps an exam with scanned instances after a refused deletion', async () => {
    const user = userEvent.setup();
    await loginAs('maria.perez@uam.es', 'prof123');
    renderAt('/exams/e-prg-pr1/setup');
    await user.click(await tab('Datos'));
    const name = screen.getByLabelText('Nombre');
    await user.clear(name);
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
    await user.type(name, 'Práctica 1 (entrega)');
    await user.click(screen.getByRole('checkbox', { name: 'Descargar el PDF sin cifrar' }));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText('Cambios guardados')).toBeInTheDocument();
    const saved = db.exams.find((e) => e.id === 'e-prg-pr1');
    expect(saved.name).toBe('Práctica 1 (entrega)');
    expect(saved.student_permissions.can_download_pages).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Eliminar examen' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Eliminar examen' }));
    expect(await screen.findByText('No se puede eliminar: el examen ya tiene exámenes escaneados.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(db.exams.some((e) => e.id === 'e-prg-pr1')).toBe(true);
  });

  it('adds a problem and replaces its rubric, warning when the criteria exceed the maximum', async () => {
    const user = userEvent.setup();
    await loginAs('maria.perez@uam.es', 'prof123');
    renderAt('/exams/e-prg-pr1/setup');
    const model = (await screen.findByRole('heading', { name: 'Modelo A' })).closest('section');
    const add = within(model).getByRole('button', { name: 'Añadir problema' });
    await user.type(within(model).getByLabelText('Nuevo problema'), 'Pruebas');
    await user.type(within(model).getByLabelText('Máx.'), '0');
    expect(add).toBeDisabled();
    await user.clear(within(model).getByLabelText('Máx.'));
    await user.type(within(model).getByLabelText('Máx.'), '2,5');
    await user.click(add);
    expect(await screen.findByText('Problema añadido')).toBeInTheDocument();
    expect(await within(model).findByText('Pruebas')).toBeInTheDocument();
    const created = db.problems.find((p) => p.name === 'Pruebas');
    expect(Number(created.max_score)).toBe(2.5);

    const rubricButtons = within(model).getAllByRole('button', { name: 'Editar rúbrica' });
    await user.click(rubricButtons[rubricButtons.length - 1]);
    const dialog = await screen.findByRole('dialog', { name: 'Rúbrica · Pruebas' });
    const d = within(dialog);
    expect(d.getByText('Sin criterios, el problema se corrige con nota manual.')).toBeInTheDocument();
    await user.type(d.getByLabelText('Descripción del criterio 1'), 'Casos límite');
    await user.type(d.getByLabelText('Puntuación del criterio 1'), '3');
    expect(d.getByText('Suma: 3 de 2,5')).toHaveClass('u-rust');
    await user.clear(d.getByLabelText('Puntuación del criterio 1'));
    await user.type(d.getByLabelText('Puntuación del criterio 1'), '1,5');
    await user.click(d.getByRole('button', { name: 'Añadir criterio' }));
    await user.type(d.getByLabelText('Descripción del criterio 2'), 'Cobertura');
    await user.type(d.getByLabelText('Puntuación del criterio 2'), '1');
    expect(d.getByText('Suma: 2,5 de 2,5')).toHaveClass('u-muted');
    await user.click(d.getByRole('button', { name: 'Guardar rúbrica' }));
    expect(await screen.findByText('Rúbrica guardada')).toBeInTheDocument();
    expect(await within(model).findByText('2 criterios')).toBeInTheDocument();
    expect(db.criteria.filter((c) => c.problem_id === created.id).map((c) => c.description)).toEqual(['Casos límite', 'Cobertura']);
  });

  it.skipIf(!withMembers)('saves the convocation and lists the students the backend rejects', async () => {
    const user = userEvent.setup();
    db.memberships.find((m) => m.user_id === 'u-pablo' && m.subject_id === 's-prg102').group_id = null;
    await loginAs('maria.perez@uam.es', 'prof123');
    renderAt('/exams/e-prg-pr1/setup');
    await user.click(await tab('Convocatoria'));
    expect(await screen.findByRole('heading', { name: 'Convocados: 4' })).toBeInTheDocument();
    expect(screen.getByText('Sin grupo')).toBeInTheDocument();
    expect(screen.queryByText('maria.perez@uam.es')).not.toBeInTheDocument(); // only STUDENT members
    await user.type(screen.getByRole('textbox', { name: 'Buscar' }), 'irene');
    expect(screen.getAllByRole('row')).toHaveLength(2); // header + Irene
    await user.click(screen.getByRole('checkbox', { name: 'irene.martin@estudiante.uam.es' }));
    expect(await screen.findByRole('heading', { name: 'Convocados: 3' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Guardar convocatoria' }));
    expect(await screen.findByText('Convocatoria guardada: 2 de 3 válidos')).toBeInTheDocument();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('1 estudiante no se ha podido convocar:');
    expect(alert).toHaveTextContent('pablo.fernandez@estudiante.uam.es · no tiene grupo asignado');
  });

  it.skipIf(!withMembers)('creates and deletes a corrector rule, updating the coverage', async () => {
    const user = userEvent.setup();
    await loginAs('maria.perez@uam.es', 'prof123');
    renderAt('/exams/e-prg-pr1/setup');
    await user.click(await tab('Correctores'));
    expect(await screen.findByText('0/2')).toBeInTheDocument();
    expect(screen.getByText('No hay reglas. Sin reglas, solo la coordinación puede corregir.')).toBeInTheDocument();
    const create = screen.getByRole('button', { name: 'Crear regla' });
    expect(create).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: 'Diseño · Modelo A' }));
    await user.click(screen.getByRole('checkbox', { name: 'Implementación · Modelo A' }));
    await user.click(screen.getByRole('checkbox', { name: /^María Pérez/ }));
    await user.click(create);
    expect(await screen.findByText('Regla creada')).toBeInTheDocument();
    expect(await screen.findByText('2/2')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Diseño, Implementación' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Diseño · Modelo A' })).not.toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(await screen.findByText('Regla eliminada')).toBeInTheDocument();
    expect(await screen.findByText('0/2')).toBeInTheDocument();
    expect(db.assignment_rules.some((r) => r.exam_id === 'e-prg-pr1')).toBe(false);
  });

  it.skipIf(!withMembers)('reads every page of members, not just the first 100', async () => {
    for (let i = 0; i < 110; i++) {
      db.memberships.push({ id: `m-extra-${i}`, user_id: 'u-hugo', subject_id: 's-prg102', role: 'STUDENT', group_id: 'g-PRG102-a', is_active: true, permission_overrides: {} });
    }
    await loginAs('maria.perez@uam.es', 'prof123');
    expect(await listSubjectMembers('s-prg102', ['STUDENT'])).toHaveLength(114);
    expect((await listSubjectMembers('s-prg102', ['COORDINATOR', 'TEACHER'])).map((m) => m.user_id)).toEqual(['u-maria']);
  });
});

describe('new exam', () => {
  it('starts empty each time it opens, ignores Enter without a name and opens the setup of the created exam', async () => {
    const user = userEvent.setup();
    await loginAs('maria.perez@uam.es', 'prof123');
    const post = vi.spyOn(api, 'post');
    renderAt('/subjects/s-mat101');
    await user.click(await screen.findByRole('button', { name: 'Nuevo examen' }));
    let dialog = await screen.findByRole('dialog', { name: 'Nuevo examen' });
    await user.type(within(dialog).getByLabelText('Nombre'), 'Borrador');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Regression: the dialog stayed mounted and kept what was typed before cancelling.
    await user.click(screen.getByRole('button', { name: 'Nuevo examen' }));
    dialog = await screen.findByRole('dialog', { name: 'Nuevo examen' });
    const name = within(dialog).getByLabelText('Nombre');
    expect(name).toHaveValue('');
    // Enter without a name never reaches the backend (it would answer FIELD_REQUIRED).
    await user.type(name, '{Enter}');
    expect(post.mock.calls.filter(([path]) => path.endsWith('/exams/'))).toHaveLength(0);
    expect(within(dialog).getByRole('button', { name: 'Crear y configurar' })).toBeDisabled();

    await user.type(name, 'Parcial 3');
    fireEvent.change(within(dialog).getByLabelText('Fecha y hora (opcional)'), { target: { value: '2026-12-01T10:00' } });
    await user.click(within(dialog).getByRole('button', { name: 'Crear y configurar' }));
    expect(await screen.findByText('Examen creado')).toBeInTheDocument();
    const created = db.exams.find((e) => e.name === 'Parcial 3');
    expect(created).toMatchObject({ subject_id: 's-mat101', date: new Date('2026-12-01T10:00').toISOString() });
    expect(await tab('Datos')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
