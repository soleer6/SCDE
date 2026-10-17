import { api, asList } from '../../lib/api/client.js';

/* GET /instances/{id}/ -> InstanceResponse (teacher/staff) | StudentInstance (owner) */
export const getInstance = (id) => api.get(`/instances/${id}/`);

/* GET /instances/{id}/download/ -> PDF (watermarked for students). Returns an object URL. */
export async function getInstancePdfUrl(id) {
  const blob = await api.blob(`/instances/${id}/download/`);
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
