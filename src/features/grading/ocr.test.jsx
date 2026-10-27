/* Handwriting recognition: pad format, grade OCR (auto-apply / doubtful reading), transcription. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../../app/i18n.js';
import { api } from '../../lib/api/client.js';
import { tokenStore } from '../../lib/api/tokens.js';
import { db } from '../../lib/mock/db.js';
import '../../app/registry.js'; // registers every feature's mock handlers
import { parseInk, parseRecognizedScore, recognizeExistingGrade, recognizeGrade, toRecognizerStrokes, transcribeHandwriting } from './ocr.js';
import { createAnnotation } from './api.js';
import SavedGradeOcr from './SavedGradeOcr.jsx';
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
    expect(notes()).toEqual([expect.objectContaining({ problem_id: PROBLEM, is_grade_annotation: false })]);
  });

  it('only proposes a doubtful reading, without grading', async () => {
    const r = await recognizeGrade(INST, PROBLEM, pad(5));
    expect(r).toMatchObject({ score: 5, autoApplied: false, confidence: 0.55 });
    expect(db.grades.some((g) => g.instance_id === INST)).toBe(false);
  });

  it('reports empty ink and preserves the source for correction', async () => {
    await expect(recognizeGrade(INST, PROBLEM, [])).rejects.toMatchObject({ status: 400, code: 'EMPTY_STYLUS_PAYLOAD' });
    expect(notes()).toHaveLength(1);
  });
});

describe('transcribeHandwriting', () => {
  it('returns text while preserving its source annotation', async () => {
    const r = await transcribeHandwriting(INST, pad(3));
    expect(r.text).toContain('3');
    expect(notes()).toHaveLength(1);
  });
});

const existing = (payload, extra = {}) => createAnnotation(INST, { annotation_type: 'STYLUS', payload,
  problem_id: PROBLEM, page_number: 1, x: 0, y: 0, ...extra });

describe('H14 existing annotations', () => {
  it('accepts normalized page ink without changing or duplicating it', async () => {
    const content = JSON.stringify({ v: 1, strokes: [line(0.2)] });
    const a = await existing(content);
    const before = structuredClone(notes());
    expect(await recognizeExistingGrade(a.id)).toMatchObject({ score: 1, autoApplied: true, applyErrorCode: null });
    expect(notes()).toEqual(before);
  });

  it.each(['{', '{"v":2,"strokes":[]}', '{"strokes":[{"points":[{"x":2,"y":0}]}]}', '[[{"x":true,"y":0}]]'])(
    'rejects invalid payload %s without modifying grades or ink', async (payload) => {
      const a = await existing(payload);
      await expect(recognizeExistingGrade(a.id)).rejects.toMatchObject({ status: 400, code: 'INVALID_STYLUS_PAYLOAD' });
      expect(notes()[0].content).toBe(payload);
      expect(db.grades.some((g) => g.instance_id === INST)).toBe(false);
    });

  it('returns low confidence as a non-application reason', async () => {
    expect(await recognizeGrade(INST, PROBLEM, pad(5))).toMatchObject({ score: 5, autoApplied: false, applyErrorCode: 'LOW_CONFIDENCE' });
  });

  it.each([['0', 0, true, null], ['2,5', 2.5, true, null], ['-1', -1, false, 'INVALID_SCORE'], ['7', 7, false, 'SCORE_EXCEEDS_MAX'], ['7 or 8', null, false, 'NO_RECOGNIZED_VALUE']])(
    'preserves the TEXT reading %s and reports application separately', async (payload, score, autoApplied, applyErrorCode) => {
      const a = await existing(payload, { annotation_type: 'TEXT' });
      expect(await recognizeExistingGrade(a.id)).toMatchObject({ score, autoApplied, applyErrorCode });
    });

  it('denies another author with 403 before payload validation', async () => {
    const a = await existing('{');
    notes()[0].author_id = 'u-javier';
    await expect(recognizeExistingGrade(a.id)).rejects.toMatchObject({ status: 403, code: 'NOT_AUTHOR' });
  });

  it('hides a foreign tenant with 404 even from its author', async () => {
    const a = await existing('{');
    db.instances.find((i) => i.id === INST).organization_id = 'foreign';
    await expect(recognizeExistingGrade(a.id)).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('reports unavailable OCR with 503 and preserves the record', async () => {
    const a = await existing(JSON.stringify({ strokes: [line(0.2)] }));
    db.org_config.default_ocr_engine = 'missing';
    await expect(recognizeExistingGrade(a.id)).rejects.toMatchObject({ status: 503, code: 'OCR_UNAVAILABLE' });
    expect(notes()).toHaveLength(1);
  });

  it('reloads after server application without offering a second save, even when reload fails', async () => {
    const a = await existing('2,5', { annotation_type: 'TEXT' });
    const onApplied = vi.fn().mockRejectedValue(new Error('offline'));
    const onUse = vi.fn();
    render(<SavedGradeOcr instanceId={INST} problem={{ id: PROBLEM }} currentUserId="u-maria" onApplied={onApplied} onUse={onUse} />);
    await userEvent.click(await screen.findByRole('button', { name: /reconocer anotación guardada|recognize saved annotation/i }));
    await waitFor(() => expect(onApplied).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button', { name: /usar esta nota|use this grade/i })).toBeNull();
    expect(onUse).not.toHaveBeenCalled();
    expect(notes().find((n) => n.id === a.id).content).toBe('2,5');
    expect(await screen.findByRole('alert')).toHaveTextContent(/recarga|refresh/i);
  });
});

it('only accepts a full numeric OCR reading', () => {
  for (const value of ['', ' ', '7 or 8', '0x10', 'Infinity']) expect(parseRecognizedScore(value)).toBeNull();
  expect(parseRecognizedScore('0')).toBe(0);
  expect(parseRecognizedScore('7,5')).toBe(7.5);
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
