import { beforeEach, expect, it } from 'vitest';
import { mocks } from './mocks.js';
import { db } from '../../lib/mock/db.js';

beforeEach(() => db.reset());
function invoke(method, path, body, user = 'u-admin', params = {}) {
  return mocks.find(m => m.method === method && m.path === path).handler({
    db, user: db.users.find(u => u.id === user), body, params: { subject: 's-mat101', ...params }, query: new URLSearchParams(),
  });
}
const patchPermissions = (member, permissions, user) => invoke('PATCH', '/memberships/:member/permissions/', { permissions }, user, { member });

it('merges permission patches and only null removes existing overrides', () => {
  patchPermissions('m-2', { can_manage_groups: true, can_create_rubric: false });
  patchPermissions('m-2', {});
  expect(db.memberships.find(m => m.id === 'm-2').permission_overrides).toEqual({ can_manage_groups: true, can_create_rubric: false });
  patchPermissions('m-2', { can_manage_groups: null });
  expect(db.memberships.find(m => m.id === 'm-2').permission_overrides).toEqual({ can_create_rubric: false });
  patchPermissions('m-2', { can_create_rubric: null });
  expect(db.memberships.find(m => m.id === 'm-2').permission_overrides).toEqual({});
});

it('rejects student overrides and delegating a permission the grantor lacks', () => {
  const student = db.memberships.find(m => m.subject_id === 's-mat101' && m.role === 'STUDENT');
  expect(() => patchPermissions(student.id, { can_manage_groups: true })).toThrow('STUDENT_PERMS_FIXED');
  patchPermissions('m-2', { can_delegate_perms: true });
  expect(() => patchPermissions('m-1', { can_manage_groups: true }, 'u-javier')).toThrow('DELEGATION_EXCEEDED');
  expect(db.memberships.find(m => m.id === 'm-1').permission_overrides).toEqual({});
  expect(student.permission_overrides).toEqual({});
});

it('rejects duplicate group labels on create and rename without changing records', () => {
  const before = structuredClone(db.groups);
  expect(() => invoke('POST', '/subjects/:subject/groups/', { label: 'Grupo 611' })).toThrow('GROUP_LABEL_EXISTS');
  expect(() => invoke('PATCH', '/subjects/:subject/groups/:group/', { label: 'Grupo 611' }, 'u-admin', { group: 'g-MAT101-b' })).toThrow('GROUP_LABEL_EXISTS');
  expect(db.groups).toEqual(before);
});

it('rejects coordinator assignment and duplicate membership with the real error codes', () => {
  expect(() => invoke('POST', '/subjects/:subject/members/', { user_id: 'u-admin', role: 'COORDINATOR' })).toThrow('VALIDATION_ERROR');
  expect(() => invoke('POST', '/subjects/:subject/members/', { user_id: 'u-javier', role: 'TEACHER' })).toThrow('ALREADY_MEMBER');
});
