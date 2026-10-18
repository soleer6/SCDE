/* Mock handlers for exam authoring and corrector assignment.
 * Mirrors apps.exams.services.exam_service (create/update/delete exam, models,
 * blank PDF, problems, rubric, convocation) and apps.grading.services.grading
 * (assignment rules). Business errors use the backend codes and statuses
 * (ExamServiceError -> 409, INVALID_PDF -> 400; zone errors -> 400). */
import { db, extendSeed, q } from '../../lib/mock/db.js';
import { mockError, reply } from '../../lib/mock/router.js';
import { examOut, hasPerm, problemOut } from './mockSerializers.js';

const now = () => new Date().toISOString();
const exam404 = (id) => q.exam(id) ?? (() => { throw mockError(404, 'NOT_FOUND'); })();
const model404 = (id) => db.models.find((m) => m.id === id) ?? (() => { throw mockError(404, 'NOT_FOUND'); })();
const need = (user, subjectId, perm) => {
  if (!hasPerm(user, subjectId, perm)) throw mockError(403, 'PERMISSION_DENIED');
};
const subjectOfModel = (m) => q.exam(m.exam_id).subject_id;

const A4 = (pages) => Array.from({ length: pages }, (_, i) => ({ page: i + 1, width: 595.28, height: 841.89 }));

/* Page profiles and recognition zones (apps.exams PageProfile/RecognitionZone).
 * Seeded models get A4 page dimensions; MAT101 · Parcial 1 model A has page 1
 * configured with the QR code and the student's name and NIA. Idempotent. */
extendSeed((d) => {
  if (d.page_profiles) return;
  d.models.forEach((m) => {
    if (m.blank_pdf_pages && !m.page_dimensions) m.page_dimensions = A4(m.blank_pdf_pages);
  });
  d.page_profiles = [];
  d.zones = [];
  const m = d.models.find((x) => x.id === 'mdl-e-mat-p1');
  if (!m) return;
  d.page_profiles.push({ id: 'pp-mat-p1-1', exam_model_id: m.id, page_number: 1, page_width: 595.28, page_height: 841.89 });
  d.zones.push(
    { id: 'z-mat-p1-qr', page_profile_id: 'pp-mat-p1-1', zone_type: 'QR', attribute: 'exam_qr', x: 495.28, y: 741.89, width: 80, height: 80 },
    { id: 'z-mat-p1-name', page_profile_id: 'pp-mat-p1-1', zone_type: 'OCR_TEXT', attribute: 'name', x: 59.53, y: 757.7, width: 357.17, height: 33.68 },
    { id: 'z-mat-p1-nia', page_profile_id: 'pp-mat-p1-1', zone_type: 'OCR_NUMBER', attribute: 'nia', x: 59.53, y: 715.61, width: 178.58, height: 33.68 },
  );
});

/** ZoneResponseSerializer */
const zoneOut = (z) => ({ id: z.id, zone_type: z.zone_type, attribute: z.attribute, x: z.x, y: z.y, width: z.width, height: z.height, page_profile_id: z.page_profile_id });
/** PageProfileResponseSerializer */
const profileOut = (p) => ({
  id: p.id,
  page_number: p.page_number,
  page_width: p.page_width,
  page_height: p.page_height,
  zones: db.zones.filter((z) => z.page_profile_id === p.id).map(zoneOut),
});
const profilesOf = (modelId) => db.page_profiles.filter((p) => p.exam_model_id === modelId).sort((a, b) => a.page_number - b.page_number);
const profile404 = (id) => db.page_profiles.find((p) => p.id === id) ?? (() => { throw mockError(404, 'NOT_FOUND'); })();
const zoneError = (code) => mockError(400, code);

/** ModelDetailSerializer */
function modelOut(m) {
  return {
    id: m.id,
    label: m.label,
    exam_id: m.exam_id,
    blank_pdf_ref: m.blank_pdf_ref ?? (m.blank_pdf_pages ? `models/${m.id}/blank.pdf` : ''),
    blank_pdf_pages: m.blank_pdf_pages ?? 0,
    blank_pdf_size: m.blank_pdf_size ?? 0,
    page_dimensions: m.page_dimensions ?? null,
    created_at: m.created_at ?? now(),
    updated_at: m.updated_at ?? now(),
    page_profiles: profilesOf(m.id).map(profileOut),
  };
}

const ruleOut = (r) => ({ ...r });

