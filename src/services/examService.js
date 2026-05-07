import { apiGet } from './apiClient.js';

const USE_MOCK = import.meta.env.VITE_MOCK_API === 'true';

const MOCK_EXAMS = {
  'mock-sub-1': [
    { id: 'mock-exam-1', name: 'Parcial 1', subject_id: 'mock-sub-1', status: 'CORRECTED', created_at: '2025-03-10T09:00:00Z' },
    { id: 'mock-exam-2', name: 'Parcial 2', subject_id: 'mock-sub-1', status: 'PENDING', created_at: '2025-05-20T09:00:00Z' },
  ],
  'mock-sub-2': [
    { id: 'mock-exam-3', name: 'Parcial 1 Física', subject_id: 'mock-sub-2', status: 'CORRECTED', created_at: '2025-03-12T10:00:00Z' },
  ],
};

/**
 * Returns the exams for a given subject.
 * Real API: GET /api/v1/subjects/{subjectId}/exams/
 * Returns: [{ id, name, subject_id, student_permissions, model_count, convocation_count, created_at }]
 */
export async function getExamsBySubject(subjectId) {
  if (USE_MOCK) {
    return MOCK_EXAMS[subjectId] ?? [];
  }
  const result = await apiGet(`/subjects/${subjectId}/exams/`);
  return Array.isArray(result) ? result : (result.results ?? []);
}

export default { getExamsBySubject };
