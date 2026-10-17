/* Token persistence. localStorage keeps the session across reloads.
 * (Trade-off documented in docs/tfg/02-architecture-decisions.md.) */

const ACCESS = 'scde.access';
const REFRESH = 'scde.refresh';

function safe(fn, fallback = null) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export const tokenStore = {
  getAccess: () => safe(() => localStorage.getItem(ACCESS)),
  getRefresh: () => safe(() => localStorage.getItem(REFRESH)),
  set(access, refresh) {
    safe(() => {
      localStorage.setItem(ACCESS, access);
      if (refresh) localStorage.setItem(REFRESH, refresh);
    });
  },
  clear() {
    safe(() => {
      localStorage.removeItem(ACCESS);
      localStorage.removeItem(REFRESH);
    });
  },
};

/** Decodes a JWT payload without verifying it (display/authz hints only). */
export function decodeJwt(token) {
  if (!token) return null;
  try {
    const part = token.split('.')[1];
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return null;
  }
}
