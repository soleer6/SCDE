import { lazy } from 'react';
import { mocks } from './mocks.js';
import { i18n } from './i18n.js';
const ManagePage = lazy(() => import('./ManagePage.jsx'));
const SubjectsPage = lazy(() => import('./SubjectsPage.jsx'));
export default {
  id: 'subject-admin', order: 60, mocks, i18n,
  routes: [{ path: '/subjects/:subjectId/manage', element: <ManagePage />, guard: 'auth' }, { path: '/admin/subjects', element: <SubjectsPage />, guard: 'staff' }],
  nav: [{ to: '/admin/subjects', label: 'subject-admin:directory', section: 'manage', when: (s) => s.isStaff || s.isSuperadmin }],
};
