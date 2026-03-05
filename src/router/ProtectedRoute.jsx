import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Guards routes that require authentication.
 * Optionally restricts access to a specific role.
 *
 * @param {{ allowedRole?: 'PROFESSOR' | 'STUDENT' }} props
 */
export default function ProtectedRoute({ allowedRole }) {
    const { user, token, loading } = useAuth();

    if (loading) {
        // Still restoring session – avoid flashing a redirect
        return (
            <div className="splash-loading">
                <div className="spinner" />
            </div>
        );
    }

    if (!token || !user) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRole && user.role !== allowedRole) {
        // Redirect to the user's own home to avoid a blank/403 page
        const home =
            user.role === 'PROFESSOR' ? '/professor/subjects' : '/student/subjects';
        return <Navigate to={home} replace />;
    }

    return <Outlet />;
}