export const authoringMocks = [
  {
    method: 'POST',
    path: '/subjects/:id/exams/',
    handler: ({ params, user, body, db: d }) => {
      const s = q.subject(params.id);
      if (!s) throw mockError(404, 'NOT_FOUND');
      need(user, s.id, 'can_create_exams');
      if (!body?.name?.trim()) throw mockError(400, 'VALIDATION_ERROR', { name: ['FIELD_REQUIRED'] });
      const e = { id: d.uid('e'), subject_id: s.id, name: body.name.trim(), date: body.date ?? null, created_at: now(), updated_at: now() };
      e.student_permissions = {
        can_view_pages: true, can_view_pages_after_review: false, can_download_pages: false,
        can_view_annotations: true, can_view_rubric: true, can_view_grade_breakdown: true,
      };
      d.exams.push(e);
      return reply(201, examOut(e, user));
    },
  },
  {
    method: 'PATCH',
    path: '/exams/:id/',
    handler: ({ params, user, body }) => {
      const e = exam404(params.id);
      need(user, e.subject_id, 'can_create_exams');
      if (body?.name !== undefined) e.name = body.name;
      if (body?.date !== undefined) e.date = body.date;
      if (body?.student_permissions) e.student_permissions = { ...e.student_permissions, ...body.student_permissions };
      e.updated_at = now();
      return examOut(e, user);
    },
  },
  {
    method: 'DELETE',
    path: '/exams/:id/',
    handler: ({ params, user, db: d }) => {
      const e = exam404(params.id);
      need(user, e.subject_id, 'can_create_exams');
      if (d.instances.some((i) => i.exam_id === e.id)) throw mockError(409, 'HAS_INSTANCES');
      const modelIds = d.models.filter((m) => m.exam_id === e.id).map((m) => m.id);
      const problemIds = d.problems.filter((p) => modelIds.includes(p.exam_model_id)).map((p) => p.id);
      d.criteria = d.criteria.filter((c) => !problemIds.includes(c.problem_id));
      d.problems = d.problems.filter((p) => !problemIds.includes(p.id));
      d.models = d.models.filter((m) => !modelIds.includes(m.id));
      d.convocations = d.convocations.filter((c) => c.exam_id !== e.id);
      d.exams = d.exams.filter((x) => x.id !== e.id);
      return reply(204);
    },
  },
  {
    method: 'POST',
    path: '/exams/:id/models/',
    handler: ({ params, user, body, db: d }) => {
      const e = exam404(params.id);
      need(user, e.subject_id, 'can_create_exams');
      const label = body?.label?.trim();
      if (!label) throw mockError(400, 'VALIDATION_ERROR', { label: ['FIELD_REQUIRED'] });
      if (d.models.some((m) => m.exam_id === e.id && m.label === label)) throw mockError(409, 'MODEL_LABEL_EXISTS');
      const m = { id: d.uid('mdl'), exam_id: e.id, label, blank_pdf_pages: 0, created_at: now(), updated_at: now() };
      if (body.copy_from_id) {
        const src = d.models.find((x) => x.id === body.copy_from_id);
        if (!src) throw mockError(409, 'SOURCE_MODEL_NOT_FOUND');
        d.problems
          .filter((p) => p.exam_model_id === src.id)
          .forEach((p) => {
            const np = { ...p, id: d.uid('p'), exam_model_id: m.id };
            d.problems.push(np);
            d.criteria.filter((c) => c.problem_id === p.id).forEach((c) => d.criteria.push({ ...c, id: d.uid('rc'), problem_id: np.id }));
          });
      }
      d.models.push(m);
      return reply(201, modelOut(m));
    },
  },
  {
    method: 'GET',
    path: '/models/:id/',
    handler: ({ params, user }) => {
      const m = model404(params.id);
      need(user, subjectOfModel(m), 'can_create_exams');
      return modelOut(m);
    },
  },
  {
    method: 'PUT',
    path: '/models/:id/blank-pdf/',
    handler: async ({ params, user, body }) => {
      const m = model404(params.id);
      need(user, subjectOfModel(m), 'can_create_exams');
      const file = body?.file;
      if (!file || typeof file === 'string') throw mockError(400, 'NO_FILE_PROVIDED');
      // FileReader works in browsers and jsdom (jsdom's Blob lacks .text()).
      const head = await new Promise((resolve) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = () => resolve('');
        fr.readAsText(file.slice(0, 5));
      });
      if (head !== '%PDF-') throw mockError(400, 'INVALID_PDF');
      // The real backend parses the PDF (pypdf); the mock cannot, so it records 2 A4 pages.
      Object.assign(m, {
        blank_pdf_ref: `models/${m.id}/blank.pdf`,
        blank_pdf_pages: 2,
        blank_pdf_size: file.size,
        page_dimensions: A4(2),
        updated_at: now(),
      });
      return { blank_pdf_ref: m.blank_pdf_ref, pages: m.blank_pdf_pages, page_dimensions: m.page_dimensions, size_bytes: m.blank_pdf_size };
    },
  },
  {
    method: 'POST',
    path: '/models/:id/qr-pdf/',
    handler: async ({ params, user }) => {
      const m = model404(params.id);
      need(user, subjectOfModel(m), 'can_create_exams');
      if (!m.blank_pdf_pages) throw mockError(409, 'NO_BLANK_PDF');
      const res = await fetch('/mock-pdfs/exam_101.pdf');
      return reply(200, await res.blob(), { 'Content-Type': 'application/pdf' });
    },
  },
  {
    method: 'GET',
    path: '/models/:id/page-profiles/',
    handler: ({ params, user }) => {
      const m = model404(params.id);
      need(user, subjectOfModel(m), 'can_create_exams');
      return profilesOf(m.id).map(profileOut);
    },
  },
  {
    method: 'POST',
    path: '/models/:id/page-profiles/',
    handler: ({ params, user, body, db: d }) => {
      const m = model404(params.id);
      need(user, subjectOfModel(m), 'can_create_exams');
      const n = Number(body?.page_number);
      if (!Number.isInteger(n) || n < 1) throw mockError(400, 'VALIDATION_ERROR', { page_number: ['INVALID'] });
      if (!m.blank_pdf_pages) throw mockError(409, 'NO_BLANK_PDF');
      if (n > m.blank_pdf_pages) throw mockError(409, 'INVALID_PAGE_NUMBER');
      const dim = (m.page_dimensions ?? []).find((x) => x.page === n);
      if (!dim) throw mockError(409, 'MISSING_PAGE_DIMENSIONS');
      if (d.page_profiles.some((p) => p.exam_model_id === m.id && p.page_number === n)) throw mockError(409, 'PAGE_PROFILE_EXISTS');
      const p = { id: d.uid('pp'), exam_model_id: m.id, page_number: n, page_width: dim.width, page_height: dim.height };
      d.page_profiles.push(p);
      return reply(201, profileOut(p));
    },
  },
  {
    method: 'POST',
    path: '/page-profiles/:id/zones/',
    handler: ({ params, user, body, db: d }) => {
      const profile = profile404(params.id);
      need(user, subjectOfModel(model404(profile.exam_model_id)), 'can_create_exams');
      const errors = {};
      ['zone_type', 'attribute', 'x', 'y', 'width', 'height'].forEach((k) => {
        if (body?.[k] === undefined || body[k] === '') errors[k] = ['FIELD_REQUIRED'];
      });
      if (body?.zone_type && !['OCR_TEXT', 'OCR_NUMBER', 'QR', 'CHECKBOX'].includes(body.zone_type)) errors.zone_type = ['INVALID_CHOICE'];
      ['width', 'height'].forEach((k) => {
        if (!errors[k] && Number(body[k]) < 0.1) errors[k] = ['MIN_VALUE'];
      });
      if (Object.keys(errors).length) throw mockError(400, 'VALIDATION_ERROR', errors);
      const [x, y, width, height] = ['x', 'y', 'width', 'height'].map((k) => Number(body[k]));
      // create_zone: page_numbers replaces the URL's profile; all-or-nothing.
      const siblings = profilesOf(profile.exam_model_id);
      const targets = body.page_numbers?.length
        ? body.page_numbers.map((n) => siblings.find((p) => p.page_number === n) ?? (() => { throw zoneError('INVALID_PAGE_NUMBER'); })())
        : [profile];
      if (x < 0 || y < 0) throw zoneError('INVALID_COORDINATES');
      targets.forEach((p) => {
        if (p.page_width > 0 && x + width > p.page_width + 1) throw zoneError('ZONE_EXCEEDS_PAGE_WIDTH');
        if (p.page_height > 0 && y + height > p.page_height + 1) throw zoneError('ZONE_EXCEEDS_PAGE_HEIGHT');
      });
      const attribute = body.zone_type === 'QR' ? 'exam_qr' : body.attribute;
      const created = targets.map((p) => ({ id: d.uid('z'), page_profile_id: p.id, zone_type: body.zone_type, attribute, x, y, width, height }));
      d.zones.push(...created);
      // The Django view serialises many=True (a list), unlike the OpenAPI schema.
      return reply(201, created.map(zoneOut));
    },
  },
  {
    method: 'DELETE',
    path: '/zones/:id/',
    handler: ({ params, user, db: d }) => {
      const z = d.zones.find((x) => x.id === params.id);
      if (!z) throw mockError(404, 'NOT_FOUND');
      need(user, subjectOfModel(model404(profile404(z.page_profile_id).exam_model_id)), 'can_create_exams');
      d.zones = d.zones.filter((x) => x.id !== z.id);
      return reply(204);
    },
  },
  {
    method: 'POST',
    path: '/models/:id/problems/',
    handler: ({ params, user, body, db: d }) => {
      const m = model404(params.id);
      need(user, subjectOfModel(m), 'can_create_rubric');
      const errors = {};
      if (!body?.name?.trim()) errors.name = ['FIELD_REQUIRED'];
      const max = Number(body?.max_score);
      if (body?.max_score === undefined || Number.isNaN(max) || max <= 0) errors.max_score = ['INVALID'];
      if (Object.keys(errors).length) throw mockError(400, 'VALIDATION_ERROR', errors);
      const order = Number(body.order ?? d.problems.filter((p) => p.exam_model_id === m.id).length + 1);
      const p = { id: d.uid('p'), exam_model_id: m.id, name: body.name.trim(), max_score: max, order };
      d.problems.push(p);
      return reply(201, problemOut(p));
    },
  },
  {
    method: 'POST',
    path: '/problems/:id/rubric/',
    handler: ({ params, user, body, db: d }) => {
      const p = d.problems.find((x) => x.id === params.id);
      if (!p) throw mockError(404, 'NOT_FOUND');
      need(user, subjectOfModel(model404(p.exam_model_id)), 'can_create_rubric');
      const criteria = body?.criteria;
      if (!Array.isArray(criteria)) throw mockError(400, 'VALIDATION_ERROR', { criteria: ['FIELD_REQUIRED'] });
      d.criteria = d.criteria.filter((c) => c.problem_id !== p.id);
      const created = criteria.map((c, i) => ({ id: d.uid('rc'), problem_id: p.id, description: c.description, score: Number(c.score), order: i }));
      d.criteria.push(...created);
      return reply(201, created.map((c) => ({ id: c.id, description: c.description, score: c.score.toFixed(2), order: c.order })));
    },
  },
  {
    method: 'PUT',
    path: '/exams/:id/convocation/',
    handler: ({ params, user, body, db: d }) => {
      const e = exam404(params.id);
      need(user, e.subject_id, 'can_manage_members');
      const ids = body?.student_ids ?? [];
      const invalid = [];
      const valid = [];
      ids.forEach((id) => {
        const m = q.membership(id, e.subject_id);
        if (!m || m.role !== 'STUDENT') invalid.push({ user_id: id, reason: 'NOT_ACTIVE_STUDENT' });
        else if (!m.group_id) invalid.push({ user_id: id, reason: 'NO_GROUP_ASSIGNED' });
        else valid.push(id);
      });
      d.convocations = d.convocations.filter((c) => c.exam_id !== e.id).concat(valid.map((student_id) => ({ exam_id: e.id, student_id })));
      return { total: ids.length, valid: valid.length, invalid };
    },
  },
  {
    method: 'GET',
    path: '/exams/:id/assignment-rules/',
    handler: ({ params, user }) => {
      const e = exam404(params.id);
      need(user, e.subject_id, 'can_assign_correctors');
      return db.assignment_rules.filter((r) => r.exam_id === e.id).map(ruleOut);
    },
  },
  {
    method: 'POST',
    path: '/exams/:id/assignment-rules/',
    handler: ({ params, user, body, db: d }) => {
      const e = exam404(params.id);
      need(user, e.subject_id, 'can_assign_correctors');
      const errors = {};
      if (!body?.problems?.length) errors.problems = ['FIELD_REQUIRED'];
      if (!body?.correctors?.length) errors.correctors = ['FIELD_REQUIRED'];
      if (Object.keys(errors).length) throw mockError(400, 'VALIDATION_ERROR', errors);
      const r = { id: d.uid('ar'), exam_id: e.id, groups: body.groups ?? [], models_filter: body.models_filter ?? [], problems: body.problems, correctors: body.correctors, created_at: now(), updated_at: now() };
      d.assignment_rules.push(r);
      return reply(201, ruleOut(r));
    },
  },
  {
    method: 'DELETE',
    path: '/assignment-rules/:id/',
    handler: ({ params, user, db: d }) => {
      const r = d.assignment_rules.find((x) => x.id === params.id);
      if (!r) throw mockError(404, 'NOT_FOUND');
      need(user, q.exam(r.exam_id).subject_id, 'can_assign_correctors');
      d.assignment_rules = d.assignment_rules.filter((x) => x.id !== r.id);
      return reply(204);
    },
  },
];
