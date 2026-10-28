import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from '../../app/i18n.js';
import { ToastProvider } from '../../ui';
import ProblemNote from './ProblemNote.jsx';
import { listAnnotations, readAnnotationPayload, updateAnnotation } from './api.js';
vi.mock('./api.js', () => ({ listAnnotations: vi.fn(), readAnnotationPayload: vi.fn(), updateAnnotation: vi.fn(), createAnnotation: vi.fn(), deleteAnnotation: vi.fn() }));
let rows;
const props = { instanceId: 'i', problem: { id: 'p', name: 'P1' }, canEdit: true, currentUserId: 'me' };
const mount = (p = props) => render(<ToastProvider><ProblemNote {...p} /></ToastProvider>);
const save = (n) => screen.getByRole('button', { name: `Guardar comentario de P1 (${n})` });
beforeEach(async () => {
  vi.resetAllMocks(); await i18n.changeLanguage('es');
  rows = ['first', 'second', 'foreign'].map((text, n) => ({ id: String(n), text, author_id: n < 2 ? 'me' : 'other', author_email: 'synthetic@example.test', problem_id: 'p', annotation_type: 'TEXT' }));
  listAnnotations.mockImplementation(async () => rows.map((a) => ({ ...a })));
  readAnnotationPayload.mockImplementation(async (a) => a.text);
  updateAnnotation.mockImplementation(async (id, { payload }) => { rows.find((a) => a.id === id).text = payload; });
});
afterEach(cleanup);
it('edits each own TEXT by id, preserves sibling drafts on save and focus, and keeps foreign text read-only', async () => {
  const view = mount();
  await screen.findByDisplayValue('second');
  expect(screen.getAllByRole('textbox')).toHaveLength(2);
  expect(screen.getByText('foreign')).toHaveClass('gr-note__other');
  fireEvent.change(screen.getByDisplayValue('first'), { target: { value: 'first draft' } });
  fireEvent.change(screen.getByDisplayValue('second'), { target: { value: 'second saved' } });
  fireEvent.click(save(2));
  await waitFor(() => expect(updateAnnotation).toHaveBeenCalledWith('1', { payload: 'second saved' }));
  await screen.findByDisplayValue('first draft');
  fireEvent(window, new Event('focus'));
  await screen.findByDisplayValue('first draft');
  fireEvent.click(save(1));
  await waitFor(() => expect(rows[0].text).toBe('first draft'));
  await screen.findByDisplayValue('second saved');
  view.unmount(); mount();
  await screen.findByDisplayValue('first draft');
  expect(screen.getByDisplayValue('second saved')).toBeInTheDocument();
  expect(rows[2].text).toBe('foreign');
});
for (const status of [500, 403, 404]) it(`retains the second draft on ${status} and allows retry`, async () => {
  updateAnnotation.mockRejectedValueOnce({ status });
  mount(); await screen.findByDisplayValue('second');
  fireEvent.change(screen.getByDisplayValue('second'), { target: { value: 'retry draft' } });
  fireEvent.click(save(2));
  await screen.findByText('No se ha podido guardar el comentario.');
  await screen.findByDisplayValue('retry draft');
  await waitFor(() => expect(save(2)).toBeEnabled());
  fireEvent.click(save(2));
  await waitFor(() => expect(rows[1].text).toBe('retry draft'));
});
it('read-only mode offers no editor; failed reauthorization hides all notes and recovery reloads them', async () => {
  mount({ ...props, canEdit: false });
  await screen.findByText('second');
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  listAnnotations.mockRejectedValue({ status: 403, code: 'PERMISSION_DENIED' });
  fireEvent(window, new Event('focus'));
  await waitFor(() => expect(screen.queryByText('second')).not.toBeInTheDocument());
  expect(screen.queryByText('foreign')).not.toBeInTheDocument();
  listAnnotations.mockResolvedValue(rows);
  fireEvent(window, new Event('focus'));
  await screen.findByText('second');
});


