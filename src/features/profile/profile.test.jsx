import { beforeEach, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../../lib/api/client.js';
import { db } from '../../lib/mock/db.js';
import { loginAs, renderPage, resetDemo } from '../admin/test-utils.jsx';
import ProfilePage from './ProfilePage.jsx';

beforeEach(async () => { await resetDemo(); await loginAs('elena.rodriguez@estudiante.uam.es', 'est123'); });
it('updates only the allowed profile fields for a student', async () => {
  const user = userEvent.setup(); renderPage(<ProfilePage />);
  const input = await screen.findByLabelText('Email');
  fireEvent.change(input, { target: { value: 'elena.nueva@uam.es' } });
  await user.click(screen.getByLabelText('Recibir notificaciones por email'));
  await user.click(screen.getByRole('button', { name: 'Guardar' }));
  await screen.findByText('Cambios guardados');
  expect(db.users.find((u) => u.id === 'u-elena')).toMatchObject({ email: 'elena.nueva@uam.es', email_notifications_enabled: false, first_name: 'Elena', is_staff: false });
  expect(await api.get('/profile/')).not.toHaveProperty('password');
});
