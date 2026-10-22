/* Real-backend helpers for the integration tests (see vitest.config.mjs). */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tokenStore } from '../../../lib/api/tokens.js';
import { clearSubjectsCache } from '../../workspace/api.js';

export const BASE = 'http://127.0.0.1:8000/api/v1';

export async function loadFixture() {
  const file = process.env.SCDE_FIXTURE_FILE || join(process.env.LOCALAPPDATA, 'SCDE/integration/fixtures-claude.local.json');
  return JSON.parse((await readFile(file, 'utf8')).trimStart()); // trimStart also drops a BOM
}

/** POST /auth/login/ honouring Retry-After (the real throttles stay on). */
export async function login(fixture, role, attempt = 0) {
  const res = await fetch(`${BASE}/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: fixture[role], password: fixture.password }),
  });
  const wait = Number(res.headers.get('retry-after'));
  if (res.status === 429 && attempt < 2 && wait > 0 && wait <= 60) {
    await new Promise((r) => setTimeout(r, wait * 1000));
    return login(fixture, role, attempt + 1);
  }
  if (res.status !== 200) throw new Error(`login ${role}: HTTP ${res.status}`);
  return res.json();
}

/** A clean browser signed in as `role`: empty localStorage, then the session the app expects. */
export async function signIn(fixture, role) {
  localStorage.clear();
  tokenStore.clear();
  clearSubjectsCache();
  const data = await login(fixture, role);
  tokenStore.set(data.access_token, data.refresh_token);
  localStorage.setItem('scde.user', JSON.stringify({
    id: data.user.id, email: data.user.email, firstName: data.user.first_name, lastName: data.user.last_name,
    organizationId: data.user.organization_id, isStaff: false, isSuperadmin: false,
  }));
  return data;
}

/** An independent JWT session (another browser) that talks HTTP directly. */
export async function otherSession(fixture, role) {
  const { access_token: token } = await login(fixture, role);
  const call = async (method, path, body) => {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, data: text ? JSON.parse(text) : null };
  };
  return { get: (p) => call('GET', p), put: (p, b) => call('PUT', p, b), post: (p, b) => call('POST', p, b), patch: (p, b) => call('PATCH', p, b) };
}
