/* Grading page in mock mode: manual scores, the page staying mounted while
 * each grade reloads the instance, finishing and reopening, an exam model
 * without problems, and grades hydrated from the server (clean browser,
 * VERSION_CONFLICT from another session, rubric selections). */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
import { observeMockResponses } from '../../lib/mock/router.js';
import { recalcTotal } from '../exams/mockSerializers.js';
import { clearSubjectsCache } from '../workspace/api.js';

globalThis.ResizeObserver ??= class {
  observe() {}
  disconnect() {}
};
URL.createObjectURL ??= () => 'blob:mock';
URL.revokeObjectURL ??= () => {};
HTMLCanvasElement.prototype.getContext = () => null; // jsdom has no canvas; InkCanvas skips painting

const INSTANCE = 'i-e-mat-p2-3'; // PENDING_GRADING, three manual problems (4 + 3 + 3)

async function loginAs(email, password) {
  const data = await api.post('/auth/login/', { email, password }, { auth: false });
  tokenStore.set(data.access_token, data.refresh_token);
  localStorage.setItem('scde.user', JSON.stringify({ id: data.user.id, email, firstName: data.user.first_name, lastName: data.user.last_name, isStaff: false }));
  clearSubjectsCache();
}

const renderGrading = (id = INSTANCE) =>
  render(
    <MemoryRouter initialEntries={[`/instances/${id}/grade`]}>
      <AuthProvider>
        <ToastProvider>
          <AppRouter />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );

beforeEach(async () => {
  localStorage.clear();
  db.reset();
  await i18n.changeLanguage('es');
  await loginAs('maria.perez@uam.es', 'prof123');
});

