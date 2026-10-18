import { lazy } from 'react';
import { mocks } from './mocks.js';
import NotificationsBell from './NotificationsBell.jsx';
const NotificationsPage = lazy(() => import('./NotificationsPage.jsx'));
export default {
  id: 'notifications', order: 80, mocks,
  routes: [{ path: '/notifications', element: <NotificationsPage /> }],
  nav: [{ to: '/notifications', label: 'notifications:title', section: 'account' }],
  slots: { 'topbar.end': NotificationsBell },
  i18n: {
    es: { title: 'Notificaciones', account: 'Cuenta', unread_one: '{{count}} notificación sin leer', unread_other: '{{count}} notificaciones sin leer', unavailable: 'Consultar notificaciones; recuento no disponible', markPage: 'Marcar esta página como leída', mark: 'Marcar como leída', markNamed: 'Marcar como leída: {{title}}', message: 'Mensaje', date: 'Fecha', status: 'Estado', new: 'Sin leer', read: 'Leída', actions: 'Acciones', empty: 'No tienes notificaciones', emptyHint: 'Aquí aparecerán las novedades de tus exámenes y revisiones. Actualiza para consultar nuevos avisos.', refresh: 'Actualizar' },
    en: { title: 'Notifications', account: 'Account', unread_one: '{{count}} unread notification', unread_other: '{{count}} unread notifications', unavailable: 'View notifications; count unavailable', markPage: 'Mark this page as read', mark: 'Mark as read', markNamed: 'Mark as read: {{title}}', message: 'Message', date: 'Date', status: 'Status', new: 'Unread', read: 'Read', actions: 'Actions', empty: 'You have no notifications', emptyHint: 'Updates about your exams and reviews will appear here. Refresh to check for new notifications.', refresh: 'Refresh' },
  },
};
