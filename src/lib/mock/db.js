/* Mock database seed. Internal rows are close to the Django models; the
 * mock handlers (one file per feature) serialise them into the exact
 * OpenAPI response shapes. Persisted in localStorage so mutations survive
 * reloads; call db.reset() (or ?resetMock in the URL) to start over.
 *
 * Features needing extra seed data must NOT edit this file: call
 * `extendSeed(fn)` from their own mocks module instead.
 */

const KEY = 'scde.mockdb.v3';
const ORG = 'org-uam';
const iso = (d) => new Date(d).toISOString();

function seed() {
  const users = [
    { id: 'u-admin', email: 'admin@uam.es', password: 'admin123', first_name: 'Lucía', last_name: 'Gestora', nia: '', is_staff: true, is_superadmin: false },
    { id: 'u-maria', email: 'maria.perez@uam.es', password: 'prof123', first_name: 'María', last_name: 'Pérez', nia: '', is_staff: false, is_superadmin: false },
    { id: 'u-javier', email: 'javier.ruiz@uam.es', password: 'prof123', first_name: 'Javier', last_name: 'Ruiz', nia: '', is_staff: false, is_superadmin: false },
    ...[
      ['elena', 'Elena', 'Rodríguez'], ['pablo', 'Pablo', 'Fernández'], ['irene', 'Irene', 'Martín'],
      ['diego', 'Diego', 'Sanz'], ['nuria', 'Nuria', 'Gil'], ['hugo', 'Hugo', 'Navarro'],
      ['carla', 'Carla', 'Ortega'], ['marcos', 'Marcos', 'Vidal'],
    ].map(([k, f, l], i) => ({
      id: `u-${k}`, email: `${k}.${l.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}@estudiante.uam.es`,
      password: 'est123', first_name: f, last_name: l, nia: `2100${(1234 + i * 37).toString()}`, is_staff: false, is_superadmin: false,
    })),
  ].map((u) => ({ ...u, organization_id: ORG, is_active: true, email_notifications_enabled: true, dni: '', created_at: iso('2026-09-01'), updated_at: iso('2026-09-01') }));

  const students = users.filter((u) => u.email.includes('@estudiante.'));

  const courses = [
    { id: 'c-2627', label: '2026-2027', start_date: '2026-09-01', end_date: '2027-07-31', is_active: true },
    { id: 'c-2526', label: '2025-2026', start_date: '2025-09-01', end_date: '2026-07-31', is_active: false },
  ];

  const subjects = [
    { id: 's-mat101', course_id: 'c-2627', code: 'MAT101', name: 'Cálculo I', semester: '1', coordinator_id: 'u-maria' },
    { id: 's-fis101', course_id: 'c-2627', code: 'FIS101', name: 'Física I', semester: '1', coordinator_id: 'u-javier' },
    { id: 's-prg102', course_id: 'c-2627', code: 'PRG102', name: 'Programación II', semester: '2', coordinator_id: 'u-maria' },
  ];

  const groups = subjects.flatMap((s) => [
    { id: `g-${s.code}-a`, subject_id: s.id, label: 'Grupo 611' },
    { id: `g-${s.code}-b`, subject_id: s.id, label: 'Grupo 612' },
  ]);

  const memberships = [];
  const addM = (user_id, subject_id, role, group_id = null) =>
    memberships.push({ id: `m-${memberships.length + 1}`, user_id, subject_id, role, group_id, is_active: true, permission_overrides: {} });
  addM('u-maria', 's-mat101', 'COORDINATOR');
  addM('u-javier', 's-mat101', 'TEACHER', 'g-MAT101-b');
  addM('u-javier', 's-fis101', 'COORDINATOR');
  addM('u-maria', 's-fis101', 'TEACHER', 'g-FIS101-a');
  addM('u-maria', 's-prg102', 'COORDINATOR');
  students.forEach((st, i) => {
    addM(st.id, 's-mat101', 'STUDENT', i % 2 ? 'g-MAT101-b' : 'g-MAT101-a');
    if (i < 6) addM(st.id, 's-fis101', 'STUDENT', i % 2 ? 'g-FIS101-b' : 'g-FIS101-a');
    if (i < 4) addM(st.id, 's-prg102', 'STUDENT', 'g-PRG102-a');
  });

  const defaultStudentPerms = {
    can_view_pages: true, can_view_pages_after_review: false, can_download_pages: false,
    can_view_annotations: true, can_view_rubric: true, can_view_grade_breakdown: true,
  };
  const exams = [
    { id: 'e-mat-p1', subject_id: 's-mat101', name: 'Parcial 1', date: iso('2026-10-02T09:00:00Z') },
    { id: 'e-mat-p2', subject_id: 's-mat101', name: 'Parcial 2', date: iso('2026-10-14T09:00:00Z') },
    { id: 'e-fis-p1', subject_id: 's-fis101', name: 'Parcial 1', date: iso('2026-10-09T11:00:00Z') },
    { id: 'e-prg-pr1', subject_id: 's-prg102', name: 'Práctica 1', date: iso('2026-10-06T15:00:00Z') },
  ].map((e) => ({ ...e, student_permissions: { ...defaultStudentPerms }, created_at: e.date, updated_at: e.date }));

  const models = exams.map((e) => ({ id: `mdl-${e.id}`, exam_id: e.id, label: 'A', blank_pdf_pages: 2 }));

  const problemDefs = {
    'e-mat-p1': [['Límites', 2.5], ['Derivadas', 3], ['Integrales', 3], ['Teoría', 1.5]],
    'e-mat-p2': [['Series', 4], ['Integral impropia', 3], ['Aplicaciones', 3]],
    'e-fis-p1': [['Cinemática', 3], ['Dinámica', 4], ['Energía', 3]],
    'e-prg-pr1': [['Diseño', 4], ['Implementación', 6]],
  };
  const problems = [];
  const criteria = [];
  Object.entries(problemDefs).forEach(([examId, defs]) => {
    defs.forEach(([name, max], i) => {
      const id = `p-${examId}-${i + 1}`;
      problems.push({ id, exam_model_id: `mdl-${examId}`, name, max_score: max, order: i + 1 });
      if (examId === 'e-mat-p1' || examId === 'e-prg-pr1') {
        [['Planteamiento correcto', 0.4], ['Desarrollo sin errores', 0.4], ['Resultado final', 0.2]].forEach(([d, f], j) =>
          criteria.push({ id: `rc-${id}-${j + 1}`, problem_id: id, description: d, score: +(max * f).toFixed(2), order: j + 1 }),
        );
      }
    });
  });

  const pdfs = ['/mock-pdfs/exam_101.pdf', '/mock-pdfs/exam_102.pdf', '/mock-pdfs/exam_103.pdf'];
  const statusPlan = {
    'e-mat-p1': Array(8).fill('IN_REVIEW'),
    'e-mat-p2': ['GRADED', 'GRADED', 'PENDING_GRADING', 'PENDING_GRADING', 'PENDING_GRADING', 'GRADED', 'PENDING_GRADING', 'QUEUED'],
    'e-fis-p1': ['PENDING_GRADING', 'PENDING_GRADING', 'PENDING_GRADING', 'PENDING_GRADING', 'RECEIVED', 'ASSEMBLING'],
    'e-prg-pr1': ['GRADED', 'GRADED', 'GRADED', 'PENDING_GRADING'],
  };
  const instances = [];
  const grades = [];
  const convocations = [];
  let seedN = 7;
  const rnd = () => ((seedN = (seedN * 9301 + 49297) % 233280) / 233280);
  Object.entries(statusPlan).forEach(([examId, statuses]) => {
    statuses.forEach((status, i) => {
      const st = students[i];
      const id = `i-${examId}-${i + 1}`;
      convocations.push({ exam_id: examId, student_id: st.id });
      const graded = ['GRADED', 'PUBLISHED', 'IN_REVIEW', 'PENDING_REVIEW', 'FINALIZED'].includes(status);
      const examProblems = problems.filter((p) => p.exam_model_id === `mdl-${examId}`);
      let total = null;
      if (graded) {
        examProblems.forEach((p, k) => {
          const score = Math.round(p.max_score * (0.35 + rnd() * 0.65) * 4) / 4;
          grades.push({ id: `gr-${id}-${k}`, instance_id: id, problem_id: p.id, score, grader_id: 'u-maria', rubric_selections: [] });
        });
        total = grades.filter((g) => g.instance_id === id).reduce((a, g) => a + g.score, 0);
      }
      instances.push({
        id, exam_id: examId, student_id: status === 'ASSEMBLING' ? null : st.id, model_id: `mdl-${examId}`, status,
        has_issues: status === 'ASSEMBLING', issue_types: status === 'ASSEMBLING' ? ['STUDENT_NOT_IDENTIFIED'] : [],
        total_score: total, expected_pages: 2, pdf: pdfs[i % pdfs.length],
        created_at: iso('2026-10-03'), updated_at: iso('2026-10-10'),
      });
    });
  });

  const reviews = [
    { id: 'rv-mat-p1', exam_id: 'e-mat-p1', start_date: iso('2026-10-12T08:00:00Z'), end_date: iso('2026-10-24T22:00:00Z'), status: 'OPEN', created_at: iso('2026-10-11') },
  ];
  const review_requests = [
    { id: 'rr-1', instance_id: 'i-e-mat-p1-3', problem_id: 'p-e-mat-p1-2', student_message: 'En el apartado b) creo que el desarrollo es correcto aunque el resultado tenga un error de signo.', resolved: false, resolved_at: null, resolver_message: '', created_at: iso('2026-10-13T10:12:00Z') },
  ];

  const notifications = [
    { id: 'n-1', user_id: 'u-elena', notification_type: 'GRADES_PUBLISHED', title: 'Notas publicadas', message: 'Ya puedes consultar tu nota de Cálculo I · Parcial 1.', status: 'UNREAD', metadata: { exam_id: 'e-mat-p1' }, created_at: iso('2026-10-11T18:00:00Z') },
    { id: 'n-2', user_id: 'u-elena', notification_type: 'REVIEW_OPENED', title: 'Revisión abierta', message: 'El periodo de revisión de Cálculo I · Parcial 1 está abierto hasta el 24/10.', status: 'UNREAD', metadata: { exam_id: 'e-mat-p1' }, created_at: iso('2026-10-12T08:00:00Z') },
    { id: 'n-3', user_id: 'u-maria', notification_type: 'REVIEW_REQUESTS_GROUPED', title: 'Nueva solicitud de revisión', message: 'Tienes 1 solicitud de revisión pendiente en Cálculo I.', status: 'UNREAD', metadata: { exam_id: 'e-mat-p1' }, created_at: iso('2026-10-13T10:12:00Z') },
    { id: 'n-4', user_id: 'u-maria', notification_type: 'ASSIGNMENT_CREATED', title: 'Corrección asignada', message: 'Se te han asignado problemas de Física I · Parcial 1.', status: 'READ', metadata: { exam_id: 'e-fis-p1' }, created_at: iso('2026-10-09T15:00:00Z') },
  ];

  const assignment_rules = [
    { id: 'ar-mat-p2', exam_id: 'e-mat-p2', groups: [], models_filter: [], problems: ['p-e-mat-p2-2', 'p-e-mat-p2-3'], correctors: ['u-javier'], created_at: iso('2026-10-14'), updated_at: iso('2026-10-14') },
    { id: 'ar-1', exam_id: 'e-fis-p1', groups: [], models_filter: [], problems: problems.filter((p) => p.exam_model_id === 'mdl-e-fis-p1').map((p) => p.id), correctors: ['u-maria'], created_at: iso('2026-10-09'), updated_at: iso('2026-10-09') },
  ];

  const org_config = {
    default_ocr_engine: 'tesseract', recognition_confidence_threshold: 0.8, assembly_timeout_seconds: 600,
    max_audio_duration_minutes: 5, max_page_size_mb: 20, auto_delete_frequency_days: 365, delete_notice_days: 30,
    default_language: 'es', temp_url_expiration_minutes: 15, role_permission_defaults: {}, grade_export_columns: ['nia', 'email', 'total_score'],
  };

  return {
    organizations: [{ id: ORG, name: 'Universidad Autónoma de Madrid', subdomain: 'uam', plan: 'PREMIUM', auth_mode: 'JWT', is_active: true }],
    users, courses, subjects, groups, memberships, exams, models, problems, criteria, convocations,
    instances, grades, annotations: [], reviews, review_requests, notifications, assignment_rules, org_config, audit_logs: [],
  };
}

