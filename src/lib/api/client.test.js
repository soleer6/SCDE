import { beforeEach, describe, expect, it } from 'vitest';
import '../../app/registry.js'; // registers feature mocks
import { api } from './client.js';
import { tokenStore, decodeJwt } from './tokens.js';
import { ApiError } from './errors.js';

describe('api client in mock mode', () => {
  beforeEach(() => localStorage.clear());

  it('logs in with the real contract field names', async () => {
    const data = await api.post('/auth/login/', { email: 'maria.perez@uam.es', password: 'prof123' }, { auth: false });
    expect(data.access_token).toBeTruthy();
    expect(data.refresh_token).toBeTruthy();
    expect(data.user).toMatchObject({ email: 'maria.perez@uam.es', first_name: 'María' });
    expect(decodeJwt(data.access_token)).toMatchObject({ is_staff: false, token_type: 'access' });
  });

  it('maps backend error codes to ApiError', async () => {
    await expect(api.post('/auth/login/', { email: 'x@uam.es', password: 'bad' }, { auth: false })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      status: 401,
    });
    const err = await api.post('/auth/login/', {}, { auth: false }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.fieldCode('email')).toBe('FIELD_REQUIRED');
  });

  it('refreshes an expired access token transparently', async () => {
    const data = await api.post('/auth/login/', { email: 'admin@uam.es', password: 'admin123' }, { auth: false });
    tokenStore.set('garbage.token.x', data.refresh_token);
    // logout requires a valid request path; use refresh flow through any authed call
    const res = await api.post('/auth/logout/', { refresh_token: data.refresh_token });
    expect(res).toBeNull();
  });
});
