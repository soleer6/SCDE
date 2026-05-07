// Centralized mock data for development

export const MOCK_EXAMS = {
    'mock-sub-1': [
        { id: 'mock-exam-1', name: 'Parcial 1', subject_id: 'mock-sub-1', status: 'CORRECTED', created_at: '2025-02-15T09:00:00Z' },
        { id: 'mock-exam-2', name: 'Parcial 2', subject_id: 'mock-sub-1', status: 'PENDING', created_at: '2025-03-20T09:00:00Z' },
    ],
    'mock-sub-2': [
        { id: 'mock-exam-3', name: 'Parcial 1', subject_id: 'mock-sub-2', status: 'CORRECTED', created_at: '2025-02-20T11:00:00Z' },
    ],
};

export const MOCK_INSTANCES = {
    'mock-exam-1': [
        { id: 'mock-inst-1', firstName: 'Elena', lastName: 'Rodríguez López', email: 'elena.r@estudiante.uni.es', nia: '100401', status: 'CORRECTED', grade: 7.5, pdfUrl: '/mock-pdfs/exam_101.pdf' },
        { id: 'mock-inst-2', firstName: 'Pablo', lastName: 'Fernández García', email: 'pablo.f@estudiante.uni.es', nia: '100402', status: 'CORRECTED', grade: 6.0, pdfUrl: '/mock-pdfs/exam_102.pdf' },
    ],
    'mock-exam-2': [
        { id: 'mock-inst-3', firstName: 'Elena', lastName: 'Rodríguez López', email: 'elena.r@estudiante.uni.es', nia: '100401', status: 'PENDING', grade: null, pdfUrl: '/mock-pdfs/exam_103.pdf' },
    ],
    'mock-exam-3': [],
};

/**
 * Returns exams for a given subject id, or [] if unknown.
 * @param {string} subjectId
 * @returns {Array}
 */
export function getExamsBySubject(subjectId) {
    return MOCK_EXAMS[subjectId] ?? [];
}

/**
 * Returns instances for a given exam id, or [] if unknown.
 * @param {string} examId
 * @returns {Array}
 */
export function getInstancesByExam(examId) {
    return MOCK_INSTANCES[examId] ?? [];
}

/**
 * Returns a single exam by id across all subjects.
 * @param {string} examId
 * @returns {object|undefined}
 */
export function getExamById(examId) {
    for (const exams of Object.values(MOCK_EXAMS)) {
        const found = exams.find((e) => e.id === examId);
        if (found) return found;
    }
    return undefined;
}

/**
 * Returns a single instance by id across all exams.
 * @param {string} instanceId
 * @returns {object|undefined}
 */
export function getMockInstanceById(instanceId) {
    for (const instances of Object.values(MOCK_INSTANCES)) {
        const found = instances.find((i) => i.id === instanceId);
        if (found) return found;
    }
    return undefined;
}

// Status display metadata keyed by status string
export const STATUS_META = {
    PENDING: { label: 'Pendiente', color: '#6b7a99', bg: '#f0f2f8' },
    CORRECTED: { label: 'Corregido', color: '#16a34a', bg: '#dcfce7' },
    REVIEW_REQUESTED: { label: 'Revisión pedida', color: '#d97706', bg: '#fef3c7' },
    CLOSED: { label: 'Cerrado', color: '#0070d2', bg: '#dbeafe' },
};

export function getStatusMeta(status) {
    return STATUS_META[status] ?? STATUS_META.PENDING;
}

// ---------------------------------------------------------------------------
// LocalStorage corrections overlay
// These functions mirror what the grading API will provide.
// ---------------------------------------------------------------------------

export function getStoredCorrection(instanceId) {
    try {
        const raw = localStorage.getItem(`scde_correction_${instanceId}`);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function saveStoredCorrection(instanceId, { grade, status }) {
    localStorage.setItem(
        `scde_correction_${instanceId}`,
        JSON.stringify({ grade, status, savedAt: Date.now() }),
    );
}
