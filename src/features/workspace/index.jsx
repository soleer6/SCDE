import { lazy } from 'react';

const OverviewPage = lazy(() => import('./OverviewPage.jsx'));

/* Owner: Claude (core flows). Overview + subjects + exams live here. */
export default {
  id: 'workspace',
  order: 10,
  routes: [{ path: '/', element: <OverviewPage /> }],
  nav: [{ to: '/', label: 'workspace:nav.overview', section: 'work', end: true }],
  mocks: [],
  i18n: {
    es: { nav: { overview: 'Inicio' }, overview: { eyebrow: 'Curso 2026-2027', title: 'Hola, {{name}}' } },
    en: { nav: { overview: 'Home' }, overview: { eyebrow: 'Year 2026-2027', title: 'Hello, {{name}}' } },
  },
};
