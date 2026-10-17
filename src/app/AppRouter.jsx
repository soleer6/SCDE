import { Suspense } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth/AuthProvider.jsx';
import { ButtonLink, EmptyState, Loader } from '../ui';
import { allRoutes } from './registry.js';
import AppShell from './AppShell.jsx';

function RequireAuth({ staff }) {
  const { session } = useAuth();
  const location = useLocation();
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />;
  if (staff && !session.isStaff && !session.isSuperadmin) return <Navigate to="/" replace />;
  return <Outlet />;
}

function NotFound() {
  const { t } = useTranslation();
  return <EmptyState title={t('notFound.title')} body={t('notFound.body')} action={<ButtonLink to="/">{t('notFound.action')}</ButtonLink>} />;
}

const byGuard = (g) => allRoutes.filter((r) => (r.guard ?? 'auth') === g);

export default function AppRouter() {
  return (
    <Suspense fallback={<Loader page />}>
      <Routes>
        {byGuard('public').map((r) => (
          <Route key={r.path} path={r.path} element={r.element} />
        ))}
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            {byGuard('auth').map((r) => (
              <Route key={r.path} path={r.path} element={r.element} />
            ))}
            <Route element={<RequireAuth staff />}>
              {byGuard('staff').map((r) => (
                <Route key={r.path} path={r.path} element={r.element} />
              ))}
            </Route>
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
