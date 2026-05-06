import { apiGet, apiRequest } from './apiClient.js';

const USE_MOCK = import.meta.env.VITE_MOCK_API === 'true';

const MOCK_INSTANCES = {
  'mock-exam-1': [
    { id: 'mock-inst-1', exam_id: 'mock-exam-1', student_email: 'elena.r@estudiante.uni.es', status: 'PENDING_GRADING', total_score: null },
    { id: 'mock-inst-2', exam_id: 'mock-exam-1', student_email: 'pablo.f@estudiante.uni.es', status: 'GRADED', total_score: 7.5 },
  ],
  'mock-exam-2': [],
  'mock-exam-3': [],
};

/**
 * Maps backend instance status to the frontend display status.
 * Backend uses a fine-grained state machine; frontend shows simplified 4-state model.
 */
export function mapInstanceStatus(backendStatus) {
  switch (backendStatus) {
    case 'ASSEMBLING':
    case 'RECEIVED':
    case 'QUEUED':
    case 'PENDING_GRADING':
      return 'PENDING';
    case 'GRADED':
    case 'PUBLISHED':
      return 'CORRECTED';
    case 'IN_REVIEW':
    case 'PENDING_REVIEW':
      return 'REVIEW_REQUESTED';
    case 'FINALIZED':
      return 'CLOSED';
    default:
      return 'PENDING';
  }
}

/**
 * Returns backend status value from the simplified frontend status.
 */
export function toBackendStatus(frontendStatus) {
  switch (frontendStatus) {
    case 'CORRECTED': return 'GRADED';
    case 'PENDING': return 'PENDING_GRADING';
    default: return 'PENDING_GRADING';
  }
}

/**
 * Normalizes a backend instance object to the shape expected by the UI.
 * Backend: { id, student_email, status, total_score, ... }
 * Frontend: { id, firstName, lastName, nia, status, grade }
 */
export function normalizeInstance(inst) {
  const emailLocal = (inst.student_email || '').split('@')[0];
  const parts = emailLocal.split('.');
  return {
    id: inst.id,
    examId: inst.exam_id,
    firstName: parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : '—',
    lastName: parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : '',
    nia: inst.student_email || '—',
    email: inst.student_email,
    status: mapInstanceStatus(inst.status),
    backendStatus: inst.status,
    grade: inst.total_score != null ? parseFloat(inst.total_score) : null,
    pdfUrl: null, // loaded separately via downloadInstancePdf
    hasIssues: inst.has_issues,
  };
}

/**
 * Returns the list of instances for an exam.
 * Real API: GET /api/v1/exams/{examId}/instances/
 */
export async function getInstancesByExam(examId) {
  if (USE_MOCK) {
    return (MOCK_INSTANCES[examId] ?? []).map(normalizeInstance);
  }
  const result = await apiGet(`/exams/${examId}/instances/`);
  const items = Array.isArray(result) ? result : (result.results ?? []);
  return items.map(normalizeInstance);
}

/**
 * Returns a single instance by ID.
 * Real API: GET /api/v1/instances/{instanceId}/
 */
export async function getInstance(instanceId) {
  if (USE_MOCK) {
    for (const list of Object.values(MOCK_INSTANCES)) {
      const found = list.find((i) => i.id === instanceId);
      if (found) return normalizeInstance(found);
    }
    return null;
  }
  const inst = await apiGet(`/instances/${instanceId}/`);
  return normalizeInstance(inst);
}

/**
 * Fetches the PDF for an instance and returns a Blob URL.
 * Real API: GET /api/v1/instances/{instanceId}/download/
 * The URL must be revoked with URL.revokeObjectURL() when no longer needed.
 */
export async function downloadInstancePdf(instanceId) {
  if (USE_MOCK) {
    return null;
  }
  const token = localStorage.getItem('scde_token');
  const response = await fetch(
    `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/instances/${instanceId}/download/`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} }
  );
  if (!response.ok) throw new Error('PDF download failed');
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

/**
 * Transitions an instance to a new status.
 * Real API: PATCH /api/v1/instances/{instanceId}/transition/
 * backendStatus: one of the InstanceStatus values (e.g. 'GRADED', 'PENDING_GRADING')
 */
export async function transitionInstance(instanceId, backendStatus) {
  if (USE_MOCK) return;
  return apiRequest(`/instances/${instanceId}/transition/`, {
    method: 'PATCH',
    body: JSON.stringify({ target_status: backendStatus }),
  });
}

export default {
  getInstancesByExam,
  getInstance,
  downloadInstancePdf,
  transitionInstance,
  normalizeInstance,
  mapInstanceStatus,
  toBackendStatus,
};
