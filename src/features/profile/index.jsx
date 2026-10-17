import { lazy } from 'react';
import { mocks } from './mocks.js';
const ProfilePage = lazy(() => import('./ProfilePage.jsx'));
export default {
  id: 'profile', order: 90, mocks,
  routes: [{ path: '/profile', element: <ProfilePage /> }],
  nav: [{ to: '/profile', label: 'profile:title', section: 'account' }],
  i18n: {
    es: { title: 'Mi perfil', account: 'Cuenta', hint: 'Actualiza tu email y tus preferencias de notificación. Los datos académicos los gestiona tu organización.', email: 'Email', notifications: 'Recibir notificaciones por email', first_name: 'Nombre', last_name: 'Apellidos', nia: 'NIA', dni: 'DNI' },
    en: { title: 'My profile', account: 'Account', hint: 'Update your email and notification preferences. Your organization manages academic information.', email: 'Email', notifications: 'Receive email notifications', first_name: 'First name', last_name: 'Last name', nia: 'Student ID', dni: 'National ID' },
  },
};
