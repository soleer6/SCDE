import { createAnnotation, ocrAnnotation, ocrGradeAnnotation } from './api.js';

/* Handwriting recognition (RF-9.12, RF-9.13). Decision and backend gap: docs/tfg/03-backend-gaps.md (gap-9).
 *
 * H14 accepts page ink in 0-1 and the legacy 0-100 pad. Keep the dedicated
 * pad until coordinated UI/backend evidence supports retiring gap-9. */

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
  return /^[-+]?(?:\d*[.,]\d+|\d+)$/.test(String(value).trim()) && Number.isFinite(n) ? n : null;
}

/**
 * Recognize a saved annotation exactly once; application and reading are separate.
 * Keep its source even when the recognition or subsequent refresh fails.
 */
export async function recognizeExistingGrade(annotationId) {
  const res = await ocrGradeAnnotation(annotationId);
  return { annotationId, score: parseRecognizedScore(res.recognized_value), confidence: res.confidence,
    autoApplied: Boolean(res.auto_applied), applyErrorCode: res.apply_error_code ?? null, raw: res.raw_value ?? '' };
}

export async function recognizeGrade(instanceId, problemId, strokes) {
  // Creation must not start a hidden first attempt. Only the explicit endpoint applies.
  const created = await createAnnotation(instanceId, stylus(strokes, { problem_id: problemId, is_grade_annotation: false }));
  return recognizeExistingGrade(created.id);
}

/** Handwriting -> text. Preserve the source annotation, including failed attempts. */
export async function transcribeHandwriting(instanceId, strokes) {
  const created = await createAnnotation(instanceId, stylus(strokes));
  return transcribeExistingAnnotation(created.id);
}

export async function transcribeExistingAnnotation(annotationId) {
  const res = await ocrAnnotation(annotationId);
  return { text: (res.recognized_text ?? '').trim(), confidence: res.confidence };
}
