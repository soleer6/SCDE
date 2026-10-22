/* listSubjectMembers against the real Django: the declared `?role=` filter
 * (gap-12) returns only that role and the union covers what an unfiltered
 * walk of every page returns. Read-only. */
import { beforeAll, expect, it } from 'vitest';
import { USE_MOCK } from '../../../lib/api/client.js';
import { listSubjectMembers } from '../api.js';
import { loadFixture, otherSession, signIn } from '../../grading/real-backend/session.js';

let fx;
let subjectId;
let manager;
beforeAll(async () => {
  expect(USE_MOCK).toBe(false);
  fx = await loadFixture();
  manager = await otherSession(fx, 'manager');
  subjectId = (await manager.get(`/exams/${fx.examId}/`)).data.subject_id;
  expect(subjectId).toBeTruthy();
});

it('filters members by role on the server and loses nobody', async () => {
  await signIn(fx, 'manager');
  const raw = await manager.get(`/subjects/${subjectId}/members/?role=STUDENT&page_size=100`);
  expect(raw.status).toBe(200);
  expect(raw.data.results.every((m) => m.role === 'STUDENT')).toBe(true);

  const all = [];
  for (let page = 1; ; page++) {
    const res = await manager.get(`/subjects/${subjectId}/members/?page_size=100&page=${page}`);
    all.push(...res.data.results);
    if (page >= res.data.total_pages) break;
  }
  const roles = ['COORDINATOR', 'TEACHER', 'STUDENT'];
  const listed = await listSubjectMembers(subjectId, roles);
  expect(listed.map((m) => m.id).sort()).toEqual(all.filter((m) => roles.includes(m.role)).map((m) => m.id).sort());
  const students = await listSubjectMembers(subjectId, ['STUDENT']);
  expect(students.length).toBeGreaterThan(0);
  expect(students.every((m) => m.role === 'STUDENT')).toBe(true);
});
