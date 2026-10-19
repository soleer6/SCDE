/* Grading page in mock mode: manual scores, the page staying mounted while
 * each grade reloads the instance, finishing and reopening, and an exam
 * model without problems. */
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
});
