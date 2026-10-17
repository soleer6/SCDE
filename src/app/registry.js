/* Feature registry.
 *
 * Every folder src/features/<id>/ exposes an index.jsx whose default export is:
 *
 *   {
 *     id: 'admin',                       // also the i18n namespace
 *     order: 50,                         // nav ordering
 *     routes: [{ path, element, guard }],// guard: 'public' | 'auth' (default) | 'staff'
 *     nav: [{ to, label: 'admin:nav.users', section: 'work'|'manage'|'account', when?: (session) => bool }],
 *     mocks: [{ method, path, handler, auth? }],
 *     i18n: { es: {...}, en: {...} },
 *     slots: { 'topbar.end': Component }, // optional UI slots rendered by the shell
 *   }
 *
 * Features are discovered automatically: adding a feature never requires
 * editing a shared file. This is what lets two agents work in parallel.
 */
import { registerMocks } from '../lib/mock/router.js';

const modules = import.meta.glob('../features/*/index.jsx', { eager: true });

export const features = Object.values(modules)
  .map((m) => m.default)
  .filter(Boolean)
  .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));

features.forEach((f) => registerMocks(f.mocks ?? [], f.id));

export const allRoutes = features.flatMap((f) => (f.routes ?? []).map((r) => ({ ...r, feature: f.id })));

export function navFor(session) {
  return features
    .flatMap((f) => f.nav ?? [])
    .filter((n) => !n.when || (session && n.when(session)));
}

export function slot(name) {
  return features.map((f) => f.slots?.[name]).filter(Boolean);
}
