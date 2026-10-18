/* Handwriting recognition: pad format, grade OCR (auto-apply / doubtful reading), transcription. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../../app/i18n.js';
import { api } from '../../lib/api/client.js';
import { tokenStore } from '../../lib/api/tokens.js';
import { db } from '../../lib/mock/db.js';
import '../../app/registry.js'; // registers every feature's mock handlers
import { parseInk, recognizeGrade, toRecognizerStrokes, transcribeHandwriting } from './ocr.js';
import { useAnnotations } from './useAnnotations.js';
import { GradeOcr } from './HandwritingOcr.jsx';

globalThis.ResizeObserver ??= class {
  observe() {}
  disconnect() {}
};
HTMLCanvasElement.prototype.getContext = () => null; // jsdom has no canvas; InkCanvas skips painting

const INST = 'i-e-mat-p2-3';
const PROBLEM = 'p-e-mat-p2-1'; // manual score, max 4
const line = (y) => ({ points: [{ x: 0.1, y }, { x: 0.5, y: y + 0.1 }], color: '#111', width: 0.012, tool: 'pen' });
const pad = (n) => Array.from({ length: n }, (_, k) => line(k * 0.1));
const notes = () => db.annotations.filter((a) => a.instance_id === INST);

beforeEach(async () => {
  localStorage.clear();
  db.reset();
  globalThis.fetch = vi.fn(async (url) => new Response(decodeURIComponent(String(url).split(',')[1] ?? '')));
  const data = await api.post('/auth/login/', { email: 'maria.perez@uam.es', password: 'prof123' }, { auth: false });
  tokenStore.set(data.access_token, data.refresh_token);
});

describe('pad format', () => {
  it('sends strokes as lists of points in 0-100, the format the backend renderer draws', () => {
    expect(toRecognizerStrokes([line(0.2), { points: [{ x: 0.3, y: 0.3 }] }])).toEqual([
      [
        { x: 10, y: 20 },
        { x: 50, y: 30 },
      ],
    ]);
  });

  it('tells page ink from pad payloads', () => {
    expect(parseInk(JSON.stringify({ v: 1, strokes: [line(0.1)] }))).toHaveLength(1);
    expect(parseInk(JSON.stringify([[{ x: 1, y: 2 }]]))).toBeNull();
    expect(parseInk('')).toEqual([]);
  });
});

describe('recognizeGrade', () => {
  it('applies a confident reading and keeps the grade annotation', async () => {
    const r = await recognizeGrade(INST, PROBLEM, pad(2));
    expect(r).toMatchObject({ score: 2, autoApplied: true });
    expect(db.grades.find((g) => g.instance_id === INST && g.problem_id === PROBLEM)?.score).toBe(2);
    expect(notes()).toEqual([expect.objectContaining({ problem_id: PROBLEM, is_grade_annotation: true })]);
  });

  it('only proposes a doubtful reading, without grading', async () => {
    const r = await recognizeGrade(INST, PROBLEM, pad(5));
    expect(r).toMatchObject({ score: 5, autoApplied: false, confidence: 0.55 });
    expect(db.grades.some((g) => g.instance_id === INST)).toBe(false);
  });

  it('drops an unreadable attempt', async () => {
    const r = await recognizeGrade(INST, PROBLEM, []);
    expect(r.score).toBeNull();
    expect(notes()).toHaveLength(0);
  });
});

describe('transcribeHandwriting', () => {
  it('returns the text and deletes the temporary pad annotation', async () => {
    const r = await transcribeHandwriting(INST, pad(3));
    expect(r.text).toContain('3');
    expect(notes()).toHaveLength(0);
  });
});

it('page ink ignores grade pads of the same page', async () => {
  await recognizeGrade(INST, PROBLEM, pad(1));
  const { result } = renderHook(() => useAnnotations(INST));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.strokesByPage).toEqual({});
});

it('opens the grade pad on demand and needs strokes before recognising', async () => {
  render(<GradeOcr instanceId={INST} problem={{ id: PROBLEM, name: 'Límites' }} onApplied={() => {}} onUse={() => {}} />);
  await userEvent.click(screen.getByRole('button', { name: /nota a mano|handwritten grade/i }));
  expect(screen.getByRole('group', { name: /límites/i })).toBeTruthy();
  expect(screen.getByRole('button', { name: /reconocer nota|recognise grade/i }).disabled).toBe(true);
});
