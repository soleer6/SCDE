import { lazy } from 'react';
import { mocks } from './mocks.js';
import { authoringMocks } from './authoringMocks.js';
import es from './i18n.es.json';
import en from './i18n.en.json';

const ExamPage = lazy(() => import('./ExamPage.jsx'));
const ExamSetupPage = lazy(() => import('./setup/ExamSetupPage.jsx'));

/* Owner: Claude. Exam page (teacher dashboard / student result by role) and exam setup. */
export default {
  id: 'exams',
  order: 20,
  routes: [
    { path: '/exams/:examId', element: <ExamPage /> },
    { path: '/exams/:examId/setup', element: <ExamSetupPage /> },
  ],
  mocks: [...mocks, ...authoringMocks],
  i18n: { es, en },
};
