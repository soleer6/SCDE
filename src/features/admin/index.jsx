import { lazy } from 'react';
import { mocks } from './mocks.js';
import { i18n } from './i18n.js';

const UsersPage = lazy(() => import('./UsersPage.jsx'));
const CoursesPage = lazy(() => import('./CoursesPage.jsx'));
const ConfigPage = lazy(() => import('./ConfigPage.jsx'));
const AuditPage = lazy(() => import('./AuditPage.jsx'));
const staff = (session) => session.isStaff || session.isSuperadmin;
export default {
  id: 'admin', order: 50, mocks, i18n,
  routes: [
    { path: '/admin/users', element: <UsersPage />, guard: 'staff' },
    { path: '/admin/courses', element: <CoursesPage />, guard: 'staff' },
    { path: '/admin/config', element: <ConfigPage />, guard: 'staff' },
    { path: '/admin/audit', element: <AuditPage />, guard: 'staff' },
  ],
  nav: ['users', 'courses', 'config', 'audit'].map((name) => ({ to: `/admin/${name}`, label: `admin:${name}`, section: 'manage', when: staff })),
};
