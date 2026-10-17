import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../../lib/api/client.js';
import { db } from '../../lib/mock/db.js';
import { loginAs, renderPage, resetDemo } from '../admin/test-utils.jsx';
import SubjectsPage from './SubjectsPage.jsx';

const fileForm = (rows, filename = 'subjects.json') => {
  const form = new FormData(); form.append('file', new File([typeof rows === 'string' ? rows : JSON.stringify(rows)], filename, { type: filename.endsWith('.csv') ? 'text/csv' : 'application/json' })); return form;
};
beforeEach(async () => { await resetDemo(); await loginAs(); });
afterEach(() => vi.restoreAllMocks());
const subject = { name: 'Álgebra', code: 'ALG101', coordinator_email: 'maria.perez@uam.es', semester: '1', groups: ['G1'], teachers: ['javier.ruiz@uam.es'], students: [{ email: 'elena.rodriguez@estudiante.uam.es', group: 'G1' }] };

it('imports a subject with its groups and members, preserving the export contract', async () => {
  const result = await api.upload('/subjects/import/', fileForm([subject]));
  expect(result).toEqual({ created: 1, total_errors: 0, errors: [] });
  const row = db.subjects.find((s) => s.code === 'ALG101');
  expect(row.course_id).toBe('c-2627');
  expect(db.memberships.filter((m) => m.subject_id === row.id)).toHaveLength(3);
  const exported = await api.get('/subjects/export/', { export_format: 'json', course_id: 'c-2627' });
  expect(exported.find((s) => s.code === 'ALG101')).toEqual(subject);
  expect((await api.get('/search/', { course_id: 'c-2627', search: 'Álgebra' })).results[0].id).toBe(row.id);
});

it('reports row errors without creating partial groups or memberships', async () => {
  const before = { groups: db.groups.length, members: db.memberships.length };
  const invalid = { ...subject, code: 'BAD101', students: [{ email: 'unknown@uam.es', group: 'G1' }] };
  const result = await api.upload('/subjects/import/', fileForm([invalid, { name: 'Teoría', code: 'TEO101', coordinator_email: 'maria.perez@uam.es' }, { ...subject, coordinator_email: 'missing@uam.es' }]));
  expect(result.created).toBe(1); expect(result.total_errors).toBe(2); expect(result.errors).toHaveLength(2);
  expect(db.subjects.some((s) => s.code === 'BAD101')).toBe(false);
  expect(db.groups).toHaveLength(before.groups);
  expect(db.memberships).toHaveLength(before.members + 1);
});

it('imports simple CSV subjects using the documented scalar fields', async () => {
  const result = await api.upload('/subjects/import/', fileForm('name,code,coordinator_email,semester\nÁlgebra,ALG101,maria.perez@uam.es,1\n', 'subjects.csv'));
  expect(result).toEqual({ created: 1, total_errors: 0, errors: [] });
});

it('shows the summary on the page and refreshes the directory after import', async () => {
  const user = userEvent.setup(); const spy = vi.spyOn(api, 'upload'); renderPage(<SubjectsPage />);
  await screen.findByText('MAT101');
  await user.click(screen.getByRole('button', { name: 'Importar asignaturas' }));
  await user.upload(screen.getByLabelText('Archivo CSV o JSON'), new File([JSON.stringify([subject, {}])], 'subjects.json', { type: 'application/json' }));
  fireEvent.submit(screen.getByRole('button', { name: 'Importar archivo' }).closest('form'));
  await screen.findByText('Importación completada');
  const dialog = within(screen.getByRole('dialog'));
  expect(dialog.getByText('Creados').nextElementSibling).toHaveTextContent('1');
  expect(dialog.getByText('Filas con errores').nextElementSibling).toHaveTextContent('1');
  expect(dialog.queryByText('Filas procesadas')).not.toBeInTheDocument();
  expect([...spy.mock.calls[0][1].keys()]).toEqual(['file']);
  await user.keyboard('{Escape}');
  expect(await screen.findByText('ALG101')).toBeInTheDocument();
}, 15000);

it('denies imports and exports to subject coordinators without organization access', async () => {
  await loginAs('maria.perez@uam.es', 'prof123');
  await expect(api.upload('/subjects/import/', fileForm([subject]))).rejects.toMatchObject({ status: 403 });
  await expect(api.get('/subjects/export/')).rejects.toMatchObject({ status: 403 });
});
