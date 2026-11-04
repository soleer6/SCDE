import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { fireEvent, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { render } from '@testing-library/react';
import { AuthProvider } from '../../lib/auth/AuthProvider.jsx';
import { api } from '../../lib/api/client.js';
import { ApiError } from '../../lib/api/errors.js';
import { db } from '../../lib/mock/db.js';
import { loginAs, renderPage, resetDemo } from './test-utils.jsx';
import CoursesPage from './CoursesPage.jsx';
import HistoryPage from './HistoryPage.jsx';

function seedHistory() {
  db.subjects.push({ ...db.subjects[0], id: 'old-subject', name: 'Asignatura histórica', code: 'HIS', course_id: 'c-2526' });
  db.exams.push({ ...db.exams[0], id: 'old-exam', name: 'Examen histórico', subject_id: 'old-subject' });
  db.models.push({ id: 'old-model', exam_id: 'old-exam', label: 'Z' });
  const template = db.instances[0];
  db.instances.push(...Array.from({ length: 28 }, (_, i) => ({ ...template, id: `old-${i}`, exam_id: 'old-exam', model_id: 'old-model', student_id: 'u-elena', status: 'ARCHIVED', total_score: '0.00', has_issues: i === 27 })));
}
beforeEach(async () => { await resetDemo(); await loginAs(); seedHistory(); });
afterEach(() => vi.restoreAllMocks());

it('browses all hierarchy levels with zero writes and shows the selected instance as read-only', async () => {
  const user = userEvent.setup();
  const writes = ['post', 'patch', 'put', 'del'].map(method => vi.spyOn(api, method));
  renderPage(<HistoryPage />);
  await user.click(await screen.findByRole('button', { name: 'Consultar 2025-2026' }));
  await user.click(await screen.findByRole('button', { name: 'Consultar Asignatura histórica' }));
  await user.click(await screen.findByRole('button', { name: 'Consultar Examen histórico' }));
  const rows = await screen.findAllByRole('button', { name: 'Consultar elena.rodriguez@estudiante.uam.es' });
  await user.click(rows[0]);
  const dialog = within(screen.getByRole('dialog'));
  expect(dialog.getByText('Solo lectura')).toBeInTheDocument();
  expect(dialog.getByText('old-0')).toBeInTheDocument();
  expect(dialog.getByText('0.00')).toBeInTheDocument();
  expect(dialog.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
  for (const write of writes) expect(write).not.toHaveBeenCalled();
});

it('combines search/status/issues across pages and resets page after changing a filter', async () => {
  const user = userEvent.setup();
  renderPage(<HistoryPage />, '/?course_id=c-2526&subject_id=old-subject&exam_id=old-exam');
  await screen.findAllByRole('button', { name: 'Consultar elena.rodriguez@estudiante.uam.es' });
  await user.click(screen.getByRole('button', { name: 'Siguiente' }));
  await screen.findByText('Página 2 de 2 · 28 registros');
  await user.selectOptions(screen.getByLabelText('Incidencias'), 'true');
  await screen.findByText('Página 1 de 1 · 1 registros');
  expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
  await user.selectOptions(screen.getByLabelText('Estado'), 'ARCHIVED');
  fireEvent.change(screen.getByLabelText('Buscar en este nivel'), { target: { value: 'Z' } });
  await user.click(screen.getByRole('button', { name: 'Buscar', exact: true }));
  await screen.findByText('Página 1 de 1 · 1 registros');
  expect((await api.get('/search/', { exam_id: 'old-exam', search: 'Z', status: 'ARCHIVED', has_issues: 'true' })).count).toBe(1);
});

it('recovers a failed historical level without losing its URL search or changing records', async () => {
  const original = structuredClone(db.instances);
  const get = vi.spyOn(api, 'get').mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 0));
  const user = userEvent.setup();
  renderPage(<HistoryPage />, '/?course_id=c-2526&search=HIS');
  await screen.findByRole('alert');
  await user.click(screen.getByRole('button', { name: 'Reintentar' }));
  await screen.findByRole('button', { name: 'Consultar Asignatura histórica' });
  await waitFor(() => expect(screen.getByRole('region', { name: 'Asignaturas' })).toHaveFocus());
  expect(get).toHaveBeenLastCalledWith('/search/', { course_id: 'c-2526', page: 1, search: 'HIS' });
  expect(screen.getByLabelText('Buscar en este nivel')).toHaveValue('HIS');
  expect(db.instances).toEqual(original);
});

function BackControl() {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)}>Atrás del navegador</button>;
}
it('preserves historical course selection when navigating back and handles empty levels', async () => {
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={['/?course_id=c-2526']}><AuthProvider><BackControl /><HistoryPage /></AuthProvider></MemoryRouter>);
  await user.click(await screen.findByRole('button', { name: 'Consultar Asignatura histórica' }));
  await screen.findByRole('button', { name: 'Consultar Examen histórico' });
  await user.click(screen.getByRole('button', { name: 'Atrás del navegador' }));
  await screen.findByRole('button', { name: 'Consultar Asignatura histórica' });
  fireEvent.change(screen.getByLabelText('Buscar en este nivel'), { target: { value: 'sin resultados' } });
  await user.click(screen.getByRole('button', { name: 'Buscar', exact: true }));
  await screen.findByText('No hay resultados en este nivel');
});

it('keeps archived course editing disabled while offering its history link and rejects the mock PATCH', async () => {
  renderPage(<CoursesPage />);
  const row = (await screen.findByText('2025-2026')).closest('tr');
  expect(within(row).getByRole('button', { name: 'Editar curso' })).toBeDisabled();
  expect(within(row).getByRole('link', { name: 'Consultar' })).toHaveAttribute('href', '/admin/history?course_id=c-2526&course_label=2025-2026');
  await expect(api.patch('/courses/c-2526/', { label: 'Cambio' })).rejects.toMatchObject({ status: 409, code: 'COURSE_ARCHIVED' });
});

it('rejects non-manager history access and does not include foreign organization entities in search', async () => {
  db.courses.push({ ...db.courses[0], id: 'foreign-course', label: 'AJENO', organization_id: 'foreign' });
  db.subjects.push({ ...db.subjects[0], id: 'foreign-subject', course_id: 'foreign-course' });
  db.exams.push({ ...db.exams[0], id: 'foreign-exam', subject_id: 'foreign-subject' });
  db.instances.push({ ...db.instances[0], id: 'foreign-instance', exam_id: 'foreign-exam' });
  expect((await api.get('/search/', { course_id: 'foreign-course' })).count).toBe(0);
  expect((await api.get('/search/', { subject_id: 'foreign-subject' })).count).toBe(0);
  expect((await api.get('/search/', { exam_id: 'foreign-exam' })).count).toBe(0);
  await loginAs('elena.rodriguez@estudiante.uam.es', 'est123');
  renderPage(<HistoryPage />);
  await screen.findByRole('alert');
  await expect(api.get('/search/')).rejects.toMatchObject({ status: 403 });
});
