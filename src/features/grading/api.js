import { api, asList, request } from '../../lib/api/client.js';
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
export const updateAnnotation = (annotationId, body) => api.put(`/annotations/${annotationId}/`, body);
export const deleteAnnotation = (annotationId) => api.del(`/annotations/${annotationId}/`);

/* POST /annotations/{id}/ocr/ -> OCRStylusResponse { recognized_text, confidence } (RF-9.13) */
export const ocrAnnotation = (annotationId) => api.post(`/annotations/${annotationId}/ocr/`);
/* POST /annotations/{id}/ocr-grade/ -> OCRGradeResponse { recognized_value, confidence, auto_applied, raw_value } (RF-9.12).
 * Needs problem_id; above the server threshold the grade is applied (auto_applied). */
export const ocrGradeAnnotation = (annotationId) => api.post(`/annotations/${annotationId}/ocr-grade/`);

/** Reads an annotation payload (text) from its presigned download_url. */
export async function readAnnotationPayload(annotation) {
  if (!annotation.download_url) return '';
  const res = await fetch(annotation.download_url);
  if (!res.ok) return '';
  return res.text();
}

/* ------------------------------------------------------------------
 * Known-grade cache. The backend has no endpoint that returns per-problem
 * grades to teachers, but re-grading requires old_score (optimistic
 * concurrency). We remember what this browser last saved.
 * Open question for the backend team: docs/tfg/03-backend-gaps.md
 * ------------------------------------------------------------------ */
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
