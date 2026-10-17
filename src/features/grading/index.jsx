import { lazy } from 'react';
import { mocks } from './mocks.js';
import es from './i18n.es.json';
import en from './i18n.en.json';

const GradingPage = lazy(() => import('./GradingPage.jsx'));

/* Owner: Claude. Grading workspace: PDF + ink annotations + per-problem grades. */
export default {
  id: 'grading',
  order: 30,
  routes: [{ path: '/instances/:instanceId/grade', element: <GradingPage /> }],
  mocks,
  i18n: { es, en },
};
