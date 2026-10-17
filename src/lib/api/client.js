/* HTTP client for the SCDEE backend (Django REST, /api/v1/).
 *
 * Contract facts verified against the backend repo (OpenAPI + views):
 *  - Auth: POST /auth/login/ -> { access_token, refresh_token, user }
 *          POST /auth/refresh/ { refresh_token } -> { access_token, refresh_token } (rotating)
 *          POST /auth/logout/ { refresh_token } -> 204
 *  - Errors: { error_code } or { error_code: 'VALIDATION_ERROR', errors: { field: [CODE] } }
 *  - Lists: offset pagination { count, page, page_size, total_pages, next, previous, results }
 *    (some list endpoints return plain arrays — use `asList`).
 *
 * When VITE_MOCK_API === 'true' every request is served by the in-memory
 * mock router (src/lib/mock), so the UI is fully usable without a backend.
 */
import { tokenStore } from './tokens.js';
import { ApiError, toApiError } from './errors.js';
import { mockFetch } from '../mock/router.js';

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
export const API_BASE = `${API_URL}/api/v1`;
export const USE_MOCK = import.meta.env.VITE_MOCK_API === 'true';

let refreshing = null; // single-flight refresh promise
const unauthorizedListeners = new Set();

/** Subscribe to "session is no longer valid" (refresh failed). Returns unsubscribe. */
export function onUnauthorized(fn) {
  unauthorizedListeners.add(fn);
  return () => unauthorizedListeners.delete(fn);
}

function transport(url, init) {
  return USE_MOCK ? mockFetch(url, init) : fetch(url, init);
}

async function refreshTokens() {
  const refresh = tokenStore.getRefresh();
  if (!refresh) return false;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await transport(`${API_BASE}/auth/refresh/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refresh }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        tokenStore.set(data.access_token, data.refresh_token);
        return true;
      } catch {
        return false;
      } finally {
        setTimeout(() => {
          refreshing = null;
        }, 0);
      }
    })();
  }
  return refreshing;
}

function buildUrl(path, query) {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    });
  }
  return url.toString();
}

/**
 * Core request.
 * @param {string} path  e.g. '/my-subjects/'
 * @param {object} opts  { method, body, query, form (FormData), raw (return Response), auth=true }
 */
export async function request(path, opts = {}) {
  const { method = 'GET', body, query, form, raw = false, auth = true, signal } = opts;
  const url = buildUrl(path, query);

  const send = () => {
    const headers = { Accept: 'application/json' };
    let payload;
    if (form) {
      payload = form; // browser sets multipart boundary
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const token = tokenStore.getAccess();
    if (auth && token) headers.Authorization = `Bearer ${token}`;
    return transport(url, { method, headers, body: payload, signal });
  };

  let res;
  try {
    res = await send();
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ApiError('NETWORK_ERROR', 0);
  }

  if (res.status === 401 && auth && tokenStore.getRefresh()) {
    const ok = await refreshTokens();
    if (ok) {
      res = await send();
    } else {
      tokenStore.clear();
      unauthorizedListeners.forEach((fn) => fn());
    }
  }

  if (!res.ok) throw await toApiError(res);
  if (raw) return res;
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export const api = {
  get: (path, query, opts) => request(path, { ...opts, query }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  del: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
  /** multipart/form-data upload */
  upload: (path, formData, method = 'POST') => request(path, { method, form: formData }),
  /** Binary download -> Blob */
  blob: async (path, query) => {
    const res = await request(path, { query, raw: true });
    return res.blob();
  },
};

/** Normalises "array or paginated envelope" responses to an array. */
export function asList(data) {
  if (Array.isArray(data)) return data;
  return data?.results ?? [];
}

/** Normalises a paginated envelope to { items, count, page, totalPages }. */
export function asPage(data) {
  if (Array.isArray(data)) return { items: data, count: data.length, page: 1, totalPages: 1 };
  return {
    items: data?.results ?? [],
    count: data?.count ?? 0,
    page: data?.page ?? 1,
    totalPages: data?.total_pages ?? 1,
  };
}
