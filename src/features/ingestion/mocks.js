import { db, extendSeed, q } from '../../lib/mock/db.js';
import { mockError, reply } from '../../lib/mock/router.js';
import { hasPerm, instanceOut } from '../exams/mockSerializers.js';
import { mockScanPng } from './mockScan.js';

/* Mirrors apps.instances.views.instances (pages, orphan pages, instance CRUD),
 * apps.instances.services.instance_service (page management) and
 * apps.ingestion.views.ingestion (engines, manual ingest). */

const iso = (d) => new Date(d).toISOString();

/* Scanned pages (ExamPage). One row per expected page of every seeded
 * instance, plus a few real-looking incidents in FIS101 · Parcial 1 and two
 * orphan pages in the organization. Idempotent (runs on load and reset). */
extendSeed((d) => {
  if (d.pages) return;
  const pages = [];
  const add = (instance_id, page_number, extra = {}) =>
    pages.push({
      id: `pg-${instance_id ?? 'orphan'}-${pages.length + 1}`, instance_id, page_number,
      storage_ref: `scans/2026-10/${instance_id ?? 'unassigned'}_p${page_number}.png`,
      status: 'RECOGNIZED', issue_type: '', recognized_at: iso('2026-10-03T09:30:00Z'), created_at: iso('2026-10-03T09:30:00Z'), ...extra,
    });
  d.instances.forEach((inst) => {
    if (inst.id === 'i-e-fis-p1-6') {
      // Student not identified and page 2 never arrived.
      add(inst.id, 1);
      inst.issue_types = ['STUDENT_NOT_IDENTIFIED', 'MISSING_PAGE'];
      inst.has_issues = true;
      return;
    }
    for (let n = 1; n <= inst.expected_pages; n++) add(inst.id, n);
    if (inst.id === 'i-e-fis-p1-5') {
      // A third sheet that the exam does not expect (scrap paper?).
      add(inst.id, 3, { issue_type: 'EXTRA_PAGE' });
      inst.has_issues = true;
    }
  });
  add(null, 1, { status: 'ORPHAN', issue_type: 'ORPHAN_PAGE', created_at: iso('2026-10-03T09:41:00Z') });
  add(null, 1, { status: 'ORPHAN', issue_type: 'QR_READ_ERROR', created_at: iso('2026-10-03T09:44:00Z') });
  d.pages = pages;
});

/** PageResponseSerializer */
/** PageResponseSerializer; image_url is the authenticated PNG route (Bearer), given here to the staff views that list pages. */
export const pageOut = (p) => ({
  id: p.id, instance_id: p.instance_id, page_number: p.page_number, storage_ref: p.storage_ref,
  status: p.status, issue_type: p.issue_type, recognized_at: p.recognized_at, created_at: p.created_at,
  image_url: `/api/v1/pages/${p.id}/image/`,
});

const instOr404 = (id) => {
  const i = q.instance(id);
  if (!i) throw mockError(404, 'NOT_FOUND');
  return i;
};
const subjectOf = (inst) => q.exam(inst.exam_id).subject_id;
const pagesOf = (inst) => db.pages.filter((p) => p.instance_id === inst.id);

/** apps.instances.services.access_control.can_user_grade_instance (approximation). */
function canGrade(user, inst) {
  if (user.is_staff || user.is_superadmin) return true;
  if (q.membership(user.id, subjectOf(inst))?.role === 'COORDINATOR') return true;
  return db.assignment_rules.some((r) => r.exam_id === inst.exam_id && r.correctors.includes(user.id));
}
const canResolve = (user, inst) => hasPerm(user, subjectOf(inst), 'can_resolve_issues');
const requireManager = (user) => {
  if (!user.is_staff && !user.is_superadmin) throw mockError(403, 'PERMISSION_DENIED');
};

/** ExamInstance.recalculate_issues */
function recalcIssues(inst) {
  const pageIssues = pagesOf(inst).some((p) => p.issue_type && p.status !== 'DISCARDED');
  inst.has_issues = inst.issue_types.length > 0 || pageIssues;
  inst.updated_at = new Date().toISOString();
}

/** instance_service.check_assembling_complete */
function checkAssemblingComplete(inst) {
  if (inst.status !== 'ASSEMBLING' || inst.expected_pages <= 0) return;
  const distinct = new Set(pagesOf(inst).filter((p) => p.status !== 'DISCARDED').map((p) => p.page_number));
  if (distinct.size >= inst.expected_pages) inst.status = 'RECEIVED';
}

