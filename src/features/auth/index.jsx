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
      meta: 'Universidad · Acceso',
      headline: 'Cada nota tiene su rastro.',
      sub: 'Del folio escaneado a la revisión, sin perder un trazo.',
      title: 'Iniciar sesión',
      email: 'Email institucional',
      password: 'Contraseña',
      submit: 'Entrar',
      demo: 'Cuentas de demostración',
    },
    en: {
      meta: 'University · Sign in',
      headline: 'Every grade leaves a trace.',
      sub: 'From scanned sheet to review, without losing a stroke.',
      title: 'Sign in',
      email: 'Institutional email',
      password: 'Password',
      submit: 'Sign in',
      demo: 'Demo accounts',
    },
  },
};
