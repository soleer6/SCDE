/* Mock JWTs: same claim names as the real jwt_plugin
 * (user_id, organization_id, is_staff, is_superadmin, token_type, exp). */

const b64 = (obj) => btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/=+$/, '');

export function issueMockTokens(user, { accessMinutes = 15 } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64({ alg: 'none', typ: 'JWT' });
  const access = b64({
    user_id: user.id,
    organization_id: user.organization_id,
    is_staff: user.is_staff,
    is_superadmin: user.is_superadmin,
    token_type: 'access',
    jti: Math.random().toString(36).slice(2),
    iat: now,
    exp: now + accessMinutes * 60,
  });
  const refresh = b64({
    user_id: user.id,
    token_type: 'refresh',
    jti: Math.random().toString(36).slice(2),
    iat: now,
    exp: now + 7 * 24 * 3600,
  });
  return { access_token: `${header}.${access}.mock`, refresh_token: `${header}.${refresh}.mock` };
}

export function decodeMockToken(token) {
  try {
    const part = token.split('.')[1];
    return JSON.parse(decodeURIComponent(escape(atob(part))));
  } catch {
    return null;
  }
}
