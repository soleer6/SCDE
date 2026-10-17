/* Mirror of backend apps/subjects/models/permissions.py DEFAULT_PERMISSIONS.
 * Used for UI affordances only (hiding buttons); the backend still enforces.
 * Effective permissions with overrides: GET /memberships/{id}/permissions/. */

export const ROLES = { COORDINATOR: 'COORDINATOR', TEACHER: 'TEACHER', STUDENT: 'STUDENT' };

export const DEFAULT_PERMISSIONS = {
  COORDINATOR: {
    can_create_exams: true, can_assign_correctors: true, can_create_rubric: true, can_resolve_issues: true,
    can_publish_grades: true, can_manage_reviews: true, can_view_all_instances: true, can_export_grades: true,
    can_manage_members: true, can_delegate_perms: true, can_manage_groups: true,
  },
  TEACHER: {
    can_create_exams: false, can_assign_correctors: false, can_create_rubric: true, can_resolve_issues: false,
    can_publish_grades: false, can_manage_reviews: false, can_view_all_instances: true, can_export_grades: false,
    can_manage_members: false, can_delegate_perms: false, can_manage_groups: false,
  },
  STUDENT: {},
};

export const PERMISSION_KEYS = Object.keys(DEFAULT_PERMISSIONS.COORDINATOR);

/** is_staff (org manager) bypasses subject permissions, as in the backend. */
export function can(session, role, perm) {
  if (session?.isStaff || session?.isSuperadmin) return true;
  return Boolean(DEFAULT_PERMISSIONS[role]?.[perm]);
}

export const isTeachingRole = (role) => role === ROLES.COORDINATOR || role === ROLES.TEACHER;
