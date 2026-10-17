import { lazy } from 'react';
import { mocks } from './mocks.js';

const LoginPage = lazy(() => import('./LoginPage.jsx'));

export default {
  id: 'auth',
  order: 0,
  routes: [{ path: '/login', element: <LoginPage />, guard: 'public' }],
  mocks,
  i18n: {
    es: {
      meta: 'Corrección digital de exámenes',
      headline: 'Corrige, publica y revisa exámenes en un solo sitio.',
      sub: 'Profesorado y estudiantes trabajan sobre el mismo examen escaneado, con las anotaciones y la nota de cada problema a la vista.',
      steps: {
        scan: { title: 'Escanea.', body: 'Los exámenes en papel llegan como PDF identificados por estudiante.' },
        grade: { title: 'Corrige.', body: 'Anota sobre el folio y puntúa cada problema, a mano o con rúbrica.' },
        review: { title: 'Revisa.', body: 'El alumnado consulta su examen corregido y pide revisión si lo necesita.' },
      },
      foot: 'Trabajo Fin de Grado · Universidad Autónoma de Madrid',
      title: 'Inicia sesión',
      email: 'Email institucional',
      password: 'Contraseña',
      submit: 'Entrar',
      demo: 'Cuentas de demostración',
    },
    en: {
      meta: 'Digital exam grading',
      headline: 'Grade, publish and review exams in one place.',
      sub: 'Teachers and students work on the same scanned exam, with annotations and per-problem grades in view.',
      steps: {
        scan: { title: 'Scan.', body: 'Paper exams arrive as PDFs matched to each student.' },
        grade: { title: 'Grade.', body: 'Annotate the sheet and score each problem, freely or with a rubric.' },
        review: { title: 'Review.', body: 'Students see their graded exam and request a review if needed.' },
      },
      foot: 'Bachelor thesis · Universidad Autónoma de Madrid',
      title: 'Sign in',
      email: 'Institutional email',
      password: 'Password',
      submit: 'Sign in',
      demo: 'Demo accounts',
    },
  },
};
