import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, onUnauthorized } from '../api/client.js';
import { decodeJwt, tokenStore } from '../api/tokens.js';

const AuthContext = createContext(null);
const USER_KEY = 'scde.user';

/** Session = login `user` payload + JWT claims (is_staff / is_superadmin are only in the token). */
function buildSession(user, accessToken) {
  const claims = decodeJwt(accessToken) || {};
  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    organizationId: user.organization_id,
    isStaff: Boolean(claims.is_staff),
    isSuperadmin: Boolean(claims.is_superadmin),
  };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw && tokenStore.getAccess() ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const clear = useCallback(() => {
    tokenStore.clear();
    try {
      localStorage.removeItem(USER_KEY);
    } catch {
      /* ignore */
    }
    setSession(null);
  }, []);

  useEffect(() => onUnauthorized(clear), [clear]);

  const login = useCallback(async (email, password) => {
    const data = await api.post('/auth/login/', { email, password }, { auth: false });
    tokenStore.set(data.access_token, data.refresh_token);
    const s = buildSession(data.user, data.access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(s));
    setSession(s);
    return s;
  }, []);

  const logout = useCallback(async () => {
    const refresh = tokenStore.getRefresh();
    try {
      if (refresh) await api.post('/auth/logout/', { refresh_token: refresh });
    } catch {
      /* token may already be invalid; local logout still proceeds */
    }
    clear();
  }, [clear]);

  const value = useMemo(() => ({ session, login, logout, isAuthenticated: Boolean(session) }), [session, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
