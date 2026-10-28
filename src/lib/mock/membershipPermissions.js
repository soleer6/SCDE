import { DEFAULT_PERMISSIONS, PERMISSION_KEYS, ROLES } from '../permissions.js';

/** Internal mock equivalent of SubjectMembership.save / RF-15.5 migration.
 * Freeze every role, including inactive memberships, without changing overrides.
 * The snapshot is internal storage only and must never be spread into HTTP data.
 */
export function captureMembershipPermissions(db, membership) {
  if (!membership) return;
  const previous = membership.role_permission_snapshot;
  if (Object.values(ROLES).every((role) => PERMISSION_KEYS.every((key) =>
    typeof previous?.[role]?.[key] === 'boolean'))) return previous;

  const configured = db.org_config?.role_permission_defaults;
  membership.role_permission_snapshot = Object.fromEntries(Object.values(ROLES).map((role) => [role,
    Object.fromEntries(PERMISSION_KEYS.map((key) => {
      const fixed = previous?.[role]?.[key];
      const custom = configured?.[role]?.[key];
      return [key, typeof fixed === 'boolean' ? fixed
        : typeof custom === 'boolean' ? custom : DEFAULT_PERMISSIONS[role]?.[key] === true];
    })),
  ]));
  return membership.role_permission_snapshot;
}

/** Complete boolean permissions, with null restoring the membership's fixed base. */
export function effectiveMembershipPermissions(db, membership) {
  const snapshot = captureMembershipPermissions(db, membership);
  return Object.fromEntries(PERMISSION_KEYS.map((key) => {
    const override = membership?.permission_overrides?.[key];
    return [key, typeof override === 'boolean' ? override
      : snapshot?.[membership?.role]?.[key] === true];
  }));
}
