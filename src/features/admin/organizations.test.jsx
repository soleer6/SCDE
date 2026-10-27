import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { api } from '../../lib/api/client.js';
import { ApiError } from '../../lib/api/errors.js';
import { db } from '../../lib/mock/db.js';
import { navFor } from '../../app/registry.js';
import { loginAs, renderPage, resetDemo } from './test-utils.jsx';
import OrganizationsPage from './OrganizationsPage.jsx';

beforeEach(async () => { await resetDemo(); });
afterEach(() => vi.restoreAllMocks());
const fill = (subdomain = 'campus-test') => {
  for (const [label, value] of [
    ['Nombre de la organización', 'Campus de prueba'], ['Subdominio', subdomain],
    ['Email del gestor inicial', 'manager@campus.example'], ['Nombre del gestor inicial', 'Ana'], ['Apellidos del gestor inicial', 'Prueba'],
  ]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
};
const payload = (subdomain = 'campus-test') => ({ name: 'Campus de prueba', subdomain, plan: 'FREE',
  initial_manager: { email: 'manager@campus.example', first_name: 'Ana', last_name: 'Prueba' } });

it.each([['admin@uam.es', 'admin123'], ['elena.rodriguez@estudiante.uam.es', 'est123']])('denies direct organization creation and navigation to %s', async (email, password) => {
  await loginAs(email, password);
  const post = vi.spyOn(api, 'post');
  renderPage(<OrganizationsPage />);
  expect(screen.getByText('Solo los superadministradores pueden crear organizaciones.')).toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(post).not.toHaveBeenCalled();
  expect(navFor({ isStaff: email === 'admin@uam.es', isSuperadmin: false }).some(n => n.to === '/admin/organizations')).toBe(false);
  await expect(api.post('/organizations/', payload())).rejects.toMatchObject({ status: 403 });
});

it('creates organization and initial manager atomically, keeps tenants separate and starts a fresh form', async () => {
  await loginAs('superadmin@scde.demo', 'super123');
  expect(navFor({ isSuperadmin: true }).some(n => n.to === '/admin/organizations')).toBe(true);
  const prior = structuredClone(db.users.filter(u => u.organization_id === 'org-uam'));
  const user = userEvent.setup();
  const post = vi.spyOn(api, 'post');
  renderPage(<OrganizationsPage />);
  fill();
  await user.selectOptions(screen.getByLabelText('Plan'), 'PREMIUM');
  await user.click(screen.getByRole('button', { name: 'Crear organización', exact: true }));
  const result = await screen.findByRole('region', { name: 'Organización creada' });
  await waitFor(() => expect(result).toHaveFocus());
  expect(post).toHaveBeenCalledExactlyOnceWith('/organizations/', { ...payload(), plan: 'PREMIUM' });
  const created = db.organizations.find(o => o.subdomain === 'campus-test');
  const manager = db.users.find(u => u.email === 'manager@campus.example');
  expect(manager).toMatchObject({ organization_id: created.id, is_staff: true, is_superadmin: false, is_active: true });
  expect(db.users.filter(u => u.organization_id === 'org-uam')).toEqual(prior);
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Crear otra organización' }));
  expect(screen.getByLabelText('Nombre de la organización')).toHaveValue('');
  await waitFor(() => expect(screen.getByLabelText('Nombre de la organización')).toHaveFocus());
  await loginAs();
  expect((await api.get('/users/', { page_size: 100 })).results.some(u => u.id === manager.id)).toBe(false);
});

it('rejects duplicate subdomains without creating either record and preserves values for correction', async () => {
  await loginAs('superadmin@scde.demo', 'super123');
  renderPage(<OrganizationsPage />);
  fill('uam');
  const previous = { users: db.users.length, orgs: db.organizations.length };
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Crear organización', exact: true }));
  await screen.findAllByRole('alert');
  await waitFor(() => expect(screen.getByLabelText('Subdominio')).toHaveFocus());
  expect(screen.getByLabelText('Subdominio')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByLabelText('Email del gestor inicial')).toHaveValue('manager@campus.example');
  expect(db.users.length).toBe(previous.users);
  expect(db.organizations.length).toBe(previous.orgs);
  fireEvent.change(screen.getByLabelText('Subdominio'), { target: { value: 'recovered' } });
  await user.click(screen.getByRole('button', { name: 'Crear organización', exact: true }));
  await screen.findByRole('region', { name: 'Organización creada' });
});

it('blocks duplicate submits while pending and recovers a nested manager validation error with the original draft', async () => {
  await loginAs('superadmin@scde.demo', 'super123');
  renderPage(<OrganizationsPage />);
  fill();
  let reject;
  const pending = new Promise((_, no) => { reject = no; });
  const post = vi.spyOn(api, 'post').mockReturnValueOnce(pending);
  const form = screen.getByRole('button', { name: 'Crear organización', exact: true }).closest('form');
  act(() => { fireEvent.submit(form); fireEvent.submit(form); });
  expect(post).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Email del gestor inicial')).toBeDisabled();
  await act(async () => reject(new ApiError('VALIDATION_ERROR', 400, { 'initial_manager.email': ['INVALID'] })));
  await waitFor(() => expect(screen.getByLabelText('Email del gestor inicial')).toHaveFocus());
  expect(screen.getByLabelText('Email del gestor inicial')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByLabelText('Subdominio')).toHaveValue('campus-test');
  fireEvent.submit(form);
  await screen.findByRole('region', { name: 'Organización creada' });
  expect(post).toHaveBeenCalledTimes(2);
});

it('validates manager fields before any mock data changes', async () => {
  await loginAs('superadmin@scde.demo', 'super123');
  const previous = structuredClone({ orgs: db.organizations, users: db.users });
  await expect(api.post('/organizations/', { ...payload(), initial_manager: { email: 'invalid' } })).rejects.toMatchObject({ status: 400 });
  expect({ orgs: db.organizations, users: db.users }).toEqual(previous);
});

it('recovers an existing-manager failure without leaving an orphan organization or showing false success', async () => {
  await loginAs('superadmin@scde.demo', 'super123');
  renderPage(<OrganizationsPage />);
  fill();
  fireEvent.change(screen.getByLabelText('Email del gestor inicial'), { target: { value: 'admin@uam.es' } });
  const previous = structuredClone({ orgs: db.organizations, users: db.users });
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Crear organización', exact: true }));
  await screen.findAllByRole('alert');
  await waitFor(() => expect(screen.getByLabelText('Email del gestor inicial')).toHaveFocus());
  expect(screen.queryByRole('region', { name: 'Organización creada' })).not.toBeInTheDocument();
  expect({ orgs: db.organizations, users: db.users }).toEqual(previous);
  expect(screen.getByLabelText('Subdominio')).toHaveValue('campus-test');
  fireEvent.change(screen.getByLabelText('Email del gestor inicial'), { target: { value: 'recovered@campus.example' } });
  await user.click(screen.getByRole('button', { name: 'Crear organización', exact: true }));
  await screen.findByRole('region', { name: 'Organización creada' });
});
