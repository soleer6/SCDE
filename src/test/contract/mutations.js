/* Contract recorder for mutations (POST/PUT/PATCH/DELETE).
 *
 * The GET contract test (mock-contract.test.js) can sample reads from the
 * seed, but a mutation only means something inside a flow: the right body,
 * the right state. So the flow tests are the samples: setup.js installs this
 * recorder, every answer a mock handler gives to a mutation is checked
 * against the operation the OpenAPI snapshot declares (status declared, JSON
 * body valid, no invented fields), and each test file fails on violations.
 *
 * Error answers are held to the envelope the backend's exception handler and
 * views really build (apps/core/utils/exceptions.py), not to the declared
 * status/enum: the views return service error codes and statuses (409
 * VERSION_CONFLICT, 400 INVALID_PDF, 404 TARGET_NOT_FOUND...) that the OpenAPI
 * does not declare (gap-11 in docs/tfg/03-backend-gaps.md).
 */
import { observeMockResponses } from '../../lib/mock/router.js';
import spec from './openapi.json';
import { createValidator } from './validate.js';
import { MUTATION_SHAPES } from './backend-shapes.js';

const validate = createValidator(spec.schemas);

/* `/exams/{exam_pk}/` and `/exams/:id/` are the same route; literals must match literally. */
export const routeShape = (path) => path.replace(/\{[a-z_]+\}|:[a-zA-Z_]+/g, '{}').replace(/\/?$/, '/');

const OPERATIONS = new Map();
for (const [fullPath, item] of Object.entries(spec.paths)) {
  for (const [method, op] of Object.entries(item)) {
    const template = fullPath.replace(/^\/api\/v1/, '');
    OPERATIONS.set(`${method.toUpperCase()} ${routeShape(template)}`, { ...op, key: `${method.toUpperCase()} ${template}` });
  }
}

/* apps/core/utils/exceptions.py · api_exception_handler, and the views' `{error_code: exc.code}`. */
const ERROR_ENVELOPE = {
  type: 'object',
  properties: {
    error_code: { type: 'string', pattern: '^[A-Z][A-Z0-9_]*$' },
    errors: { type: 'object', additionalProperties: { type: 'array', items: { type: 'string' } } },
  },
  required: ['error_code'],
};

/* drf-spectacular declares file downloads as a binary string (and renames `format`
 * after a query parameter of the same name, e.g. /users/export/?export_format=). */
const isBinary = (schema) => schema?.type === 'string' && [schema.format, schema.export_format].includes('binary');

/** Contract violations of one answer to `METHOD route` (route as registered in the mock). */
export async function checkAnswer(method, route, response, label = `${method} ${route}`) {
  const op = OPERATIONS.get(`${method} ${routeShape(route)}`);
  const who = `${label} → ${response.status}`;
  if (!op) return [`${who}: operation not in the OpenAPI`];
  if (response.status >= 400) return validate(ERROR_ENVELOPE, await response.json()).map((e) => `${who}: ${e}`);
  const declared = op.responses[response.status];
  if (!declared) return [`${who}: status not declared (${Object.keys(op.responses).join(', ')})`];
  const types = Object.keys(declared.content ?? {});
  if (response.status === 204 || !types.length) return [];
  const type = response.headers.get('Content-Type') ?? '';
  if (!type.includes('json')) {
    return types.some((t) => t === '*/*' || type.startsWith(t)) ? [] : [`${who}: content type ${type} not declared (${types.join(', ')})`];
  }
  const schema = declared.content['application/json']?.schema;
  if (!schema || isBinary(schema)) return [];
  const body = await response.json();
  // Report against the closest candidate, so a mock bug is not hidden behind the gap.
  const candidates = [{ name: 'declared', schema }, ...(MUTATION_SHAPES[op.key] ?? [])].map((c) => ({ ...c, errors: validate(c.schema, body) }));
  const best = candidates.reduce((a, b) => (b.errors.length <= a.errors.length ? b : a)); // ties: the known backend shape
  return best.errors.slice(0, 5).map((e) => `${who} (${best.name}): ${e}`);
}

const MUTATIONS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Starts recording; `stop()` resolves to the violations seen (deduplicated). */
export function recordMutations() {
  const pending = [];
  const unobserve = observeMockResponses(({ method, route, response }) => {
    if (MUTATIONS.has(method)) pending.push(checkAnswer(method, route, response));
  });
  return {
    async stop() {
      unobserve();
      return [...new Set((await Promise.all(pending)).flat())];
    },
  };
}
