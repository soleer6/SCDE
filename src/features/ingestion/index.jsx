import { lazy } from 'react';
import { mocks } from './mocks.js';
import es from './i18n.es.json';
import en from './i18n.en.json';

const IssuesPage = lazy(() => import('./IssuesPage.jsx'));
const ScansPage = lazy(() => import('./ScansPage.jsx'));

/* Owner: Claude. Scan incidents (RF-7.14), manual instance fixes (RF-7.2, RF-7.10)
   and manager ingestion tools (RF-9.2, RF-9.9). */
export default {
  id: 'ingestion',
  order: 25,
  routes: [
    { path: '/exams/:examId/issues', element: <IssuesPage /> },
    { path: '/scans', element: <ScansPage />, guard: 'staff' },
  ],
  nav: [{ to: '/scans', label: 'ingestion:nav', section: 'manage', when: (s) => s.isStaff || s.isSuperadmin }],
  mocks,
  i18n: { es, en },
};
