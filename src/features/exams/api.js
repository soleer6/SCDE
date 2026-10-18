import { api, asList, asPage, request } from '../../lib/api/client.js';

/* GET /exams/{id}/ -> ExamBasic | ExamTeacher | ExamFull */
export const getExam = (id) => api.get(`/exams/${id}/`);

/* GET /exams/{id}/instances/ (filters: status, has_issues, model_id, page)
 * Teachers: paginated InstanceResponse. Students: [StudentInstance] (own only). */
export const getExamInstances = (id, query) => api.get(`/exams/${id}/instances/`, query);

/** Every instance of an exam for teacher views (walks all pages). */
export async function getAllExamInstances(id, query = {}) {
  const first = asPage(await getExamInstances(id, { ...query, page_size: 100 }));
  let items = first.items;
  for (let p = 2; p <= first.totalPages; p++) {
    items = items.concat(asPage(await getExamInstances(id, { ...query, page_size: 100, page: p })).items);
  }
  return items;
}

/* POST /exams/{id}/publish/ -> PublishResult */
export const publishExam = (id) => api.post(`/exams/${id}/publish/`);
/* GET /exams/{id}/review/ -> ReviewResponse (404 if none) */
export const getReview = (id) =>
  api.get(`/exams/${id}/review/`).catch((e) => {
    if (e.status === 404) return null;
    throw e;
  });
/* POST /exams/{id}/review/ CreateReviewRequest -> ReviewResponse */
export const createReview = (id, body) => api.post(`/exams/${id}/review/`, body);
/* GET /exams/{id}/coverage/ -> CoverageResponse */
export const getCoverage = (id) => api.get(`/exams/${id}/coverage/`);
/* GET /exams/{id}/export/?format=csv|json -> file */
export const exportGrades = (id, format = 'csv') => api.blob(`/exams/${id}/export/`, { format });

/* ---------------- Authoring (RF-6.x) ---------------- */
/* POST /subjects/{id}/exams/ { name, date? } -> ExamFull */
export const createExam = (subjectId, body) => api.post(`/subjects/${subjectId}/exams/`, body);
/* PATCH /exams/{id}/ { name?, date?, student_permissions? } -> ExamFull */
export const updateExam = (id, body) => api.patch(`/exams/${id}/`, body);
/* DELETE /exams/{id}/ (409 HAS_INSTANCES) */
export const deleteExam = (id) => api.del(`/exams/${id}/`);
/* POST /exams/{id}/models/ { label, copy_from_id? } -> ModelDetail */
export const createModel = (examId, body) => api.post(`/exams/${examId}/models/`, body);
/* GET /models/{id}/ -> ModelDetail */
export const getModel = (id) => api.get(`/models/${id}/`);
/* PUT /models/{id}/blank-pdf/ multipart { file } -> BlankPDFUploadResponse */
export function uploadBlankPdf(modelId, file) {
  const form = new FormData();
  form.append('file', file);
  return api.upload(`/models/${modelId}/blank-pdf/`, form, 'PUT');
}
/* POST /models/{id}/qr-pdf/ -> PDF with QR codes (Blob) */
export const generateQrPdf = async (modelId) => (await request(`/models/${modelId}/qr-pdf/`, { method: 'POST', raw: true })).blob();
/* ---------------- Page profiles and recognition zones (RF-6.8) ----------------
 * Zone coordinates are PDF points with the origin at the bottom-left corner. */
/* GET /models/{id}/page-profiles/ -> PageProfileResponse[] */
export const listPageProfiles = (modelId) => api.get(`/models/${modelId}/page-profiles/`).then(asList);
/* POST /models/{id}/page-profiles/ { page_number } -> PageProfileResponse (409 NO_BLANK_PDF, PAGE_PROFILE_EXISTS…) */
export const createPageProfile = (modelId, pageNumber) => api.post(`/models/${modelId}/page-profiles/`, { page_number: pageNumber });
/* POST /page-profiles/{id}/zones/ CreateZoneRequest -> ZoneResponse[]
 * (the OpenAPI declares one ZoneResponse, the Django view returns a list: one per page). */
export const createZone = (profileId, body) =>
  api.post(`/page-profiles/${profileId}/zones/`, body).then((r) => (Array.isArray(r) ? r : [r]));
/* DELETE /zones/{id}/ -> 204 */
export const deleteZone = (zoneId) => api.del(`/zones/${zoneId}/`);

/* POST /models/{id}/problems/ { name, max_score, order?, zone_ids? } -> ProblemResponse */
export const createProblem = (modelId, body) => api.post(`/models/${modelId}/problems/`, body);
/* POST /problems/{id}/rubric/ { criteria: [{ description, score }] } -> RubricCriterionResponse[] (replaces) */
export const setRubric = (problemId, criteria) => api.post(`/problems/${problemId}/rubric/`, { criteria });
/* PUT /exams/{id}/convocation/ { student_ids } -> { total, valid, invalid } (replaces) */
export const setConvocation = (examId, studentIds) => api.put(`/exams/${examId}/convocation/`, { student_ids: studentIds });

/* ---------------- Corrector assignment (RF-8.x) ---------------- */
export const listAssignmentRules = (examId) => api.get(`/exams/${examId}/assignment-rules/`).then(asList);
export const createAssignmentRule = (examId, body) => api.post(`/exams/${examId}/assignment-rules/`, body);
export const deleteAssignmentRule = (ruleId) => api.del(`/assignment-rules/${ruleId}/`);

/* Subject members (endpoint owned by the subject-admin feature; read-only use here). */
export const listSubjectMembers = (subjectId, query) =>
  api.get(`/subjects/${subjectId}/members/`, { page_size: 100, ...query }).then(asList);

export { asList };
