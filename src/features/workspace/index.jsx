import { lazy } from 'react';
import { mocks } from './mocks.js';
import es from './i18n.es.json';
import en from './i18n.en.json';

const OverviewPage = lazy(() => import('./OverviewPage.jsx'));
const SubjectsPage = lazy(() => import('./SubjectsPage.jsx'));
const SubjectPage = lazy(() => import('./SubjectPage.jsx'));

/* Owner: Claude (core flows). Overview, my subjects, subject page. */
export default {
  id: 'workspace',
  order: 10,
  routes: [
    { path: '/', element: <OverviewPage /> },
    { path: '/subjects', element: <SubjectsPage /> },
    { path: '/subjects/:subjectId', element: <SubjectPage /> },
  ],
  nav: [
    { to: '/', label: 'workspace:nav.overview', section: 'work', end: true },
    { to: '/subjects', label: 'workspace:nav.subjects', section: 'work' },
  ],
  mocks,
  i18n: { es, en },
};
