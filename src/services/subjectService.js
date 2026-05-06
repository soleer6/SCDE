import { apiGet } from './apiClient.js';

const USE_MOCK = import.meta.env.VITE_MOCK_API === 'true';

// Mock subjects — only used when VITE_MOCK_API=true
const MOCK_SUBJECTS = [
  { id: 'mock-sub-1', code: 'MAT101', name: 'Matemáticas I', semester: '1' },
  { id: 'mock-sub-2', code: 'FIS101', name: 'Física I', semester: '1' },
];

/**
 * Returns the subjects the authenticated professor belongs to.
 * Real API: GET /api/v1/my-subjects/
 * Returns: [{ id, code, name, semester, course_id, coordinator_id, ... }]
 *
 * NOTE: requires an active AcademicCourse in the DB — if none exists, returns [].
 */
export async function getMySubjects() {
  if (USE_MOCK) {
    return MOCK_SUBJECTS;
  }
  const result = await apiGet('/my-subjects/');
  return Array.isArray(result) ? result : (result.results ?? []);
}

export default { getMySubjects };
