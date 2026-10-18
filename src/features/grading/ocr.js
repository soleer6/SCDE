import { createAnnotation, deleteAnnotation, ocrAnnotation, ocrGradeAnnotation } from './api.js';

/* Handwriting recognition (RF-9.12, RF-9.13). Decision and backend gap: docs/tfg/03-backend-gaps.md (gap-9).
 *
 * The backend renders a STYLUS payload to a 400x200 image before OCR
 * (_render_stylus_to_image) and only understands a JSON list of strokes,
 * each a list of {x, y} in 0-100. Page ink is stored as { v: 1, strokes:
 * [{ points }] } in 0-1, which that renderer would draw as a blank image, so
 * recognition goes through a dedicated 2:1 pad whose strokes are sent in the
 * renderer's format as their own annotation. */

const pct = (v) => Math.round(Math.min(Math.max(v, 0), 1) * 1000) / 10;

/** Pad strokes ({ points: [{x,y}] } in 0-1) -> renderer strokes ([[{x,y}]] in 0-100). */
export const toRecognizerStrokes = (strokes) =>
  strokes.filter((s) => s.points?.length > 1).map((s) => s.points.map((p) => ({ x: pct(p.x), y: pct(p.y) })));

/** Annotations written by the recognition pads, not page ink nor the general comment. */
export const isPadAnnotation = (a) => Boolean(a.problem_id || a.is_grade_annotation);

/** Page ink strokes from a STYLUS payload ([] if unreadable); null for a pad (renderer-format) payload. */
export function parseInk(text) {
  try {
    const data = JSON.parse(text);
    if (Array.isArray(data)) return data.length && Array.isArray(data[0]) ? null : data; // legacy: bare stroke list
    return Array.isArray(data?.strokes) ? data.strokes : [];
  } catch {
    return [];
  }
}

const stylus = (strokes, extra) => ({
  annotation_type: 'STYLUS',
  payload: JSON.stringify(toRecognizerStrokes(strokes)),
  page_number: 1,
  x: 0,
  y: 0,
  ...extra,
});

/** Parses OCR output ("7,5", " 8 ") as a score; null when it is not a number. */
export function parseRecognizedScore(value) {
  if (value == null) return null;
  const n = Number(String(value).trim().replace(',', '.'));
  return value !== '' && Number.isFinite(n) ? n : null;
}

/**
 * Handwritten grade for one problem: creates a grade annotation tied to the
 * problem (the backend may already apply the grade on creation, RF-10.5) and
 * asks for the reading. An unreadable attempt is deleted so it does not
 * linger as the problem's grade annotation.
 * -> { annotationId, score: number|null, confidence, autoApplied, raw }
 */
export async function recognizeGrade(instanceId, problemId, strokes) {
  const created = await createAnnotation(instanceId, stylus(strokes, { problem_id: problemId, is_grade_annotation: true }));
  try {
    const res = await ocrGradeAnnotation(created.id);
    const score = parseRecognizedScore(res.recognized_value);
    if (score === null) await deleteAnnotation(created.id).catch(() => {});
    return { annotationId: created.id, score, confidence: res.confidence, autoApplied: Boolean(res.auto_applied), raw: res.raw_value ?? '' };
  } catch (e) {
    await deleteAnnotation(created.id).catch(() => {});
    throw e;
  }
}

/** Handwriting -> text for the general comment. The pad annotation is temporary. */
export async function transcribeHandwriting(instanceId, strokes) {
  const created = await createAnnotation(instanceId, stylus(strokes));
  try {
    const res = await ocrAnnotation(created.id);
    return { text: (res.recognized_text ?? '').trim(), confidence: res.confidence };
  } finally {
    await deleteAnnotation(created.id).catch(() => {});
  }
}
