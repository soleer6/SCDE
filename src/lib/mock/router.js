/* In-memory mock backend.
 *
 * Features register handlers for the endpoints they own:
 *
 *   export const mocks = [
 *     { method: 'GET', path: '/my-subjects/', handler: ({ user, db }) => [...] },
 *     { method: 'PATCH', path: '/instances/:id/transition/', handler: ({ params, body }) => ... },
 *   ];
 *
 * A handler returns a plain value (-> 200 JSON), or a reply built with
 * `reply(status, body)`, or throws `mockError(status, code, errors?)`.
 * Response shapes MUST mirror the real OpenAPI schema (snake_case), so the
 * same service code runs against mock and real backend.
 */
import { db } from './db.js';
import { decodeMockToken } from './auth.js';

const routes = [];
const observers = new Set();
const LATENCY_MS = Number(import.meta.env.VITE_MOCK_LATENCY ?? 180);

function compile(path) {
  const keys = [];
  const pattern = path
    .replace(/\/+$/, '')
    .replace(/:([a-zA-Z_]+)/g, (_, k) => {
      keys.push(k);
      return '([^/]+)';
    });
  return { regex: new RegExp(`^${pattern}/?$`), keys };
}

export function registerMocks(handlers = [], owner = 'unknown') {
  handlers.forEach((h) => {
    const { regex, keys } = compile(h.path);
    routes.push({ ...h, method: h.method.toUpperCase(), regex, keys, owner });
  });
}

export function reply(status, body = null, headers = {}) {
  return { __mockReply: true, status, body, headers };
}

export function mockError(status, code, errors) {
  const err = new Error(code);
  err.__mock = reply(status, errors ? { error_code: code, errors } : { error_code: code });
  return err;
}

/** Paginate an array like the backend StandardPagination (page_size 25). */
export function paginate(items, query) {
  const pageSize = Math.min(Number(query.get('page_size')) || 25, 100);
  const page = Math.max(Number(query.get('page')) || 1, 1);
  const total = items.length;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const start = (page - 1) * pageSize;
  return {
    count: total,
    page,
    page_size: pageSize,
    total_pages: totalPages,
    next: page < totalPages ? `?page=${page + 1}` : null,
    previous: page > 1 ? `?page=${page - 1}` : null,
    results: items.slice(start, start + pageSize),
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* jsdom's Blob has no arrayBuffer(); FileReader exists in both jsdom and browsers. */
function blobBytes(blob) {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsArrayBuffer(blob);
  });
}

async function toResponse(r) {
  if (r && r.__mockReply) {
    if (r.body instanceof Blob) {
      // Bytes, not the Blob itself: under Vitest, Response is Node's and Blob is
      // jsdom's, and Node would serialise a foreign Blob as "[object Blob]".
      const headers = { ...(r.body.type && { 'Content-Type': r.body.type }), ...r.headers };
      return new Response(await blobBytes(r.body), { status: r.status, headers });
    }
    const hasBody = r.status !== 204 && r.body !== null && r.body !== undefined;
    return new Response(hasBody ? JSON.stringify(r.body) : null, {
      status: r.status,
      headers: { 'Content-Type': 'application/json', ...r.headers },
    });
  }
  return new Response(JSON.stringify(r ?? null), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function readBody(init) {
  if (!init?.body) return { body: null, form: null };
  if (init.body instanceof FormData) {
    const obj = {};
    init.body.forEach((v, k) => {
      obj[k] = v;
    });
    return { body: obj, form: init.body };
  }
  try {
    return { body: JSON.parse(init.body), form: null };
  } catch {
    return { body: init.body, form: null };
  }
}

/** fetch()-compatible entry point used by the API client in mock mode. */
export async function mockFetch(input, init = {}) {
  await sleep(LATENCY_MS);
  const url = new URL(input);
  const method = (init.method || 'GET').toUpperCase();
  const path = url.pathname.replace(/^\/api\/v1/, '');

  // Most specific match wins (fewest params), like Django resolving
  // `subjects/export/` before `subjects/<uuid:pk>/`. Registration order must not matter.
  const route = routes
    .filter((r) => r.method === method && r.regex.test(path))
    .sort((a, b) => a.keys.length - b.keys.length)[0];
  if (!route) {
    console.warn(`[mock] no handler for ${method} ${path}`);
    return toResponse(reply(404, { error_code: 'NOT_FOUND' }));
  }

  const match = path.match(route.regex);
  const params = Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(match[i + 1])]));
  const auth = init.headers?.Authorization || init.headers?.authorization;
  const claims = auth ? decodeMockToken(auth.replace(/^Bearer /, '')) : null;

  if (route.auth !== false) {
    if (!claims || claims.token_type !== 'access') {
      return toResponse(reply(401, { error_code: 'AUTHENTICATION_REQUIRED' }));
    }
    if (claims.exp * 1000 < Date.now()) {
      return toResponse(reply(401, { error_code: 'TOKEN_EXPIRED' }));
    }
  }
  const user = claims ? db.users.find((u) => u.id === claims.user_id) ?? null : null;
  const { body, form } = await readBody(init);

  let response;
  try {
    const result = await route.handler({ params, query: url.searchParams, body, form, user, db });
    db.persist();
    response = await toResponse(result);
  } catch (err) {
    if (!err.__mock) console.error('[mock] handler error', err);
    response = await toResponse(err.__mock ?? reply(500, { error_code: 'INTERNAL_ERROR' }));
  }
  observers.forEach((fn) => fn({ method, route: route.path, path, response: response.clone() }));
  return response;
}

/** Test hook: `fn` sees every answer a handler produces (the contract recorder uses it). */
export function observeMockResponses(fn) {
  observers.add(fn);
  return () => observers.delete(fn);
}

/** Debug helper: list registered mock routes (used by tests and docs). */
export function listMockRoutes() {
  return routes.map((r) => `${r.method} ${r.path} (${r.owner})`);
}
