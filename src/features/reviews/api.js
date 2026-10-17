import { api } from '../../lib/api/client.js';

/* PATCH /review-requests/{id}/resolve/ { resolver_message } -> ReviewRequestResponse */
export const resolveReviewRequest = (id, resolverMessage) => api.patch(`/review-requests/${id}/resolve/`, { resolver_message: resolverMessage });