const extenders = [];

function load() {
  try {
    if (typeof location !== 'undefined' && location.search.includes('resetMock')) localStorage.removeItem(KEY);
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* storage unavailable */
  }
  return null;
}

export const db = {
  ...(load() ?? seed()),
  persist() {
    try {
      const { persist: _p, reset: _r, uid: _u, ...data } = this;
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  },
  reset() {
    const fresh = seed();
    Object.keys(fresh).forEach((k) => {
      this[k] = fresh[k];
    });
    extenders.forEach((fn) => fn(this));
    this.persist();
  },
  uid(prefix = 'x') {
    return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  },
};

/** Let a feature add seed rows without editing this file. Idempotent fn expected. */
export function extendSeed(fn) {
  extenders.push(fn);
  fn(db);
}

/* ---- Shared lookups used by several features' handlers ---- */
export const q = {
  user: (id) => db.users.find((u) => u.id === id),
  subject: (id) => db.subjects.find((s) => s.id === id),
  exam: (id) => db.exams.find((e) => e.id === id),
  instance: (id) => db.instances.find((i) => i.id === id),
  activeCourse: () => db.courses.find((c) => c.is_active),
  membership: (userId, subjectId) => db.memberships.find((m) => m.user_id === userId && m.subject_id === subjectId && m.is_active),
};
