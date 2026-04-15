// Centralized mock data for development

export const MOCK_EXAMS = {
    MAT101: [
        { id: 1, name: 'Parcial 1', date: '2025-02-15', time: '09:00', status: 'CORRECTED' },
        { id: 2, name: 'Parcial 2', date: '2025-03-20', time: '09:00', status: 'PENDING' },
    ],
    FIS101: [
        { id: 3, name: 'Parcial 1', date: '2025-02-20', time: '11:00', status: 'CORRECTED' },
    ],
};

export const MOCK_INSTANCES = {
    1: [
        { id: 101, firstName: 'Elena', lastName: 'Rodríguez López', nia: '100401', status: 'CORRECTED', grade: 7.5, pdfUrl: '/mock-pdfs/exam_101.pdf' },
        { id: 102, firstName: 'Pablo', lastName: 'Fernández García', nia: '100402', status: 'CORRECTED', grade: 6.0, pdfUrl: '/mock-pdfs/exam_102.pdf' },
        { id: 103, firstName: 'Sofía', lastName: 'Jiménez Ruiz', nia: '100403', status: 'PENDING', grade: null, pdfUrl: '/mock-pdfs/exam_103.pdf' },
    ],
    2: [],
    3: [],
};

/**
 * Returns exams for a given subject code, or [] if unknown.
 * @param {string} code
 * @returns {Array}
 */
export function getExamsBySubject(code) {
    return MOCK_EXAMS[code] ?? [];
}

/**
 * Returns instances for a given exam id, or [] if unknown.
 * @param {number|string} examId
 * @returns {Array}
 */
export function getInstancesByExam(examId) {
    return MOCK_INSTANCES[Number(examId)] ?? [];
}

/**
 * Returns a single exam by id across all subjects.
 * @param {number|string} examId
 * @returns {object|undefined}
 */
export function getExamById(examId) {
    const id = Number(examId);
    for (const exams of Object.values(MOCK_EXAMS)) {
        const found = exams.find((e) => e.id === id);
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
