import { lazy } from 'react';
import { mocks } from './mocks.js';
import es from './i18n.es.json';
import en from './i18n.en.json';

const ExamPage = lazy(() => import('./ExamPage.jsx'));

/* Owner: Claude. Exam page (teacher dashboard / student result by role). */
export default {
  id: 'exams',
  order: 20,
  routes: [{ path: '/exams/:examId', element: <ExamPage /> }],
  mocks,
  i18n: { es, en },
};
