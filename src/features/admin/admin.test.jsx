import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../../lib/api/client.js';
import { db } from '../../lib/mock/db.js';
import { loginAs, renderPage, resetDemo } from './test-utils.jsx';
import UsersPage from './UsersPage.jsx';
import CoursesPage from './CoursesPage.jsx';
import ConfigPage from './ConfigPage.jsx';
import AuditPage from './AuditPage.jsx';

describe('organization administration in mock mode', () => {
  beforeEach(async () => { await resetDemo(); await loginAs(); });

  it('creates a user, validates duplicate emails, and never exposes passwords', async () => {
    const user = userEvent.setup(); renderPage(<UsersPage />);
    await screen.findByText('maria.perez@uam.es');
    await user.click(screen.getByRole('button', { name: 'Crear usuario' }));
    const dialog = within(screen.getByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Email'), { target: { value: 'admin@uam.es' } });
    fireEvent.change(dialog.getByLabelText('Nombre'), { target: { value: 'Ana' } });
    fireEvent.change(dialog.getByLabelText('Apellidos'), { target: { value: 'García' } });
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));
    expect(await dialog.findByText('Ya existe un usuario con ese email.')).toBeInTheDocument();
    fireEvent.change(dialog.getByLabelText('Email'), { target: { value: 'ana@uam.es' } });
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('ana@uam.es')).toBeInTheDocument();
    const result = await api.get('/users/');
    expect(result.results.find((u) => u.email === 'ana@uam.es')).not.toHaveProperty('password');
    expect(result).toHaveProperty('total_pages');
  }, 15000);

  it('requires confirmation before deactivating a user', async () => {
    const user = userEvent.setup(); renderPage(<UsersPage />);
    const row = (await screen.findByText('javier.ruiz@uam.es')).closest('tr');
    await user.click(within(row).getByRole('button', { name: 'Cambiar estado' }));
    expect(db.users.find((u) => u.id === 'u-javier').is_active).toBe(true);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar' }));
    await screen.findByText('Inactivo');
    expect(db.users.find((u) => u.id === 'u-javier').is_active).toBe(false);
  });

  it('searches users and renders a useful empty state', async () => {
    const user = userEvent.setup(); renderPage(<UsersPage />);
    await screen.findByText('admin@uam.es');
    fireEvent.change(screen.getByLabelText('Buscar usuarios'), { target: { value: 'nobody@example.com' } });
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(await screen.findByText('No hay registros')).toBeInTheDocument();
  });

  it('shows the active course and creates a course without writing is_active', async () => {
    const user = userEvent.setup(); renderPage(<CoursesPage />);
    expect(await screen.findByText('Curso activo')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Crear curso' }));
    const dialog = within(screen.getByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Nombre del curso'), { target: { value: '2027-2028' } });
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('2027-2028')).toBeInTheDocument();
    expect(db.courses.filter((c) => c.is_active)).toHaveLength(1);
  });

  it('saves config and displays field errors for invalid JSON', async () => {
    const user = userEvent.setup(); renderPage(<ConfigPage />);
    const input = await screen.findByLabelText('Motor OCR predeterminado');
    fireEvent.change(input, { target: { value: 'otro-motor' } });
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await screen.findByText('Cambios guardados');
    expect(db.org_config.default_ocr_engine).toBe('otro-motor');
    fireEvent.change(screen.getByLabelText('Columnas de exportación de notas (JSON)'), { target: { value: 'invalid' } });
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Valor no válido.')).toBeInTheDocument();
  });

  it('paginates the audit log and opens event payloads', async () => {
    db.audit_logs = Array.from({ length: 26 }, (_, i) => ({ id: `audit-${i}`, event_type: `EVENT_${i}`, actor: 'u-admin', actor_email: 'admin@uam.es', ip_address: null, timestamp: '2026-10-17T10:00:00Z', entity_type: 'user', entity_id: 'u-javier', payload: { changed: true } }));
    const user = userEvent.setup(); renderPage(<AuditPage />);
    await screen.findByText('EVENT_0');
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await user.click(await screen.findByText('EVENT_25'));
    expect(within(screen.getByRole('dialog')).getByText(/"changed": true/)).toBeInTheDocument();
  });

  it('denies organization endpoints to teaching users', async () => {
    await loginAs('maria.perez@uam.es', 'prof123');
    for (const path of ['/users/', '/config/', '/audit-logs/', '/users/export/']) await expect(api.get(path)).rejects.toMatchObject({ status: 403 });
    renderPage(<UsersPage />);
    expect(await screen.findByText('No tienes permiso para esta acción.')).toBeInTheDocument();
  });
});