describe('grading', () => {
  it('persists negative problem scores, floors the total and reloads the saved penalty', async () => {
    const user = userEvent.setup();
    const view = renderGrading();
    await user.type(await screen.findByLabelText('Nota de Series'), '-1,5');
    await user.tab();
    await waitFor(() => expect(db.grades.find((g) => g.instance_id === INSTANCE)?.score).toBe(-1.5));
    expect(db.instances.find((i) => i.id === INSTANCE).total_score).toBe(0);

    view.unmount();
    // A clean browser must hydrate the penalty from the server, not its cache.
    localStorage.removeItem(`scde.grades.${INSTANCE}`);
    renderGrading();
    expect(await screen.findByLabelText('Nota de Series')).toHaveValue('-1.5');
    const input = screen.getByLabelText('Nota de Series');
    await user.clear(input);
    await user.type(input, '-0,5');
    await user.tab();
    await waitFor(() => expect(db.grades.find((g) => g.instance_id === INSTANCE)?.score).toBe(-0.5));
    expect(db.instances.find((i) => i.id === INSTANCE).total_score).toBe(0);

    await user.type(screen.getByLabelText('Nota de Integral impropia'), '2');
    await user.tab();
    await waitFor(() => expect(db.instances.find((i) => i.id === INSTANCE).total_score).toBe(1.5));

    const restored = screen.getByLabelText('Nota de Series');
    await user.clear(restored);
    await user.type(restored, '5');
    await user.tab();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await user.clear(restored);
    await user.type(restored, '-0,5');
    await user.tab();
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('keeps negative rubric criteria while flooring the total', async () => {
    const user = userEvent.setup();
    const id = 'i-e-prg-pr1-4';
    const criterion = db.criteria.find((c) => c.id === 'rc-p-e-prg-pr1-1-1');
    criterion.score = -2;
    renderGrading(id);
    const boxes = await screen.findAllByRole('checkbox', { name: 'Planteamiento correcto' });
    await user.click(boxes[0]);
    await waitFor(() => expect(db.grades.find((g) => g.instance_id === id)?.score).toBe(-2));
    expect(db.instances.find((i) => i.id === id).total_score).toBe(0);
    expect(screen.queryByText('+-2')).not.toBeInTheDocument();
    expect(screen.getAllByText('-2').length).toBeGreaterThan(0);
  });

  it('keeps the page mounted while grades save, then finishes and reopens', async () => {
    const user = userEvent.setup();
    renderGrading();
    const series = await screen.findByLabelText('Nota de Series');
    const finish = screen.getByRole('button', { name: 'Marcar como corregido' });
    expect(finish).toBeDisabled();

    // Zoom is PdfStage state: it only survives if the reload does not unmount the stage.
    await user.click(screen.getByRole('button', { name: 'Ampliar' }));
    expect(screen.getByText('125%')).toBeInTheDocument();

    await user.type(series, '3,5');
    const improper = screen.getByLabelText('Nota de Integral impropia');
    await user.click(improper); // blurring Series saves it and reloads the instance
    await user.type(improper, '2');
    await waitFor(() => expect(screen.getByText('1/3 problemas')).toBeInTheDocument());
    expect(screen.getByLabelText('Nota de Series')).toBe(series);
    expect(improper).toHaveFocus();
    expect(improper).toHaveValue('2');
    expect(screen.getByText('125%')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Nota de Aplicaciones'));
    await user.keyboard('1{Enter}');
    await waitFor(() => expect(finish).toBeEnabled());
    expect(screen.getByText('3/3 problemas')).toBeInTheDocument();
    expect(db.grades.filter((g) => g.instance_id === INSTANCE).map((g) => Number(g.score)).sort()).toEqual([1, 2, 3.5]);

    await user.click(finish);
    expect(await screen.findByText('Examen marcado como corregido')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Reabrir corrección' })).toBeInTheDocument();
    expect(db.instances.find((i) => i.id === INSTANCE).status).toBe('GRADED');
    expect(screen.getByLabelText('Nota de Series')).toBe(series);

    await user.click(screen.getByRole('button', { name: 'Reabrir corrección' }));
    expect(await screen.findByText('Corrección reabierta')).toBeInTheDocument();
    expect(db.instances.find((i) => i.id === INSTANCE).status).toBe('PENDING_GRADING');
  });

  it('starts the next instance with empty scores and its own student', async () => {
    const user = userEvent.setup();
    renderGrading();
    const header = await screen.findByRole('heading', { level: 1 });
    const first = header.textContent;
    await user.type(screen.getByLabelText('Nota de Series'), '3,5');
    await user.tab();
    await waitFor(() => expect(screen.getByText('1/3 problemas')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Siguiente por corregir' }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).not.toBe(first));
    expect(screen.getByLabelText('Nota de Series')).toHaveValue('');
    expect(screen.getByText('0/3 problemas')).toBeInTheDocument();
  });

  it('refuses a score above the maximum without calling the API', async () => {
    const user = userEvent.setup();
    renderGrading();
    await user.type(await screen.findByLabelText('Nota de Series'), '5');
    await user.tab();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(db.grades.some((g) => g.instance_id === INSTANCE)).toBe(false);
    expect(screen.getByText('0/3 problemas')).toBeInTheDocument();
  });

  it('labels the comment for the student', async () => {
    renderGrading();
    expect(await screen.findByRole('textbox', { name: 'Comentario para el estudiante' })).toBeInTheDocument();
  });

  it('explains a model without problems and does not let it be finished', async () => {
    db.problems = db.problems.filter((p) => p.exam_model_id !== 'mdl-e-mat-p2');
    renderGrading();
    expect(await screen.findByText(/Este modelo no tiene problemas definidos/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marcar como corregido' })).toBeDisabled();
  });

  it('hydrates persisted grades in a clean browser and regrades with them as old_score', async () => {
    const user = userEvent.setup();
    db.grades.push({ id: 'gr-other', instance_id: INSTANCE, problem_id: 'p-e-mat-p2-1', score: 2.5, grader_id: 'u-maria', rubric_selections: [] });
    recalcTotal(db.instances.find((i) => i.id === INSTANCE));
    localStorage.removeItem(`scde.grades.${INSTANCE}`);
    renderGrading();
    const series = await screen.findByLabelText('Nota de Series');
    expect(series).toHaveValue('2.5');
    expect(screen.getByText('1/3 problemas')).toBeInTheDocument();
    expect(screen.queryByText(/ya tiene notas puestas desde otra sesión/)).not.toBeInTheDocument();

    await user.clear(series);
    await user.type(series, '3{Enter}');
    await waitFor(() => expect(Number(db.grades.find((g) => g.id === 'gr-other').score)).toBe(3));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('re-reads the grade after a VERSION_CONFLICT and saves on the next attempt', async () => {
    const user = userEvent.setup();
    renderGrading();
    const series = await screen.findByLabelText('Nota de Series');
    // The save is followed by a re-read of the instance; the other session must
    // write after it, or that re-read already brings its score (no conflict).
    let saved = false;
    let reread = false;
    const stop = observeMockResponses(({ method, route }) => {
      if (method === 'PUT') saved = true;
      else if (saved && method === 'GET' && route === '/instances/:id/') reread = true;
    });
    await user.type(series, '2{Enter}');
    await waitFor(() => expect(screen.getByText('1/3 problemas')).toBeInTheDocument());
    await waitFor(() => expect(reread).toBe(true));
    stop();

    // Another session regrades Series behind this page's back.
    Object.assign(db.grades.find((g) => g.instance_id === INSTANCE), { score: 3.75 });
    await user.clear(series);
    await user.type(series, '1{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('Otra sesión cambió esta nota');
    expect(series).toHaveValue('3.75');
    expect(Number(db.grades.find((g) => g.instance_id === INSTANCE).score)).toBe(3.75);

    await user.clear(series);
    await user.type(series, '1{Enter}');
    await waitFor(() => expect(Number(db.grades.find((g) => g.instance_id === INSTANCE).score)).toBe(1));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('shows persisted rubric selections and keeps them when adding a criterion', async () => {
    const user = userEvent.setup();
    const id = 'i-e-prg-pr1-4'; // PENDING_GRADING, rubric problems Diseño and Implementación
    db.grades.push({ id: 'gr-rub', instance_id: id, problem_id: 'p-e-prg-pr1-1', score: 1.6, grader_id: 'u-maria', rubric_selections: ['rc-p-e-prg-pr1-1-1'] });
    recalcTotal(db.instances.find((i) => i.id === id));
    renderGrading(id);
    const boxes = await screen.findAllByRole('checkbox', { name: 'Planteamiento correcto' });
    expect(boxes[0]).toBeChecked();
    expect(boxes[1]).not.toBeChecked();

    await user.click(screen.getAllByRole('checkbox', { name: 'Resultado final' })[0]);
    await waitFor(() => expect(db.grades.find((g) => g.id === 'gr-rub').rubric_selections).toEqual(['rc-p-e-prg-pr1-1-1', 'rc-p-e-prg-pr1-1-3']));
    expect(Number(db.grades.find((g) => g.id === 'gr-rub').score)).toBeCloseTo(2.4);
    await waitFor(() => expect(screen.getAllByRole('checkbox', { name: 'Resultado final' })[0]).toBeChecked());
  });
});
