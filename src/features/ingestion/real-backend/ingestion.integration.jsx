/* Scanned page images against the real Django (no mocks), with the synthetic
 * fixtures-claude organization: PageResponse.image_url is a server-relative,
 * Bearer-only route that answers a normalised PNG to staff and 403 to the
 * student owner, and the incidents page shows it as thumbnails. Read-only. */
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, configure, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import i18n from '../../../app/i18n.js';
import AppRouter from '../../../app/AppRouter.jsx';
import { AuthProvider } from '../../../lib/auth/AuthProvider.jsx';
import { USE_MOCK, api } from '../../../lib/api/client.js';
import { ToastProvider } from '../../../ui';
import { loadFixture, signIn } from '../../grading/real-backend/session.js';
import { getPageImageUrl } from '../api.js';

configure({ asyncUtilTimeout: 15000 });
globalThis.ResizeObserver ??= class {
  observe() {}
  disconnect() {}
};
// Node's fetch rejects jsdom's AbortSignal (a different class): drop it here.
// Browsers are covered by the Playwright review.
const nodeFetch = globalThis.fetch;
globalThis.fetch = (url, { signal: _signal, ...init } = {}) => nodeFetch(url, init);
const blobs = new Map();
URL.createObjectURL = (blob) => {
  const url = `blob:real-${blobs.size + 1}`;
  blobs.set(url, blob);
  return url;
};
URL.revokeObjectURL = (url) => blobs.delete(url);
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const bytesOf = (blob) =>
  new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(new Uint8Array(fr.result));
    fr.readAsArrayBuffer(blob);
  });

let fx;

beforeAll(async () => {
  expect(USE_MOCK).toBe(false);
  fx = await loadFixture();
  await i18n.changeLanguage('es');
});
afterEach(cleanup);

describe('scanned page images (real backend)', () => {
  it('serves the PNG of each page to staff and refuses it to the student owner', async () => {
    await signIn(fx, 'manager');
    const pages = await api.get(`/instances/${fx.instanceId}/pages/`);
    expect(pages.length).toBeGreaterThan(0);
    for (const page of pages) {
      expect(page.image_url).toBe(`/api/v1/pages/${page.id}/image/`);
      const url = await getPageImageUrl(page.image_url);
      const bytes = await bytesOf(blobs.get(url));
      expect([...bytes.slice(0, 8)]).toEqual(PNG);
      console.info(`[ingestion] page ${page.page_number}: PNG ${bytes.length} bytes`);
    }

    await signIn(fx, 'student');
    await expect(getPageImageUrl(pages[0].image_url)).rejects.toMatchObject({ status: 403 });
  });

  it('shows the thumbnails on the incidents page and enlarges one', async () => {
    const data = await signIn(fx, 'manager');
    localStorage.setItem('scde.user', JSON.stringify({ ...JSON.parse(localStorage.getItem('scde.user')), isStaff: Boolean(data.user.is_staff) }));
    render(
      <MemoryRouter initialEntries={[`/exams/${fx.examId}/issues`]}>
        <AuthProvider>
          <ToastProvider>
            <AppRouter />
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>,
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: /Todos/ }));
    const table = await screen.findByRole('table', { name: 'Exámenes escaneados' });
    const own = (await api.get(`/instances/${fx.instanceId}/`)).student_email;
    const row = within(table).getAllByRole('row').find((r) => r.textContent.includes(own.split('@')[0]) || r === within(table).getAllByRole('row')[1]);
    await user.click(row);
    const thumb = await screen.findByRole('button', { name: 'Ampliar Página 1' });
    expect(thumb.querySelector('img')).toHaveAttribute('src', expect.stringMatching(/^blob:real-/));
    await user.click(thumb);
    const dialog = await screen.findByRole('dialog', { name: 'Página 1' });
    expect(within(dialog).getByRole('img', { name: 'Escaneo de Página 1' })).toBeInTheDocument();
  });
});
