/* Contract test: every GET the mock serves must answer what the real
 * backend answers (OpenAPI snapshot in ./openapi.json, regenerate with
 * scripts/analyze/openapi-snapshot.mjs).
 *
 * For each GET operation with a registered mock handler, the path
 * parameters are filled with ids from the seed (one per distinct status
 * where the table has one) and the request is sent as four actors (org
 * manager, two teachers with crossed roles, a student). Each answer must use
 * a status the operation declares and, when JSON, validate against the
 * declared schema, or against a role-specific shape the backend sends
 * without declaring it (./backend-shapes.js, gap-10). Unknown fields count
 * as violations.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import '../../app/registry.js';
import { listMockRoutes, mockFetch } from '../../lib/mock/router.js';
import { db } from '../../lib/mock/db.js';
import spec from './openapi.json';
import { createValidator } from './validate.js';
import { BACKEND_SHAPES } from './backend-shapes.js';

const validate = createValidator(spec.schemas);
const BASE = 'http://mock/api/v1';
const ACTORS = [
  ['admin@uam.es', 'admin123'],
  ['maria.perez@uam.es', 'prof123'],
  ['javier.ruiz@uam.es', 'prof123'],
  ['elena.rodriguez@estudiante.uam.es', 'est123'],
];

/* Which seed table feeds each path parameter (by name, or by the segment before `{id}`). */
const TABLES = {
  exam_pk: 'exams', instance_pk: 'instances', model_pk: 'models', subject_pk: 'subjects',
  membership_pk: 'memberships', subjects: 'subjects', courses: 'courses', users: 'users',
};

function sampleIds(table) {
  const rows = db[table] ?? [];
  if (!rows.length) return [];
  if (!('status' in rows[0])) return [...new Set([rows[0], rows[Math.floor(rows.length / 2)], rows.at(-1)])].map((r) => r.id);
  const byStatus = new Map();
  rows.forEach((r) => byStatus.has(r.status) || byStatus.set(r.status, r.id));
  return [...byStatus.values()];
}

function concretePaths(template) {
  const params = [...template.matchAll(/([a-z-]+)\/\{([a-z_]+)\}/g)];
  if (!params.length) return [template];
  if (params.length > 1) return []; // nested ids (pages, problems) are only used by mutations
  const [, segment, name] = params[0];
  const table = TABLES[name] ?? TABLES[segment];
  return table ? sampleIds(table).map((id) => template.replace(`{${name}}`, id)) : [];
}

/* `/exams/{exam_pk}/` and `/exams/:id/` are the same route; literals must match literally. */
const shape = (path) => path.replace(/\{[a-z_]+\}|:[a-zA-Z_]+/g, '{}').replace(/\/?$/, '/');

const tokens = {};
beforeAll(async () => {
  localStorage.clear();
  db.reset();
  for (const [email, password] of ACTORS) {
    const res = await mockFetch(`${BASE}/auth/login/`, { method: 'POST', body: JSON.stringify({ email, password }) });
    tokens[email] = (await res.json()).access_token;
  }
});

describe('mock responses follow the backend contract', () => {
  it('validates every GET answer the mock serves', async () => {
    const served = new Set(listMockRoutes().filter((r) => r.startsWith('GET ')).map((r) => shape(r.split(' ')[1])));
    const violations = [];
    const operations = new Set();
    const shapesUsed = new Set();
    let checked = 0;

    for (const [fullPath, item] of Object.entries(spec.paths)) {
      const op = item.get;
      const template = fullPath.replace(/^\/api\/v1/, '');
      if (!op || !served.has(shape(template))) continue;
      operations.add(template);
      const alternatives = BACKEND_SHAPES[`GET ${template}`] ?? [];

      for (const path of concretePaths(template)) {
        for (const [email] of ACTORS) {
          const res = await mockFetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${tokens[email]}` } });
          const declared = op.responses[res.status];
          const who = `GET ${path} as ${email.split('@')[0]} → ${res.status}`;
          if (!declared) {
            violations.push(`${who}: status not declared (${Object.keys(op.responses).join(', ')})`);
            continue;
          }
          const type = res.headers.get('Content-Type') ?? '';
          if (!type.includes('json')) {
            const types = Object.keys(declared.content ?? {});
            if (types.length && !types.some((t) => t === '*/*' || type.startsWith(t))) violations.push(`${who}: content type ${type} not declared (${types.join(', ')})`);
            continue;
          }
          const schema = declared.content?.['application/json']?.schema;
          if (!schema) continue;
          // File downloads (e.g. /users/export/?export_format=json): drf-spectacular declares a
          // binary string, and renames `format` after the query parameter of the same name.
          if (schema.type === 'string' && [schema.format, schema.export_format].includes('binary')) continue;
          checked += 1;
          const body = await res.json();
          const errors = validate(schema, body);
          if (!errors.length) continue;
          // Report against the closest candidate, so a mock bug is not hidden behind the gap.
          const candidates = [{ name: 'declared', errors }, ...(res.status < 300 ? alternatives : []).map((a) => ({ name: a.name, errors: validate(a.schema, body) }))];
          const best = candidates.reduce((a, b) => (b.errors.length < a.errors.length ? b : a));
          if (!best.errors.length) shapesUsed.add(`GET ${template} ${best.name}`);
          else best.errors.slice(0, 5).forEach((e) => violations.push(`${who} (${best.name}): ${e}`));
        }
      }
    }

    const stale = Object.entries(BACKEND_SHAPES).filter(([key]) => ![...shapesUsed].some((u) => u.startsWith(`${key} `)));
    console.info(`[contract] ${operations.size} GET operations, ${checked} JSON answers validated against ${spec.source} (${spec.sha256}); undeclared backend shapes used: ${shapesUsed.size}`);
    if (process.env.CONTRACT_DUMP) (await import('node:fs')).writeFileSync(process.env.CONTRACT_DUMP, [...violations, '--', ...shapesUsed].join('\n'));
    expect(operations.size).toBeGreaterThan(15);
    expect(violations).toEqual([]);
    expect(stale.map(([key]) => key), 'backend shapes never needed: the gap may be fixed').toEqual([]);
  });
});
