import { api, asList } from '../../lib/api/client.js';

/* GET /instances/{id}/review-requests/ -> ReviewRequestResponse[] (student: own) */
export const listMyReviewRequests = (instanceId) => api.get(`/instances/${instanceId}/review-requests/`).then(asList);

/* POST /instances/{id}/review-requests/ { problems: [{ problem_id, message }] } -> ReviewRequestResponse[] */
export const submitReviewRequests = (instanceId, problems) => api.post(`/instances/${instanceId}/review-requests/`, { problems });
