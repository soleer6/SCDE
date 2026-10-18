/* Page profiles and recognition zones (RF-6.8) in mock mode: contract + UI. */
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../../app/i18n.js';
import { AuthProvider } from '../../lib/auth/AuthProvider.jsx';
import { ToastProvider } from '../../ui';
import AppRouter from '../../app/AppRouter.jsx';
import { api } from '../../lib/api/client.js';
import { tokenStore } from '../../lib/api/tokens.js';
import { db } from '../../lib/mock/db.js';
import { clearSubjectsCache } from '../workspace/api.js';
import { fromPdfBox, toPdfBox } from './setup/zoneGeometry.js';

async function loginAs(email, password) {
  const data = await api.post('/auth/login/', { email, password }, { auth: false });
  tokenStore.set(data.access_token, data.refresh_token);
  localStorage.setItem('scde.user', JSON.stringify({ id: data.user.id, email, firstName: data.user.first_name, lastName: data.user.last_name, isStaff: false }));
  clearSubjectsCache();
}

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <ToastProvider>
          <AppRouter />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );

const A4 = { page_width: 595.28, page_height: 841.89 };

beforeEach(async () => {
  localStorage.clear();
  db.reset();
  await i18n.changeLanguage('es');
});

describe('zone geometry', () => {
  it('converts top-left fractions to bottom-left PDF points and back', () => {
    const box = { x: 0.1, y: 0.05, width: 0.6, height: 0.04 };
    const pdf = toPdfBox(box, A4);
    expect(pdf).toEqual({ x: 59.53, y: 766.12, width: 357.17, height: 33.68 });
    const back = fromPdfBox(pdf, A4);
    Object.entries(box).forEach(([k, v]) => expect(back[k]).toBeCloseTo(v, 3));
  });
});

describe('page profile and zone contract (mock = exam_service)', () => {
  it('creates profiles per page, replicates zones with page_numbers and deletes them', async () => {
    await loginAs('maria.perez@uam.es', 'prof123');
    const [seeded] = await api.get('/models/mdl-e-mat-p1/page-profiles/');
    expect(seeded).toMatchObject({ page_number: 1, ...A4 });
    expect(seeded.zones.map((z) => z.attribute)).toEqual(['exam_qr', 'name', 'nia']);
    await expect(api.post('/models/mdl-e-mat-p1/page-profiles/', { page_number: 1 })).rejects.toMatchObject({ status: 409, code: 'PAGE_PROFILE_EXISTS' });
    await expect(api.post('/models/mdl-e-mat-p1/page-profiles/', { page_number: 3 })).rejects.toMatchObject({ status: 409, code: 'INVALID_PAGE_NUMBER' });
    const p2 = await api.post('/models/mdl-e-mat-p1/page-profiles/', { page_number: 2 });
    expect(p2).toMatchObject({ page_number: 2, zones: [] });

    // QR zones always get attribute exam_qr; page_numbers replicates the zone.
    const created = await api.post(`/page-profiles/${p2.id}/zones/`, { zone_type: 'QR', attribute: 'x', x: 10, y: 10, width: 50, height: 50, page_numbers: [1, 2] });
    expect(created).toHaveLength(2);
    expect(created.every((z) => z.attribute === 'exam_qr')).toBe(true);
    await expect(api.post(`/page-profiles/${p2.id}/zones/`, { zone_type: 'CHECKBOX', attribute: 'q1', x: 590, y: 10, width: 20, height: 20 })).rejects.toMatchObject({ status: 400, code: 'ZONE_EXCEEDS_PAGE_WIDTH' });
    await expect(api.post(`/page-profiles/${p2.id}/zones/`, { zone_type: 'CHECKBOX', attribute: 'q1', x: 10, y: 10, width: 0, height: 20 })).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });

    await api.del(`/zones/${created[0].id}/`);
    const model = await api.get('/models/mdl-e-mat-p1/');
    expect(model.page_profiles.map((p) => p.zones.length)).toEqual([3, 1]);
  });

  it('needs a blank PDF and can_create_exams', async () => {
    await loginAs('maria.perez@uam.es', 'prof123');
    const exam = await api.post('/subjects/s-mat101/exams/', { name: 'Final' });
    const model = await api.post(`/exams/${exam.id}/models/`, { label: 'A' });
    await expect(api.post(`/models/${model.id}/page-profiles/`, { page_number: 1 })).rejects.toMatchObject({ code: 'NO_BLANK_PDF' });
    await loginAs('javier.ruiz@uam.es', 'prof123');
    await expect(api.get('/models/mdl-e-mat-p1/page-profiles/')).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
  });
});

describe('zone editor', () => {
  it('lists the seeded zones, configures page 2 and adds a zone in percentages', async () => {
    const user = userEvent.setup();
    await loginAs('maria.perez@uam.es', 'prof123');
    renderAt('/exams/e-mat-p1/setup');
    const section = (await screen.findByRole('heading', { name: 'Zonas de reconocimiento' })).closest('section');
    const zones = within(section);
    expect(await zones.findAllByText('nia')).toHaveLength(2); // preview + list
    expect(zones.getByText('x 10 % · y 11 % · 30 × 4 %')).toBeInTheDocument();

    await user.click(zones.getByRole('button', { name: 'Pág. 2' }));
    await user.click(zones.getByRole('button', { name: 'Configurar zonas de la página 2' }));
    expect(await zones.findByText('Esta página no tiene zonas todavía.')).toBeInTheDocument();

    await user.selectOptions(zones.getByLabelText('Tipo'), 'CHECKBOX');
    await user.type(zones.getByLabelText('Dato'), 'q1_a');
    await user.type(zones.getByLabelText('Izquierda (%)'), '90');
    await user.type(zones.getByLabelText('Arriba (%)'), '10');
    await user.type(zones.getByLabelText('Ancho (%)'), '20');
    await user.type(zones.getByLabelText('Alto (%)'), '5');
    expect(zones.getByText('La zona se sale de la página: revisa posición y tamaño.')).toBeInTheDocument();
    expect(zones.getByRole('button', { name: 'Añadir zona' })).toBeDisabled();
    await user.clear(zones.getByLabelText('Ancho (%)'));
    await user.type(zones.getByLabelText('Ancho (%)'), '5');
    await user.click(zones.getByRole('button', { name: 'Añadir zona' }));

    expect(await screen.findByText('Zona añadida')).toBeInTheDocument();
    await waitFor(() => expect(zones.getAllByText('q1_a')).toHaveLength(2));
    const z = db.zones.find((x) => x.attribute === 'q1_a');
    expect(z).toMatchObject({ zone_type: 'CHECKBOX', x: 535.75, width: 29.76, height: 42.09 });
    expect(z.y).toBeCloseTo(841.89 * 0.85, 1);

    await user.click(zones.getByRole('button', { name: 'Quitar la zona q1_a' }));
    expect(await screen.findByText('Zona eliminada')).toBeInTheDocument();
    expect(db.zones.some((x) => x.attribute === 'q1_a')).toBe(false);
  });
});
