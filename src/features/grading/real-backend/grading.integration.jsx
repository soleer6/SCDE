/* GradingPage against the real Django (no mocks): a clean browser hydrates the
 * persisted grade from InstanceResponse.grades, a change made by another JWT
 * session answers 409 VERSION_CONFLICT, the page re-reads it and the next
 * attempt saves with the right old_score; rubric selections survive a reload.
 * Fixture: one rubric problem on a PENDING_GRADING instance (fixtures-claude). */
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, configure, render, screen, waitFor } from '@testing-library/react';
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
import { loadFixture, otherSession, signIn } from './session.js';

configure({ asyncUtilTimeout: 15000 });
globalThis.ResizeObserver ??= class {
  observe() {}
  disconnect() {}
};
URL.createObjectURL = () => 'blob:real';
URL.revokeObjectURL = () => {};
HTMLCanvasElement.prototype.getContext = () => null;

let fx;
let problem;
let criterion;
let other;
const gradePath = () => `/instances/${fx.instanceId}/`;
const persisted = async () => (await other.get(gradePath())).data.grades?.find((g) => g.problem_id === fx.problemId) ?? null;
/** Sets the grade from the other session, whatever it currently is. */
async function setFromOtherSession(score) {
  const current = await persisted();
  const res = await other.put(`/instances/${fx.instanceId}/problems/${fx.problemId}/grade/`, { score: String(score), old_score: current ? current.score : null });
  expect(res.status, JSON.stringify(res.data)).toBe(200);
  return res.data;
}

const mount = () =>
  render(
    <MemoryRouter initialEntries={[`/instances/${fx.instanceId}/grade`]}>
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
  other = await otherSession(fx, 'teacher');
  const inst = await other.get(gradePath());
  expect(inst.status).toBe(200);
  expect(Array.isArray(inst.data.grades), 'backend without InstanceResponse.grades (gap-1)').toBe(true);
  const exam = await other.get(`/exams/${fx.examId}/`);
  problem = exam.data.models_problems.find((m) => m.model_id === inst.data.model_id).problems.find((p) => p.id === fx.problemId);
  criterion = problem.rubric_criteria[0];
  expect(criterion).toBeTruthy();
});
afterEach(cleanup);

describe('grading with the real backend', () => {
  it('hydrates, recovers from VERSION_CONFLICT and keeps rubric selections', async () => {
    const user = userEvent.setup();
    // Another browser leaves a persisted manual grade (no criteria selected).
    await setFromOtherSession(1);

    // 1. Clean browser: nothing in localStorage, the grade comes from the server.
    await signIn(fx, 'teacher');
    expect(localStorage.getItem(`scde.grades.${fx.instanceId}`)).toBeNull();
    mount();
    const box = await screen.findByRole('checkbox', { name: criterion.description });
    expect(box).not.toBeChecked();
    expect(screen.getByText('1/1 problemas')).toBeInTheDocument();
    expect(screen.queryByText(/ya tiene notas puestas desde otra sesión/)).not.toBeInTheDocument();

    // 2. The other session regrades behind the page's back: the page's old_score (1) is stale.
    await setFromOtherSession(2);
    await user.click(box);
    expect(await screen.findByRole('alert')).toHaveTextContent('Otra sesión cambió esta nota');
    expect((await persisted()).score).toBe('2.00');
    expect(document.querySelector('.gr-problem__score .u-num')).toHaveTextContent('2');

    // 3. Next attempt carries the re-read old_score and Django accepts it.
    await user.click(screen.getByRole('checkbox', { name: criterion.description }));
    await waitFor(async () => expect((await persisted()).rubric_selections).toEqual([criterion.id]));
    expect(Number((await persisted()).score)).toBe(Math.min(Number(criterion.score), Number(problem.max_score)));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    cleanup();

    // 4. Another clean browser (same teacher): the selection is read back from the server.
    await signIn(fx, 'teacher');
    mount();
    expect(await screen.findByRole('checkbox', { name: criterion.description })).toBeChecked();
  });
});
