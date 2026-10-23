/* A CLOSED review window against the real Django (no mocks), with its own
 * synthetic organization: %LOCALAPPDATA%/SCDE/integration/fixtures-claude-closed.local.json
 * (SCDE_CLOSED_FIXTURE_FILE overrides it), built by bootstrap_closed_review.py:
 * the window was OPEN, the requester asked for a review over HTTP and
 * close_review() ran like Celery Beat at end_date. The requester is left
 * PENDING_REVIEW and the silent student FINALIZED. Read-only: nothing is resolved. */
import '@testing-library/jest-dom/vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, configure, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-pdf', () => ({
  pdfjs: { GlobalWorkerOptions: {} },
  Document: ({ children }) => <div data-testid="pdf-doc">{children}</div>,
  Page: () => <div data-testid="pdf-page" />,
}));

import i18n from '../../../app/i18n.js';
import AppRouter from '../../../app/AppRouter.jsx';
import { AuthProvider } from '../../../lib/auth/AuthProvider.jsx';
import { USE_MOCK } from '../../../lib/api/client.js';
import { ToastProvider } from '../../../ui';
import { otherSession, signIn } from '../../grading/real-backend/session.js';

configure({ asyncUtilTimeout: 15000 });
globalThis.ResizeObserver ??= class {
  observe() {}
  disconnect() {}
};
URL.createObjectURL = () => 'blob:real';
URL.revokeObjectURL = () => {};
HTMLCanvasElement.prototype.getContext = () => null;

let fx;
const mount = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <ToastProvider>
          <AppRouter />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );

beforeAll(async () => {
  expect(USE_MOCK).toBe(false);
  await i18n.changeLanguage('es');
  const file = process.env.SCDE_CLOSED_FIXTURE_FILE || join(process.env.LOCALAPPDATA, 'SCDE/integration/fixtures-claude-closed.local.json');
  fx = JSON.parse((await readFile(file, 'utf8')).trimStart());
  expect(fx.reviewStatus).toBe('CLOSED');
});
afterEach(cleanup);

describe('closed review window with the real backend', () => {
  it('shows the requester the ended period and the pending request, without the form', async () => {
    const api = await otherSession(fx, 'requester');
    expect((await api.get(`/exams/${fx.examId}/review/`)).data.status).toBe('CLOSED');
    // Sending now is refused by the backend, whatever the client shows.
    const late = await api.post(`/instances/${fx.requesterInstanceId}/review-requests/`, { problems: [{ problem_id: fx.problemId, message: 'tarde' }] });
    expect(late.status).toBeGreaterThanOrEqual(400);
    console.info(`[closed-review] late request: HTTP ${late.status} ${JSON.stringify(late.data)}`);

    await signIn(fx, 'requester');
    mount(`/exams/${fx.examId}`);
    expect(await screen.findByText('El periodo de revisión ha terminado')).toBeInTheDocument();
    expect(screen.getByText('El periodo de revisión no está abierto.')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pedir revisión/ })).not.toBeInTheDocument();
    const list = await screen.findByRole('region', { name: 'Tus solicitudes' });
    expect(within(list).getByText('P1', { exact: false })).toBeInTheDocument();
  });

  it('shows the student without requests a finalized exam and nothing to ask', async () => {
    await signIn(fx, 'silent');
    mount(`/exams/${fx.examId}`);
    expect(await screen.findByText('El periodo de revisión ha terminado')).toBeInTheDocument();
    expect(screen.getByText('El periodo de revisión no está abierto.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Tus solicitudes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('lists the pending request for the corrector after the window closed', async () => {
    await signIn(fx, 'teacher');
    mount('/reviews');
    const heading = await screen.findByRole('heading', { level: 2, name: /P1/ });
    expect(heading).toHaveTextContent('S0000');
    expect(screen.getByRole('button', { name: /^Resolver/ })).toBeEnabled();
  });
});
