import { issueMockTokens, decodeMockToken } from '../../lib/mock/auth.js';
import { mockError, reply } from '../../lib/mock/router.js';

/* Mirrors apps/accounts/views/auth.py + serializers/auth.py */
export const mocks = [
  {
    method: 'POST',
    path: '/auth/login/',
    auth: false,
    handler: ({ body, db }) => {
      if (!body?.email || !body?.password) {
        throw mockError(400, 'VALIDATION_ERROR', {
          ...(body?.email ? {} : { email: ['FIELD_REQUIRED'] }),
          ...(body?.password ? {} : { password: ['FIELD_REQUIRED'] }),
        });
      }
      const user = db.users.find((u) => u.email.toLowerCase() === body.email.toLowerCase());
      if (!user || user.password !== body.password) throw mockError(401, 'INVALID_CREDENTIALS');
      if (!user.is_active) throw mockError(401, 'USER_INACTIVE');
      return {
        ...issueMockTokens(user),
        user: { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name, organization_id: user.organization_id },
      };
    },
  },
  {
    method: 'POST',
    path: '/auth/refresh/',
    auth: false,
    handler: ({ body, db }) => {
      const claims = decodeMockToken(body?.refresh_token || '');
      if (!claims || claims.token_type !== 'refresh') throw mockError(401, 'INVALID_TOKEN');
      const user = db.users.find((u) => u.id === claims.user_id);
      if (!user) throw mockError(401, 'INVALID_TOKEN');
      return issueMockTokens(user);
    },
  },
  { method: 'POST', path: '/auth/logout/', auth: false, handler: () => reply(204) },
];
