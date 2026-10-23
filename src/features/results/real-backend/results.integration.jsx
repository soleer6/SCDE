/* Student result and review requests against the real Django (no mocks), as
 * the published student of fixtures-claude (instance IN_REVIEW, window OPEN,
 * one rubric problem). Covers the view, selecting the exposed problem_id,
 * sending, reloading in a clean browser, the duplicate request from another
 * session and isolation from another student. The request can only be created
 * once per fixture: the sending branch runs while none exists, later runs
 * check the persisted request instead (both are reported in the output).
 * A closed window is not reproduced here: closing it is irreversible for the
 * fixture (only Celery Beat closes windows). closed-review.integration.jsx
 * covers it with a separate synthetic organization. */
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, configure, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
import { loadFixture, otherSession, signIn } from '../../grading/real-backend/session.js';

configure({ asyncUtilTimeout: 15000 });
globalThis.ResizeObserver ??= class {
  observe() {}
  disconnect() {}
};
URL.createObjectURL = () => 'blob:real';
URL.revokeObjectURL = () => {};
HTMLCanvasElement.prototype.getContext = () => null;

let fx;
let owner;
let problem;
const requestsPath = () => `/instances/${fx.publishedInstanceId}/review-requests/`;
const persistedRequests = async () => {
  const res = await owner.get(requestsPath());
  expect(res.status).toBe(200);
  return res.data.results ?? res.data;
};

const mount = () =>
  render(
    <MemoryRouter initialEntries={[`/exams/${fx.examId}`]}>
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
  fx = await loadFixture();
  owner = await otherSession(fx, 'publishedStudent');
  const list = await owner.get(`/exams/${fx.examId}/instances/`);
  const inst = (list.data.results ?? list.data).find((i) => i.id === fx.publishedInstanceId);
  expect(inst?.status).toBe('IN_REVIEW');
  expect((await owner.get(`/exams/${fx.examId}/review/`)).data.status).toBe('OPEN');
  problem = inst.rubric?.find((p) => p.problem_id === fx.problemId);
  expect(problem, 'StudentInstance.rubric without problem_id (gap-2)').toBeTruthy();
});
afterEach(cleanup);

describe('student result and review requests with the real backend', () => {
  it('selects the exposed problem, sends once, survives a reload and ignores duplicates', async () => {
    const user = userEvent.setup();
    const before = (await persistedRequests()).filter((r) => r.problem_id === fx.problemId);

    await signIn(fx, 'publishedStudent');
    mount();
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(await screen.findByText('Revisión abierta', { exact: false })).toBeInTheDocument();

    if (!before.length) {
      console.info('[results] branch: first request sent from the UI');
      await user.click(await screen.findByRole('checkbox', { name: problem.problem_name }));
      await user.type(screen.getByLabelText('Motivo'), 'Prueba sintética de integración');
      await user.click(screen.getByRole('button', { name: 'Pedir revisión de 1 problema' }));
      expect(await screen.findByText('Solicitud enviada')).toBeInTheDocument();
      const list = await screen.findByRole('region', { name: 'Tus solicitudes' });
      expect(within(list).getByText(problem.problem_name, { exact: false })).toBeInTheDocument();
    } else {
      console.info('[results] branch: request already persisted by an earlier run');
    }
    const after = (await persistedRequests()).filter((r) => r.problem_id === fx.problemId);
    expect(after).toHaveLength(1);
    cleanup();

    // Another session (another tab) asks again: get_or_create creates nothing.
    const dup = await owner.post(requestsPath(), { problems: [{ problem_id: fx.problemId, message: 'duplicada' }] });
    expect([200, 201]).toContain(dup.status);
    expect(dup.data).toEqual([]);
    expect((await persistedRequests()).filter((r) => r.problem_id === fx.problemId)).toHaveLength(1);

    // Clean browser: the request is read back and the problem cannot be asked again.
    await signIn(fx, 'publishedStudent');
    mount();
    const box = await screen.findByRole('checkbox', { name: `${problem.problem_name} · ya solicitada` });
    expect(box).toBeChecked();
    expect(box).toBeDisabled();
    expect(await screen.findByRole('region', { name: 'Tus solicitudes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pedir revisión de 0/ })).toBeDisabled();
  });

  it('keeps another student out of the instance and its requests', async () => {
    const intruder = await otherSession(fx, 'student');
    // ReviewRequestListView answers 200 [] to users without access (by design, "por usabilidad").
    const read = await intruder.get(requestsPath());
    expect(read.status === 200 ? read.data : read.status).toEqual(read.status === 200 ? [] : expect.any(Number));
    expect([200, 403, 404]).toContain(read.status);
    const post = await intruder.post(requestsPath(), { problems: [{ problem_id: fx.problemId, message: 'x' }] });
    expect([400, 403, 404, 409]).toContain(post.status);
    if (post.status === 409) expect(post.data.error_code).toBe('NOT_INSTANCE_OWNER');
    expect((await persistedRequests()).filter((r) => r.problem_id === fx.problemId)).toHaveLength(1);

    await signIn(fx, 'student');
    mount();
    expect(await screen.findByText('Tu nota aún no está publicada')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: problem.problem_name })).not.toBeInTheDocument();
  });
});
