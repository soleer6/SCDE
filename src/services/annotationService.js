import { apiGet, apiPost, apiRequest } from './apiClient.js';

const USE_MOCK = import.meta.env.VITE_MOCK_API === 'true';

/**
 * Returns all annotations for an instance.
 * Real API: GET /api/v1/instances/{instanceId}/annotations/
 * Returns: [{ id, annotation_type, payload, page_number, x, y, ... }]
 */
export async function getAnnotations(instanceId) {
  if (USE_MOCK) return [];
  const result = await apiGet(`/instances/${instanceId}/annotations/`);
  return Array.isArray(result) ? result : (result.results ?? []);
}

/**
 * Creates a single annotation on an instance.
 * Real API: POST /api/v1/instances/{instanceId}/annotations/
 * annotation: { annotation_type, payload, page_number, x?, y?, problem_id? }
 */
export async function createAnnotation(instanceId, annotation) {
  if (USE_MOCK) return null;
  return apiPost(`/instances/${instanceId}/annotations/`, annotation);
}

/**
 * Updates an existing annotation.
 * Real API: PUT /api/v1/annotations/{annotationId}/
 */
export async function updateAnnotation(annotationId, payload) {
  if (USE_MOCK) return null;
  return apiRequest(`/annotations/${annotationId}/`, {
    method: 'PUT',
    body: JSON.stringify({ payload }),
  });
}

/**
 * Syncs the frontend annotation blob to the backend.
 *
 * The frontend stores one flat object per instance (strokes + textComment).
 * The backend stores individual annotations (one STYLUS, one TEXT).
 *
 * Strategy: find existing annotations by type, PUT to update or POST to create.
 *
 * @param {string} instanceId
 * @param {{ strokes: object[], textComment: string }} data  — from useAnnotations
 */
export async function syncAnnotations(instanceId, data) {
  if (USE_MOCK) return;

  const existing = await getAnnotations(instanceId);
  const existingStylus = existing.find((a) => a.annotation_type === 'STYLUS');
  const existingText = existing.find((a) => a.annotation_type === 'TEXT');

  const allStrokes = Array.isArray(data.strokes) ? data.strokes : [];

  // Sync strokes
  if (allStrokes.length > 0) {
    const stylusPayload = JSON.stringify(allStrokes);
    if (existingStylus) {
      await updateAnnotation(existingStylus.id, stylusPayload);
    } else {
      await createAnnotation(instanceId, {
        annotation_type: 'STYLUS',
        payload: stylusPayload,
        page_number: 1,
      });
    }
  }

  // Sync text comment
  if (data.textComment) {
    if (existingText) {
      await updateAnnotation(existingText.id, data.textComment);
    } else {
      await createAnnotation(instanceId, {
        annotation_type: 'TEXT',
        payload: data.textComment,
        page_number: 1,
      });
    }
  }
}

/**
 * Loads annotations from the backend and writes them to localStorage
 * so that useAnnotations.loadAnnotations() can pick them up transparently.
 *
 * @param {string} instanceId
 * @param {string} authorEmail
 */
export async function preloadAnnotationsToLocalStorage(instanceId, authorEmail) {
  if (USE_MOCK) return;

  const annotations = await getAnnotations(instanceId);
  const stylusAnnotation = annotations.find((a) => a.annotation_type === 'STYLUS');
  const textAnnotation = annotations.find((a) => a.annotation_type === 'TEXT');

  let strokes = [];
  if (stylusAnnotation?.payload) {
    try { strokes = JSON.parse(stylusAnnotation.payload); } catch (_) { strokes = []; }
  }

  const textComment = textAnnotation?.payload || '';

  if (strokes.length > 0 || textComment) {
    const data = {
      instanceId,
      author: authorEmail,
      savedAt: Date.now(),
      textComment,
      strokes,
    };
    localStorage.setItem(`scde_annotations_${instanceId}`, JSON.stringify(data));
  }
}

export default {
  getAnnotations,
  createAnnotation,
  updateAnnotation,
  syncAnnotations,
  preloadAnnotationsToLocalStorage,
};
