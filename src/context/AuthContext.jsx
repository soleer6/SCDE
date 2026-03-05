import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { login as apiLogin } from '../api/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true); // restoring session

    // Restore session from localStorage on mount
    useEffect(() => {
        try {
            const storedToken = localStorage.getItem('scde_token');
            const storedUser = localStorage.getItem('scde_user');
            if (storedToken && storedUser) {
                setToken(storedToken);
                setUser(JSON.parse(storedUser));
            }
        } catch {
            // corrupted storage – clear it
            localStorage.removeItem('scde_token');
            localStorage.removeItem('scde_user');
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Calls the auth service, persists the token+user, and updates state.
     * Throws on failure so LoginPage can show the error.
     */
    const login = useCallback(async (email, password) => {
        const data = await apiLogin(email, password);
        const { token, token_refresh, user } = data;

        localStorage.setItem('scde_token', token);
        localStorage.setItem('scde_token_refresh', token_refresh);
        localStorage.setItem('scde_user', JSON.stringify(user));

        setToken(token);
        setUser(user);

        return user;
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('scde_token');
        localStorage.removeItem('scde_token_refresh');
        localStorage.removeItem('scde_user');
        setToken(null);
        setUser(null);
    }, []);

    const value = { user, token, login, logout, loading };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
    return ctx;
}
