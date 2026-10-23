import { lazy } from 'react';
import { mocks } from './mocks.js';

const ReviewsPage = lazy(() => import('./ReviewsPage.jsx'));

/* Owner: Claude. Teacher review inbox
   (roles are per subject; the page itself shows only what /my-tasks/ returns). */
export default {
  id: 'reviews',
  order: 40,
  routes: [{ path: '/reviews', element: <ReviewsPage /> }],
  // Hidden for users known to be only students (session.teaches is set by workspace once my-subjects loads).
  nav: [{ to: '/reviews', label: 'reviews:nav', section: 'work', when: (s) => s.isStaff || s.teaches !== false }],
  mocks,
  i18n: {
    es: {
      nav: 'Revisiones', eyebrow: 'Periodos de revisión abiertos', title: 'Solicitudes de revisión',
      lede: 'Cada solicitud corresponde a un problema concreto. Al resolver todas las de un examen, este queda cerrado.',
      emptyTitle: 'No hay solicitudes pendientes', emptyBody: 'Aquí aparecen las solicitudes de los problemas que tienes asignados para corregir, cuando el alumnado pide revisión durante un periodo abierto.',
      noMessage: 'Sin comentario del estudiante.', reply: 'Respuesta al estudiante', replyPlaceholder: 'Explica la decisión. Si cambias la nota, hazlo desde el examen.',
      openExam: 'Abrir examen', resolve: 'Resolver', resolved: 'Solicitud resuelta',
      openExamFor: 'Abrir examen: {{label}}', resolveFor: 'Resolver: {{label}}',
      errors: { ALREADY_RESOLVED: 'Otra persona ya resolvió esta solicitud. La lista se ha actualizado.' },
    },
    en: {
      nav: 'Reviews', eyebrow: 'Open review periods', title: 'Review requests',
      lede: 'Each request is about one problem. Once every request of an exam is resolved, it is closed.',
      emptyTitle: 'No pending requests', emptyBody: 'Requests on the problems assigned to you for grading show up here when students ask for a review during an open period.',
      noMessage: 'No comment from the student.', reply: 'Reply to the student', replyPlaceholder: 'Explain the decision. To change the grade, do it from the exam.',
      openExam: 'Open exam', resolve: 'Resolve', resolved: 'Request resolved',
      openExamFor: 'Open exam: {{label}}', resolveFor: 'Resolve: {{label}}',
      errors: { ALREADY_RESOLVED: 'Someone else already resolved this request. The list has been refreshed.' },
    },
  },
};