function pageIn(instanceId, pageId) {
  const p = db.pages.find((x) => x.id === pageId && x.instance_id === instanceId);
  if (!p) throw mockError(404, 'NOT_FOUND');
  return p;
}

/** access_control.can_inspect_page: managers for any page (orphans included), resolvers and graders for their instances. */
const canInspect = (user, page) => {
  if (user.is_staff || user.is_superadmin) return true;
  const inst = page.instance_id && q.instance(page.instance_id);
  return Boolean(inst) && (canResolve(user, inst) || canGrade(user, inst));
};

export const mocks = [
  {
    method: 'GET',
    path: '/pages/:pid/image/',
    handler: ({ params, user }) => {
      const page = db.pages.find((p) => p.id === params.pid);
      if (!page) throw mockError(404, 'NOT_FOUND');
      if (!canInspect(user, page)) throw mockError(403, 'PERMISSION_DENIED');
      const seed = [...page.id].reduce((a, ch) => a + ch.charCodeAt(0), page.page_number);
      return reply(200, new Blob([mockScanPng(seed)], { type: 'image/png' }), { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    },
  },
  {
    method: 'GET',
    path: '/instances/:id/pages/',
    handler: ({ params, user }) => {
      const inst = instOr404(params.id);
      if (!canResolve(user, inst) && !canGrade(user, inst)) throw mockError(403, 'PERMISSION_DENIED');
      return pagesOf(inst).sort((a, b) => a.page_number - b.page_number).map(pageOut);
    },
  },
  {
    method: 'DELETE',
    path: '/instances/:id/pages/:pid/',
    handler: ({ params, user }) => {
      const page = pageIn(params.id, params.pid);
      const inst = q.instance(params.id);
      if (!canResolve(user, inst) && !canGrade(user, inst)) throw mockError(403, 'PERMISSION_DENIED');
      Object.assign(page, { status: 'DISCARDED', issue_type: '' });
      recalcIssues(inst);
      return reply(204);
    },
  },
  {
    method: 'PATCH',
    path: '/instances/:id/pages/:pid/accept/',
    handler: ({ params, user }) => {
      const page = pageIn(params.id, params.pid);
      const inst = q.instance(params.id);
      if (!canResolve(user, inst) && !canGrade(user, inst)) throw mockError(403, 'PERMISSION_DENIED');
      page.issue_type = '';
      recalcIssues(inst);
      return { detail: 'Page accepted.' };
    },
  },
  {
    method: 'POST',
    path: '/instances/:id/pages/:pid/move/',
    handler: ({ params, user, body }) => {
      const page = pageIn(params.id, params.pid);
      const from = q.instance(params.id);
      if (!canResolve(user, from)) throw mockError(403, 'PERMISSION_DENIED');
      if (!body?.target_instance_id) throw mockError(400, 'VALIDATION_ERROR', { target_instance_id: ['This field is required.'] });
      const target = q.instance(body.target_instance_id);
      if (!target) throw mockError(404, 'TARGET_NOT_FOUND');
      if (from.exam_id !== target.exam_id) throw mockError(409, 'DIFFERENT_EXAM');
      Object.assign(page, { instance_id: target.id, page_number: pagesOf(target).length + 1 });
      recalcIssues(from);
      recalcIssues(target);
      checkAssemblingComplete(target);
      return { detail: 'Page moved.' };
    },
  },
  {
    method: 'POST',
    path: '/instances/:id/pages/attach/',
    handler: ({ params, user, body }) => {
      const inst = instOr404(params.id);
      if (!body?.page_id) throw mockError(400, 'VALIDATION_ERROR', { page_id: ['This field is required.'] });
      if (!canResolve(user, inst)) throw mockError(403, 'PERMISSION_DENIED');
      const page = db.pages.find((p) => p.id === body.page_id && !p.instance_id);
      if (!page) throw mockError(404, 'PAGE_NOT_ORPHAN');
      Object.assign(page, { instance_id: inst.id, page_number: pagesOf(inst).length + 1, status: 'RECOGNIZED', issue_type: '' });
      recalcIssues(inst);
      checkAssemblingComplete(inst);
      return { detail: 'Page attached.' };
    },
  },
  {
    method: 'PATCH',
    path: '/instances/:id/pages/reorder/',
    handler: ({ params, user, body }) => {
      const inst = instOr404(params.id);
      if (!canResolve(user, inst) && !canGrade(user, inst)) throw mockError(403, 'PERMISSION_DENIED');
      if (!Array.isArray(body?.page_ids)) throw mockError(400, 'VALIDATION_ERROR', { page_ids: ['This field is required.'] });
      const own = pagesOf(inst);
      body.page_ids.forEach((id, i) => {
        const p = own.find((x) => x.id === id);
        if (p) p.page_number = i + 1;
      });
      recalcIssues(inst);
      return { detail: 'Pages reordered.' };
    },
  },
  {
    method: 'GET',
    path: '/orphan-pages/',
    handler: ({ user }) => {
      requireManager(user);
      return db.pages
        .filter((p) => !p.instance_id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(pageOut);
    },
  },
  {
    method: 'POST',
    path: '/exams/:id/instances/create/',
    handler: ({ params, user, body }) => {
      requireManager(user);
      const exam = q.exam(params.id);
      if (!exam) throw mockError(404, 'NOT_FOUND');
      // Like create_instance: no duplicate check, expected_pages = 0, ASSEMBLING.
      const now = new Date().toISOString();
      const inst = {
        id: db.uid('i'), exam_id: exam.id, student_id: body?.student_id || null, model_id: body?.model_id || null, status: 'ASSEMBLING',
        has_issues: false, issue_types: [], total_score: null, expected_pages: 0, pdf: db.instances[0]?.pdf, created_at: now, updated_at: now,
      };
      db.instances.push(inst);
      return reply(201, instanceOut(inst, user));
    },
  },
  {
    method: 'PATCH',
    path: '/instances/:id/',
    handler: ({ params, user, body }) => {
      const inst = instOr404(params.id);
      if (!canGrade(user, inst)) throw mockError(403, 'PERMISSION_DENIED');
      const data = body ?? {};
      let changed = false;
      if ('student_id' in data && data.student_id !== inst.student_id) {
        if (db.instances.some((i) => i.exam_id === inst.exam_id && i.student_id === data.student_id && i.id !== inst.id)) {
          throw mockError(409, 'DUPLICATE_STUDENT');
        }
        if (!q.user(data.student_id)) throw mockError(409, 'USER_NOT_FOUND');
        inst.student_id = data.student_id;
        inst.issue_types = inst.issue_types.filter((x) => x !== 'STUDENT_NOT_IDENTIFIED' && x !== 'DUPLICATE_STUDENT');
        changed = true;
      }
      if ('model_id' in data && data.model_id !== inst.model_id) {
        const model = db.models.find((m) => m.id === data.model_id && m.exam_id === inst.exam_id);
        if (!model) throw mockError(409, 'MODEL_NOT_FOUND');
        inst.model_id = model.id;
        inst.expected_pages = model.blank_pdf_pages ?? inst.expected_pages;
        changed = true;
      }
      if (changed) recalcIssues(inst);
      return instanceOut(inst, user);
    },
  },
  {
    method: 'DELETE',
    path: '/instances/:id/',
    handler: ({ params, user }) => {
      const inst = instOr404(params.id);
      if (!hasPerm(user, subjectOf(inst), 'can_view_all_instances')) throw mockError(403, 'PERMISSION_DENIED');
      db.instances = db.instances.filter((i) => i.id !== inst.id);
      db.pages = db.pages.filter((p) => p.instance_id !== inst.id);
      db.grades = db.grades.filter((g) => g.instance_id !== inst.id);
      return reply(204);
    },
  },
  {
    method: 'GET',
    path: '/recognition/engines/',
    handler: ({ user }) => {
      requireManager(user);
      return [
        { engine_id: 'easyocr', type: 'OCR_TEXT' },
        { engine_id: 'tesseract', type: 'OCR_TEXT' },
      ];
    },
  },
  {
    method: 'POST',
    path: '/recognition/ingest/',
    handler: ({ user, form }) => {
      requireManager(user);
      const file = form?.get('file');
      if (!file || typeof file === 'string') throw mockError(400, 'VALIDATION_ERROR', { file: ['No file was submitted.'] });
      // The mock cannot split PDFs or decode QR codes: one page per file, left
      // unassigned and pending recognition (it shows up as an orphan page).
      const id = db.uid('pg');
      const storage_ref = `pending/ingestion/${id}_p1.png`;
      db.pages.push({ id, instance_id: null, page_number: 1, storage_ref, status: 'PENDING_RECOGNITION', issue_type: '', recognized_at: null, created_at: new Date().toISOString() });
      return reply(202, {
        task_id: db.uid('task'), filename: file.name, total_pages: 1,
        pages: [{ page_id: id, storage_ref, page_index: 1, status: 'queued' }], status: 'queued',
      });
    },
  },
];
