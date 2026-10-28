import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSION_KEYS, ROLES } from '../permissions.js';
import { captureMembershipPermissions, effectiveMembershipPermissions } from './membershipPermissions.js';

const KEY = 'scde.mockdb.v3';
const membership = (extra = {}) => ({
  id: 'm-fixed', role: 'TEACHER', is_active: true, permission_overrides: {}, ...extra,
});
const configuredDb = () => ({ org_config: { role_permission_defaults: {
  COORDINATOR: { can_create_exams: false }, TEACHER: { can_create_exams: true },
  STUDENT: { can_view_all_instances: true },
} } });

describe('RF15.5 internal membership snapshots', () => {
  it('freezes all roles, including student, and uses fixed destination roles on promotion/demotion', () => {
    const data = configuredDb();
    const row = membership();
    captureMembershipPermissions(data, row);
    const fixed = structuredClone(row.role_permission_snapshot);
    for (const role of Object.values(ROLES)) {
      expect(Object.keys(fixed[role]).sort()).toEqual([...PERMISSION_KEYS].sort());
      expect(Object.values(fixed[role]).every((value) => typeof value === 'boolean')).toBe(true);
    }
    data.org_config.role_permission_defaults = {};
    for (const role of Object.values(ROLES)) {
      row.role = role;
      expect(effectiveMembershipPermissions(data, row)).toEqual(fixed[role]);
    }
    expect(row.role_permission_snapshot).toEqual(fixed);
    const fresh = membership();
    expect(effectiveMembershipPermissions(data, fresh).can_create_exams).toBe(false);
  });

  it('keeps inactive membership bases and overrides across reactivation; null restores fixed base', () => {
    const data = configuredDb();
    const row = membership({ is_active: false, permission_overrides: { can_create_exams: false } });
    captureMembershipPermissions(data, row);
    data.org_config.role_permission_defaults.TEACHER.can_create_exams = false;
    row.is_active = true;
    expect(effectiveMembershipPermissions(data, row).can_create_exams).toBe(false);
    row.permission_overrides.can_create_exams = true;
    expect(effectiveMembershipPermissions(data, row).can_create_exams).toBe(true);
    row.permission_overrides.can_create_exams = null;
    expect(effectiveMembershipPermissions(data, row).can_create_exams).toBe(true);
    expect(row.permission_overrides).toEqual({ can_create_exams: null });
  });

  it('accepts only boolean known permissions, matching backend snapshot and override resolution', () => {
    const data = configuredDb();
    data.org_config.role_permission_defaults.TEACHER = { can_create_exams: 'yes', unknown: true };
    const row = membership({ permission_overrides: { can_create_exams: 1, unknown: true } });
    expect(effectiveMembershipPermissions(data, row).can_create_exams).toBe(false);
    expect(effectiveMembershipPermissions(data, row)).not.toHaveProperty('unknown');
    expect(row.permission_overrides).toEqual({ can_create_exams: 1, unknown: true });
  });
});

describe('mock database snapshot persistence', () => {
  let saved;
  beforeEach(() => {
    saved = localStorage.getItem(KEY);
    localStorage.removeItem(KEY);
    vi.resetModules();
  });
  afterEach(() => {
    if (saved === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, saved);
    vi.resetModules();
  });

  it('migrates legacy storage once, preserving all data, overrides, effective grants and inactive state after reload', async () => {
    const legacy = { ...configuredDb(),
      memberships: [membership({ is_active: false, permission_overrides: {
        can_create_exams: false, can_manage_members: true, can_assign_correctors: null,
      }, updated_at: '2026-10-01T00:00:00Z' })],
      custom_table: [{ preserved: true }],
    };
    localStorage.setItem(KEY, JSON.stringify(legacy));
    const { db } = await import('./db.js');
    const { role_permission_snapshot: snapshot, ...original } = db.memberships[0];
    expect(original).toEqual(legacy.memberships[0]);
    expect(snapshot.TEACHER.can_create_exams).toBe(true);
    expect(effectiveMembershipPermissions(db, db.memberships[0])).toMatchObject({
      can_create_exams: false, can_manage_members: true, can_assign_correctors: false,
    });
    expect(JSON.parse(localStorage.getItem(KEY)).memberships[0].role_permission_snapshot).toEqual(snapshot);
    db.org_config.role_permission_defaults = {};
    db.persist();
    vi.resetModules();
    const { db: reloaded } = await import('./db.js');
    expect(reloaded.memberships[0].role_permission_snapshot).toEqual(snapshot);
    expect(reloaded.memberships[0].permission_overrides).toEqual(original.permission_overrides);
    expect(reloaded.custom_table).toEqual(legacy.custom_table);
    reloaded.memberships[0].permission_overrides.can_create_exams = null;
    expect(effectiveMembershipPermissions(reloaded, reloaded.memberships[0]).can_create_exams).toBe(true);
  });

  it('captures initial seed, feature additions and fresh reset rows without sharing snapshot objects', async () => {
    const { db, extendSeed } = await import('./db.js');
    expect(db.memberships.every((row) => row.role_permission_snapshot)).toBe(true);
    extendSeed((data) => {
      if (!data.memberships.some((row) => row.id === 'm-extension')) {
        data.memberships.push(membership({ id: 'm-extension' }));
      }
    });
    const added = db.memberships.find((row) => row.id === 'm-extension');
    expect(added.role_permission_snapshot.TEACHER.can_create_exams).toBe(false);
    db.org_config.role_permission_defaults.TEACHER = { can_create_exams: true };
    db.persist();
    expect(added.role_permission_snapshot.TEACHER.can_create_exams).toBe(false);
    db.reset();
    const resetAdded = db.memberships.find((row) => row.id === 'm-extension');
    expect(resetAdded).not.toBe(added);
    expect(resetAdded.role_permission_snapshot).not.toBe(added.role_permission_snapshot);
    expect(resetAdded.role_permission_snapshot.TEACHER.can_create_exams).toBe(false);
    expect(JSON.parse(localStorage.getItem(KEY)).memberships.every((row) => row.role_permission_snapshot)).toBe(true);
  });
});
