import { configure, render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '../../app/i18n.js';
import { AuthProvider } from '../../lib/auth/AuthProvider.jsx';
import { api } from '../../lib/api/client.js';
import { tokenStore } from '../../lib/api/tokens.js';
import { db } from '../../lib/mock/db.js';

// Integration requests and concurrent jsdom workers can take more than 1 s on Windows.
configure({ asyncUtilTimeout: 5000 });

export async function loginAs(email = 'admin@uam.es', password = 'admin123') {
  const data = await api.post('/auth/login/', { email, password }, { auth: false });
  tokenStore.set(data.access_token, data.refresh_token);
  const row = db.users.find((u) => u.id === data.user.id);
  localStorage.setItem('scde.user', JSON.stringify({ id: row.id, email: row.email, firstName: row.first_name, lastName: row.last_name, organizationId: row.organization_id, isStaff: row.is_staff, isSuperadmin: row.is_superadmin }));
  return row;
}
export async function resetDemo() {
  localStorage.clear(); tokenStore.clear(); db.reset(); await i18n.changeLanguage('es');
}
export function renderPage(element, path = '/', route = '/') {
  return render(<MemoryRouter initialEntries={[path]}><AuthProvider><Routes><Route path={route} element={element} /></Routes></AuthProvider></MemoryRouter>);
}
