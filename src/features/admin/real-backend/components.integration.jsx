import '@testing-library/jest-dom/vitest';
import { afterEach, beforeAll, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import i18n from '@scde-integration/src/app/i18n.js';
import { AuthProvider, useAuth } from '@scde-integration/src/lib/auth/AuthProvider.jsx';
import { api, USE_MOCK } from '@scde-integration/src/lib/api/client.js';
import { tokenStore } from '@scde-integration/src/lib/api/tokens.js';
import ProfilePage from '@scde-integration/src/features/profile/ProfilePage.jsx';
import UsersPage from '@scde-integration/src/features/admin/UsersPage.jsx';
import CoursesPage from '@scde-integration/src/features/admin/CoursesPage.jsx';

let fixture;
beforeAll(async () => {
  fixture = JSON.parse(await readFile(join(process.env.LOCALAPPDATA, 'SCDE/integration/fixtures.local.json'), 'utf8'));
  expect(USE_MOCK).toBe(false);
  await i18n.changeLanguage('es');
});
afterEach(cleanup);

async function signIn(role) {
  localStorage.clear();
  tokenStore.clear();
  const data = await api.post('/auth/login/', { email: fixture[role], password: fixture.password }, { auth: false });
  tokenStore.set(data.access_token, data.refresh_token);
  localStorage.setItem('scde.user', JSON.stringify({
    id: data.user.id, email: data.user.email, firstName: data.user.first_name, lastName: data.user.last_name,
    organizationId: data.user.organization_id, isStaff: role === 'manager', isSuperadmin: false,
  }));
}
// Test-only observer of the actual session provider.
// eslint-disable-next-line react-refresh/only-export-components
function SessionEmail() {
  const { session } = useAuth();
  return <output data-testid="session-email">{session.email}</output>;
}
function mount(page) {
  return render(<MemoryRouter><AuthProvider><SessionEmail />{page}</AuthProvider></MemoryRouter>);
}

it('saves a real profile email and updates the active session only after Django accepts it', async () => {
  await signIn('student');
  mount(<ProfilePage />);
  const email = await screen.findByLabelText('Email', {}, { timeout: 10000 });
  expect(email).toHaveValue(fixture.student);
  const changed = `ui-${Date.now()}@scde.local`;
  try {
    fireEvent.change(email, { target: { value: changed } });
    fireEvent.submit(email.closest('form'));
    await waitFor(() => expect(screen.getByTestId('session-email')).toHaveTextContent(changed), { timeout: 10000 });
    expect(JSON.parse(localStorage.getItem('scde.user')).email).toBe(changed);
    expect((await api.get('/profile/')).email).toBe(changed);
    cleanup();
    mount(<ProfilePage />);
    expect(await screen.findByLabelText('Email', {}, { timeout: 10000 })).toHaveValue(changed);
    expect(screen.getByTestId('session-email')).toHaveTextContent(changed);
  } finally {
    await api.patch('/profile/', { email: fixture.student });
  }
});

it('renders PostgreSQL users and the active course through the production HTTP client', async () => {
  await signIn('manager');
  mount(<UsersPage />);
  expect(await screen.findByText(fixture.manager, {}, { timeout: 10000 })).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  cleanup();
  mount(<CoursesPage />);
  expect(await screen.findByText('2026', {}, { timeout: 10000 })).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('recovers concurrent real HTTP requests by rotating a rejected access token once', async () => {
  await signIn('teacher');
  const refresh = tokenStore.getRefresh();
  tokenStore.set('expired-integration-token', refresh);
  const [profile, tasks] = await Promise.all([api.get('/profile/'), api.get('/my-tasks/')]);
  expect(profile.email).toBe(fixture.teacher);
  expect(Array.isArray(tasks.grading_tasks)).toBe(true);
  expect(tokenStore.getAccess()).not.toBe('expired-integration-token');
  expect(tokenStore.getRefresh()).not.toBe(refresh);
});
