import { beforeEach, expect, it } from 'vitest';
import contract from './contracts/admin-openapi.json';
import { PERMISSION_KEYS } from '../../lib/permissions.js';
import { loginAs, resetDemo } from './test-utils.jsx';
import { USER_FILTER_KEYS } from './user-filters.js';
import { db } from '../../lib/mock/db.js';
import { mocks as profileMocks } from '../profile/mocks.js';

beforeEach(resetDemo);
it('uses only canonical list/export filter names and keeps pagination out of the export contract', () => {
  for (const path of ['/api/v1/users/', '/api/v1/users/export/']) {
    const names = contract.paths[path].get.parameters.filter(p => p.in === 'query').map(p => p.name);
    for (const key of USER_FILTER_KEYS) expect(names).toContain(key);
    if (path.endsWith('/export/')) {
      expect(names).toContain('export_format');
      expect(names).not.toContain('page');
      expect(names).not.toContain('page_size');
    }
  }
});

it('keeps the standalone profile mock compatible with canonical required own-membership fields', async () => {
  const user = await loginAs('elena.rodriguez@estudiante.uam.es', 'est123');
  db.memberships.filter(m => m.user_id === 'u-elena').forEach(m => { m.permission_overrides = { can_manage_members: true }; });
  // This assertion covers the fallback owned by profile. In a composition the
  // earlier workspace handler belongs to H01/#37 and is tested by its owner.
  const rows = profileMocks.find(mock => mock.path === '/my-subjects/').handler({ user, db });
  expect(rows.length).toBeGreaterThan(0);
  const schema = contract.components.schemas.MySubject;
  for (const row of rows) {
    for (const key of schema.required) expect(row).toHaveProperty(key);
    expect(typeof row.membership_id).toBe('string');
    expect(Object.keys(row.effective_permissions).sort()).toEqual([...PERMISSION_KEYS].sort());
    expect(Object.values(row.effective_permissions).every(value => typeof value === 'boolean')).toBe(true);
    expect(Object.values(row.effective_permissions).every(value => value === false)).toBe(true);
  }
});
