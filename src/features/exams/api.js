import { api, asList, asPage } from '../../lib/api/client.js';

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

export { asList };
