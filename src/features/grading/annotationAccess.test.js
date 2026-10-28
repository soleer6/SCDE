import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, q } from '../../lib/mock/db.js';
import { mocks } from './mocks.js';

const read = mocks.find((h) => h.method === 'GET' && h.path === '/instances/:id/annotations/').handler;
const id = 'i-e-mat-p1-1';
let inst, exam, review, member, user;
beforeEach(() => {
  db.reset();
  inst = q.instance(id);
  exam = q.exam(inst.exam_id);
  review = db.reviews.find((r) => r.exam_id === exam.id);
  Object.assign(review, { start_date: new Date(Date.now() - 60000).toISOString(), end_date: new Date(Date.now() + 60000).toISOString() });
  user = q.user(inst.student_id);
  member = q.membership(user.id, exam.subject_id);
  q.membership('u-javier', exam.subject_id).permission_overrides.can_view_all_instances = false;
  db.annotations.push({ id: 'ink', instance_id: id, annotation_type: 'AUDIO', audio: new Blob(['synthetic']) });
});

describe('annotation read authorization (#20)', () => {
  it.each([
    ['another student', () => { user = q.user('u-pablo'); }],
    ['inactive membership', () => { member.is_active = false; }],
    ['wrong subject membership', () => { member.subject_id = 's-fis101'; }],
    ['wrong tenant membership', () => { member.organization_id = 'foreign'; }],
    ['missing membership', () => { db.memberships = db.memberships.filter((m) => m !== member); }],
    ['annotations revoked', () => { exam.student_permissions.can_view_annotations = false; }],
    ['annotations absent', () => { delete exam.student_permissions.can_view_annotations; }],
    ['unpublished instance', () => { inst.status = 'GRADED'; }],
    ['OPEN requires IN_REVIEW', () => { inst.status = 'PUBLISHED'; }],
    ['OPEN starts later', () => { review.start_date = new Date(Date.now() + 10000).toISOString(); }],
    ['OPEN already ended', () => { review.end_date = new Date(Date.now() - 1).toISOString(); }],
    ['OPEN missing date', () => { delete review.start_date; }],
    ['no review', () => { db.reviews = []; }],
    ['scheduled', () => { review.status = 'SCHEDULED'; }],
    ['closed without after-review permission', () => { review.status = 'CLOSED'; }],
    ['completed without after-review permission', () => { review.status = 'COMPLETED'; }],
    ['closed but annotations revoked', () => { review.status = 'CLOSED'; exam.student_permissions.can_view_pages_after_review = true; exam.student_permissions.can_view_annotations = false; }],
    ['teacher without assignment', () => { user = q.user('u-javier'); }],
    ['teacher inactive with assignment', () => { user = q.user('u-javier'); q.membership(user.id, exam.subject_id).is_active = false; db.assignment_rules.push({ exam_id: exam.id, correctors: [user.id] }); }],
    ['teacher wrong model', () => { user = q.user('u-javier'); db.assignment_rules.push({ exam_id: exam.id, correctors: [user.id], models_filter: ['other'] }); }],
    ['teacher wrong group', () => { user = q.user('u-javier'); db.assignment_rules.push({ exam_id: exam.id, correctors: [user.id], groups: ['other'] }); }],
  ])('rejects %s before issuing any URL', (_, setup) => {
    setup();
    const url = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: url });
    try {
      expect(() => read({ params: { id }, user })).toThrow('PERMISSION_DENIED');
      try { read({ params: { id }, user }); } catch (e) { expect(e.__mock).toMatchObject({ status: 403, body: { error_code: 'PERMISSION_DENIED' } }); }
      expect(url).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });

  it.each(['student', 'teacher', 'manager', 'superadmin'])('returns 404 for another tenant (%s)', (role) => {
    user = { ...user, organization_id: 'foreign', is_staff: role === 'manager', is_superadmin: role === 'superadmin' };
    expect(() => read({ params: { id }, user })).toThrow('NOT_FOUND');
  });

  it('returns 404 for a missing instance', () => {
    expect(() => read({ params: { id: 'missing' }, user })).toThrow('NOT_FOUND');
  });

  it('applies combined filters after authorization, preserving other authors by default', () => {
    db.annotations = [
      { id: 'a', instance_id: id, author_id: 'one', annotation_type: 'TEXT', page_number: 1, problem_id: 'p', content: 'a' },
      { id: 'b', instance_id: id, author_id: 'two', annotation_type: 'TEXT', page_number: 1, problem_id: 'p', content: 'b' },
      { id: 'c', instance_id: id, author_id: 'one', annotation_type: 'TEXT', page_number: 2, problem_id: 'p', content: 'c' },
    ];
    expect(read({ params: { id }, user })).toHaveLength(3);
    const query = new URLSearchParams({ author_id: 'one', page_number: '1', annotation_type: 'TEXT', problem_id: 'p' });
    expect(read({ params: { id }, user, query }).map((a) => a.id)).toEqual(['a']);
    exam.student_permissions.can_view_annotations = false;
    query.set('author_id', 'absent');
    expect(() => read({ params: { id }, user, query })).toThrow('PERMISSION_DENIED');
  });

  it.each(['OPEN', 'CLOSED', 'COMPLETED'])('allows owner in %s and keeps every author', (status) => {
    review.status = status;
    exam.student_permissions.can_view_pages_after_review = true;
    db.annotations = ['one', 'two'].map((author_id) => ({ id: author_id, instance_id: id, author_id, annotation_type: 'TEXT', content: author_id }));
    expect(read({ params: { id }, user }).map((a) => a.author_id)).toEqual(['one', 'two']);
  });

  it.each(['coordinator', 'staff', 'superadmin', 'assigned', 'effective override', 'null override'])('allows %s in the same tenant', (role) => {
    user = q.user(role === 'coordinator' ? 'u-maria' : role === 'staff' ? 'u-admin' : 'u-javier');
    if (role === 'superadmin') user.is_superadmin = true;
    if (role === 'assigned') db.assignment_rules.push({ exam_id: exam.id, correctors: [user.id], models_filter: [inst.model_id], groups: [member.group_id] });
    if (role === 'effective override') q.membership(user.id, exam.subject_id).permission_overrides.can_view_all_instances = true;
    if (role === 'null override') {
      // RF15.5: null restores the original true base despite later global false.
      db.org_config.role_permission_defaults = { TEACHER: { can_view_all_instances: false } };
      q.membership(user.id, exam.subject_id).permission_overrides.can_view_all_instances = null;
    }
    expect(read({ params: { id }, user })).toHaveLength(1);
  });
});
