import { beforeEach, expect, it } from 'vitest';
import { db } from './db.js';
import { prepareStudentDemo } from './studentDemo.js';
beforeEach(() => db.reset());
it('prepares all Elena exams for a full review without changing another student or staff permissions', () => {
 const others = JSON.stringify(db.instances.filter((i) => i.student_id !== 'u-elena'));
 const memberships = JSON.stringify(db.memberships);
 const now = Date.parse('2026-11-04T12:00:00Z'); prepareStudentDemo(db, now);
 const instances = db.instances.filter((i) => i.student_id === 'u-elena');
 expect(instances).toHaveLength(4);
 for (const inst of instances) {
  expect(inst.status).toBe('IN_REVIEW'); expect(inst.total_score).toBeGreaterThan(0);
  const rv = db.reviews.find((r) => r.exam_id === inst.exam_id);
  expect(Date.parse(rv.start_date)).toBeLessThan(now); expect(Date.parse(rv.end_date)).toBeGreaterThan(now);
  const p = db.exams.find((e) => e.id === inst.exam_id).student_permissions;
  expect(p.can_view_annotations && p.can_view_pages && p.can_view_rubric).toBe(true);
 }
 expect(JSON.stringify(db.instances.filter((i) => i.student_id !== 'u-elena'))).toBe(others);
 expect(JSON.stringify(db.memberships)).toBe(memberships);
});
it('does not create duplicate grades or review windows when applied twice', () => {
 prepareStudentDemo(db); const count = [db.grades.length,db.reviews.length];
 prepareStudentDemo(db); expect([db.grades.length,db.reviews.length]).toEqual(count);
});
