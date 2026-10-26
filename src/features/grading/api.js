import { api, asList, request } from '../../lib/api/client.js';
import { ApiError } from '../../lib/api/errors.js';
import { decryptPdf } from './pdfCrypto.js';

/* GET /instances/{id}/ -> InstanceResponse (teacher/staff) | StudentInstance (owner) */
export const getInstance = (id) => api.get(`/instances/${id}/`);

/* GET /instances/{id}/download/ -> application/pdf (staff, teachers, students allowed to
 * download) or application/octet-stream (student owner without can_download_pages:
 * AES-GCM, see pdfCrypto.js). Both carry the student watermark. `userId` is the
 * authenticated user's id, needed for the encrypted case. Returns an object URL
 * of a plain PDF; the caller revokes it. */
export async function getInstancePdfUrl(id, userId) {
  const res = await request(`/instances/${id}/download/`, { raw: true });
  const type = (res.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  const blob =
    type === 'application/octet-stream'
      ? await decryptPdf(await res.arrayBuffer(), userId)
      : new Blob([await res.arrayBuffer()], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}

/* PATCH /instances/{id}/transition/ { target_status } -> InstanceResponse */
export const transitionInstance = (id, target_status) => api.patch(`/instances/${id}/transition/`, { target_status });

/* PUT /instances/{id}/problems/{pid}/grade/ { score, old_score } -> GradeResponse (409 VERSION_CONFLICT) */
export const gradeManual = (id, problemId, score, oldScore = null) =>
  api.put(`/instances/${id}/problems/${problemId}/grade/`, { score: String(score), old_score: oldScore === null ? null : String(oldScore) });

/* PUT /instances/{id}/problems/{pid}/rubric/ { criterion_ids, old_score } -> GradeResponse */
export const gradeRubric = (id, problemId, criterionIds, oldScore = null) =>
  api.put(`/instances/${id}/problems/${problemId}/rubric/`, { criterion_ids: criterionIds, old_score: oldScore === null ? null : String(oldScore) });

/* Annotations (apps.annotations). Payload is stored server-side and read back via download_url. */
export const listAnnotations = (id) => api.get(`/instances/${id}/annotations/`).then(asList);
export const createAnnotation = (id, body) => api.post(`/instances/${id}/annotations/`, body);
/* POST multipart { annotation_type: AUDIO, file, page_number, x, y } -> AnnotationResponse
 * (400 NO_AUDIO_DATA / AUDIO_FORMAT_UNREADABLE / AUDIO_FORMAT_UNSUPPORTED / AUDIO_DURATION_EXCEEDED). */
export function createAudioAnnotation(id, blob, { page = 1, problemId } = {}) {
  const form = new FormData();
  form.append('annotation_type', 'AUDIO');
  form.append('file', blob, blob.name || 'audio.webm');
  form.append('page_number', String(page));
  form.append('x', '0');
  form.append('y', '0');
  if (problemId) form.append('problem_id', problemId);
  return api.upload(`/instances/${id}/annotations/`, form);
}
export const updateAnnotation = (annotationId, body) => api.put(`/annotations/${annotationId}/`, body);
export const deleteAnnotation = (annotationId) => api.del(`/annotations/${annotationId}/`);

/* POST /annotations/{id}/ocr/ -> OCRStylusResponse { recognized_text, confidence } (RF-9.13) */
export const ocrAnnotation = (annotationId) => api.post(`/annotations/${annotationId}/ocr/`);
/* POST /annotations/{id}/ocr-grade/ -> OCRGradeResponse { recognized_value, confidence, auto_applied, raw_value } (RF-9.12).
 * Needs problem_id; above the server threshold the grade is applied (auto_applied). */
export const ocrGradeAnnotation = (annotationId) => api.post(`/annotations/${annotationId}/ocr-grade/`);

/** Reads an annotation payload (text) from its presigned download_url. */
export async function readAnnotationPayload(annotation) {
  if (!annotation.download_url) throw new ApiError('NOT_FOUND', 404);
  const res = await fetch(annotation.download_url);
  if (!res.ok) throw new ApiError(res.status === 403 ? 'PERMISSION_DENIED' : 'UNKNOWN', res.status);
  return res.text();
}

/* ------------------------------------------------------------------
 * Known grades. Re-grading requires old_score (optimistic concurrency).
 * Backends with gap-1 resolved return InstanceResponse.grades (GradeResponse
 * for the problems the requester may grade): that is the source of truth.
 * Older backends omit the field, so this browser also remembers what it last
 * saved and falls back to it. See docs/tfg/03-backend-gaps.md#gap-1
 * ------------------------------------------------------------------ */

/** rubric_selections holds criterion ids; tolerate { criterion_id } objects too. */
export const selectionIds = (selections) =>
  (Array.isArray(selections) ? selections : []).map((s) => (typeof s === 'object' && s !== null ? s.criterion_id : s)).filter(Boolean);

/** GradeResponse -> the known-grade shape { score, criteria }. */
export const toKnownGrade = (g) => ({ score: g.score, criteria: selectionIds(g.rubric_selections) });

/** InstanceResponse.grades -> { [problem_id]: { score, criteria } }, or null when the backend does not send it. */
export function serverGrades(instance) {
  if (!Array.isArray(instance?.grades)) return null;
  const out = {};
  for (const g of instance.grades) if (g?.problem_id && g.score != null) out[g.problem_id] = toKnownGrade(g);
  return out;
}

const gradeKey = (id) => `scde.grades.${id}`;
export function readKnownGrades(id) {
  try {
    return JSON.parse(localStorage.getItem(gradeKey(id)) || '{}');
  } catch {
    return {};
  }
}
export function writeKnownGrade(id, problemId, value) {
  try {
    const all = readKnownGrades(id);
    all[problemId] = value;
    localStorage.setItem(gradeKey(id), JSON.stringify(all));
  } catch {
    /* ignore */
  }
}
