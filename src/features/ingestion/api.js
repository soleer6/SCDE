import { API_URL, api, asList, request } from '../../lib/api/client.js';

/* ---------------- Pages of an instance (RF-7.14) ---------------- */
/* GET /instances/{id}/pages/ -> PageResponse[] (includes DISCARDED pages) */
export const getInstancePages = (instanceId) => api.get(`/instances/${instanceId}/pages/`).then(asList);
/* DELETE /instances/{id}/pages/{pid}/ -> 204 (logical: status DISCARDED) */
export const discardPage = (instanceId, pageId) => api.del(`/instances/${instanceId}/pages/${pageId}/`);
/* PATCH /instances/{id}/pages/{pid}/accept/ -> DetailResponse (clears EXTRA_PAGE) */
export const acceptPage = (instanceId, pageId) => api.patch(`/instances/${instanceId}/pages/${pageId}/accept/`);
/* POST /instances/{id}/pages/{pid}/move/ { target_instance_id } -> DetailResponse (409 DIFFERENT_EXAM) */
export const movePage = (instanceId, pageId, targetInstanceId) =>
  api.post(`/instances/${instanceId}/pages/${pageId}/move/`, { target_instance_id: targetInstanceId });
/* PATCH /instances/{id}/pages/reorder/ { page_ids } -> DetailResponse */
export const reorderPages = (instanceId, pageIds) => api.patch(`/instances/${instanceId}/pages/reorder/`, { page_ids: pageIds });
/* POST /instances/{id}/pages/attach/ { page_id } -> DetailResponse (404 PAGE_NOT_ORPHAN).
 * Used instead of POST /orphan-pages/{pid}/attach/, whose view reads a field the
 * request schema does not define (docs/tfg/03-backend-gaps.md#gap-5). */
export const attachOrphan = (instanceId, pageId) => api.post(`/instances/${instanceId}/pages/attach/`, { page_id: pageId });

/* ---------------- Instances (RF-7.2, RF-7.10) ---------------- */
/* POST /exams/{id}/instances/create/ { student_id?, model_id? } -> InstanceResponse (manager only) */
export const createInstance = (examId, body) => api.post(`/exams/${examId}/instances/create/`, body);
/* PATCH /instances/{id}/ { student_id?, model_id? } -> InstanceResponse (409 DUPLICATE_STUDENT) */
export const updateInstance = (instanceId, body) => api.patch(`/instances/${instanceId}/`, body);
/* DELETE /instances/{id}/ -> 204 */
export const deleteInstance = (instanceId) => api.del(`/instances/${instanceId}/`);

/* ---------------- Organization scans (manager only) ---------------- */
/* GET /orphan-pages/ -> PageResponse[] (instance_id null) */
export const getOrphanPages = () => api.get('/orphan-pages/').then(asList);
/* GET /recognition/engines/ -> OCREngine[] */
export const getOcrEngines = () => api.get('/recognition/engines/').then(asList);
/* POST /recognition/ingest/ multipart { file } -> 202 ManualIngestResponse */
export function ingestFile(file) {
  const form = new FormData();
  form.append('file', file);
  return api.upload('/recognition/ingest/', form);
}

/* ---------------- Page image (staff) ---------------- */
/* GET /pages/{id}/image/ -> image/png. PageResponse.image_url is that route as a
 * server-relative path (/api/v1/...) or null when the user may not inspect the
 * page; it needs the Bearer token, so it is fetched and shown as an object URL.
 * The caller revokes it. */
export async function getPageImageUrl(imageUrl, signal) {
  const path = imageUrl.startsWith('/') ? `${API_URL}${imageUrl}` : imageUrl;
  const res = await request(path, { raw: true, signal });
  return URL.createObjectURL(new Blob([await res.arrayBuffer()], { type: 'image/png' }));
}
