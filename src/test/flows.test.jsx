/* End-to-end flows in mock mode (jsdom). react-pdf is stubbed: rendering
 * the PDF is out of scope here; data flow and permissions are not. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-pdf', () => ({
  pdfjs: { GlobalWorkerOptions: {} },
  Document: ({ children }) => <div data-testid="pdf-doc">{children}</div>,
  Page: () => <div data-testid="pdf-page" />,
}));

import '../app/i18n.js';
import i18n from '../app/i18n.js';
import { AuthProvider } from '../lib/auth/AuthProvider.jsx';
import { ToastProvider } from '../ui';
import AppRouter from '../app/AppRouter.jsx';
import { api } from '../lib/api/client.js';
import { tokenStore } from '../lib/api/tokens.js';
import { db } from '../lib/mock/db.js';

globalThis.ResizeObserver ??= class {
  observe() {}
  disconnect() {}
};
URL.createObjectURL ??= () => 'blob:mock';
URL.revokeObjectURL ??= () => {};

async function loginAs(email, password) {
  const data = await api.post('/auth/login/', { email, password }, { auth: false });
  tokenStore.set(data.access_token, data.refresh_token);
  localStorage.setItem('scde.user', JSON.stringify({ id: data.user.id, email, firstName: data.user.first_name, lastName: data.user.last_name, isStaff: false }));
}

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <ToastProvider>
          <AppRouter />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  localStorage.clear();
  db.reset();
  await i18n.changeLanguage('es');
  // pdf download fetches a static file in mock mode
  globalThis.fetch = vi.fn(async (url) => new Response(String(url).startsWith('data:') ? decodeURIComponent(String(url).split(',')[1]) : new Blob(['%PDF']), { status: 200 }));
});

describe('login', () => {
  it('signs in and lands on the overview with the grading queue', async () => {
    renderAt('/login');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Email institucional'), 'maria.perez@uam.es');
    await user.type(screen.getByLabelText('Contraseña'), 'prof123');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('heading', { name: 'Hola, María' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Cola de corrección' })).toBeInTheDocument();
    expect((await screen.findAllByText('MAT101 · Parcial 2')).length).toBeGreaterThan(0);
  });

  it('shows the translated backend error for wrong credentials', async () => {
    renderAt('/login');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Email institucional'), 'maria.perez@uam.es');
    await user.type(screen.getByLabelText('Contraseña'), 'mala');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Email o contraseña incorrectos.')).toBeInTheDocument();
  });
});

describe('teacher exam dashboard', () => {
  it('lists instances and publishes graded ones', async () => {
    await loginAs('maria.perez@uam.es', 'prof123');
    renderAt('/exams/e-mat-p2');
    expect(await screen.findByRole('heading', { name: 'Parcial 2' })).toBeInTheDocument();
    const publish = await screen.findByRole('button', { name: 'Publicar 3 notas' });
    await userEvent.setup().click(publish);
    expect(await screen.findByText(/3 notas publicadas/)).toBeInTheDocument();
    expect(db.instances.filter((i) => i.exam_id === 'e-mat-p2' && i.status === 'PUBLISHED')).toHaveLength(3);
  });
});

describe('grading contract', () => {
  it('grades with optimistic concurrency and transitions to GRADED', async () => {
    await loginAs('maria.perez@uam.es', 'prof123');
    const id = 'i-e-mat-p2-3';
    const g1 = await api.put(`/instances/${id}/problems/p-e-mat-p2-1/grade/`, { score: '3.5', old_score: null });
    expect(g1.score).toBe('3.50');
    await expect(api.put(`/instances/${id}/problems/p-e-mat-p2-1/grade/`, { score: '3', old_score: null })).rejects.toMatchObject({ code: 'VERSION_CONFLICT', status: 409 });
    await api.put(`/instances/${id}/problems/p-e-mat-p2-1/grade/`, { score: '3', old_score: '3.50' });
    await expect(api.put(`/instances/${id}/problems/p-e-mat-p2-2/grade/`, { score: '9', old_score: null })).rejects.toMatchObject({ code: 'SCORE_EXCEEDS_MAX' });
    const inst = await api.get(`/instances/${id}/`);
    expect(inst.total_score).toBe('3.00');
    const moved = await api.patch(`/instances/${id}/transition/`, { target_status: 'GRADED' });
    expect(moved.status).toBe('GRADED');
    await expect(api.patch(`/instances/${id}/transition/`, { target_status: 'FINALIZED' })).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });

  it('only lets an assigned teacher grade assigned problems', async () => {
    await loginAs('javier.ruiz@uam.es', 'prof123');
    await expect(api.put('/instances/i-e-mat-p2-3/problems/p-e-mat-p2-1/grade/', { score: '1' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    const ok = await api.put('/instances/i-e-mat-p2-3/problems/p-e-mat-p2-2/grade/', { score: '1' });
    expect(ok.grader_email).toBe('javier.ruiz@uam.es');
  });

  it('stores stylus annotations and returns them through download_url', async () => {
    await loginAs('maria.perez@uam.es', 'prof123');
    const payload = JSON.stringify({ v: 1, strokes: [{ points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }], color: 'red', width: 0.003, tool: 'pen' }] });
    await api.post('/instances/i-e-mat-p2-3/annotations/', { annotation_type: 'STYLUS', payload, page_number: 1 });
    const [a] = await api.get('/instances/i-e-mat-p2-3/annotations/');
    expect(a.download_url).toMatch(/^data:/);
    expect(decodeURIComponent(a.download_url.split(',')[1])).toBe(payload);
  });
});

describe('student result and review', () => {
  it('shows the grade, breakdown and lets the student request a review', async () => {
    await loginAs('elena.rodriguez@estudiante.uam.es', 'est123');
    renderAt('/exams/e-mat-p1');
    expect(await screen.findByText('Tu nota', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Desglose' })).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(await screen.findByLabelText('Derivadas'));
    await user.type(await screen.findByLabelText('Motivo'), 'Revisad el apartado b');
    await user.click(screen.getByRole('button', { name: 'Pedir revisión de 1 problemas' }));
    expect(await screen.findByText('Solicitud enviada')).toBeInTheDocument();
    expect(db.review_requests.some((r) => r.instance_id === 'i-e-mat-p1-1' && r.student_message === 'Revisad el apartado b')).toBe(true);
  });

  it('does not offer the teacher review inbox to a student-only user', async () => {
    await loginAs('elena.rodriguez@estudiante.uam.es', 'est123');
    renderAt('/');
    expect(await screen.findByRole('heading', { name: 'Mis exámenes' })).toBeInTheDocument();
    await screen.findByRole('link', { name: 'Asignaturas' });
    expect(screen.queryByRole('link', { name: 'Revisiones' })).not.toBeInTheDocument();
  });

  it('hides unpublished results', async () => {
    await loginAs('elena.rodriguez@estudiante.uam.es', 'est123');
    renderAt('/exams/e-fis-p1');
    expect(await screen.findByText('Tu nota aún no está publicada')).toBeInTheDocument();
  });
});

describe('teacher review inbox', () => {
  it('resolves a request and finalizes the instance when none remain', async () => {
    await loginAs('maria.perez@uam.es', 'prof123');
    renderAt('/reviews');
    const item = (await screen.findByText('Derivadas', { exact: false })).closest('li');
    const user = userEvent.setup();
    await user.type(within(item).getByLabelText('Respuesta al estudiante'), 'Se mantiene la nota');
    await user.click(within(item).getByRole('button', { name: /^Resolver/ }));
    expect(await screen.findByText('Solicitud resuelta')).toBeInTheDocument();
    expect(db.instances.find((i) => i.id === 'i-e-mat-p1-3').status).toBe('FINALIZED');
  });
});

describe('exam authoring contract', () => {
  it('creates an exam, a model, problems and a rubric, then refuses to delete an exam with instances', async () => {
    await loginAs('maria.perez@uam.es', 'prof123');
    const exam = await api.post('/subjects/s-prg102/exams/', { name: 'Práctica 2' });
    expect(exam).toMatchObject({ name: 'Práctica 2', subject_code: 'PRG102', models_problems: [] });
    const model = await api.post(`/exams/${exam.id}/models/`, { label: 'A' });
    await expect(api.post(`/exams/${exam.id}/models/`, { label: 'A' })).rejects.toMatchObject({ code: 'MODEL_LABEL_EXISTS', status: 409 });
    const p = await api.post(`/models/${model.id}/problems/`, { name: 'Diseño', max_score: '4' });
    expect(p.max_score).toBe('4.00');
    const crit = await api.post(`/problems/${p.id}/rubric/`, { criteria: [{ description: 'Clases', score: '2' }, { description: 'Pruebas', score: '2' }] });
    expect(crit).toHaveLength(2);
    const again = await api.post(`/problems/${p.id}/rubric/`, { criteria: [{ description: 'Todo', score: '4' }] });
    expect(again).toHaveLength(1); // replaces, like set_rubric
    const full = await api.get(`/exams/${exam.id}/`);
    expect(full.models_problems[0].problems[0].rubric_criteria).toHaveLength(1);
    await expect(api.del('/exams/e-prg-pr1/')).rejects.toMatchObject({ code: 'HAS_INSTANCES' });
    await api.del(`/exams/${exam.id}/`);
    await expect(api.get(`/exams/${exam.id}/`)).rejects.toMatchObject({ status: 404 });
  });

  it('validates the blank PDF and the convocation like the backend', async () => {
    await loginAs('maria.perez@uam.es', 'prof123');
    const form = new FormData();
    form.append('file', new File(['not a pdf'], 'x.pdf', { type: 'application/pdf' }));
    await expect(api.upload('/models/mdl-e-mat-p2/blank-pdf/', form, 'PUT')).rejects.toMatchObject({ code: 'INVALID_PDF' });
    const ok = new FormData();
    ok.append('file', new File(['%PDF-1.7 ...'], 'blank.pdf', { type: 'application/pdf' }));
    const res = await api.upload('/models/mdl-e-mat-p2/blank-pdf/', ok, 'PUT');
    expect(res.pages).toBeGreaterThan(0);
    const conv = await api.put('/exams/e-mat-p2/convocation/', { student_ids: ['u-elena', 'u-javier'] });
    expect(conv).toMatchObject({ total: 2, valid: 1 });
    expect(conv.invalid[0]).toMatchObject({ user_id: 'u-javier', reason: 'NOT_ACTIVE_STUDENT' });
  });

  it('manages corrector rules and reports coverage with the contract field names', async () => {
    await loginAs('maria.perez@uam.es', 'prof123');
    const before = await api.get('/exams/e-prg-pr1/coverage/');
    expect(before).toMatchObject({ complete: false, total_problems: 2, covered_problems: 0 });
    expect(before.uncovered_problems).toHaveLength(2);
    const rule = await api.post('/exams/e-prg-pr1/assignment-rules/', { problems: ['p-e-prg-pr1-1', 'p-e-prg-pr1-2'], correctors: ['u-maria'] });
    expect((await api.get('/exams/e-prg-pr1/coverage/')).complete).toBe(true);
    await api.del(`/assignment-rules/${rule.id}/`);
    expect(await api.get('/exams/e-prg-pr1/assignment-rules/')).toHaveLength(0);
    await loginAs('javier.ruiz@uam.es', 'prof123');
    await expect(api.post('/subjects/s-mat101/exams/', { name: 'X' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('offers exam setup to the coordinator from the exam page', async () => {
    await loginAs('maria.perez@uam.es', 'prof123');
    renderAt('/exams/e-mat-p2');
    const link = await screen.findByRole('link', { name: 'Configurar' });
    expect(link).toHaveAttribute('href', '/exams/e-mat-p2/setup');
  });
});
