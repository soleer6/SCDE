import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { features } from './registry.js';
import commonEs from './locales/es.json';
import commonEn from './locales/en.json';

/* Namespaces: 'common' (shell, errors) + one per feature (feature.id). */
const resources = { es: { common: commonEs }, en: { common: commonEn } };
features.forEach((f) => {
  if (!f.i18n) return;
  Object.entries(f.i18n).forEach(([lng, dict]) => {
    resources[lng] = resources[lng] || {};
    resources[lng][f.id] = dict;
  });
});

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'es',
    supportedLngs: ['es', 'en'],
    defaultNS: 'common',
    ns: ['common', ...features.map((f) => f.id)],
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage', 'navigator'], lookupLocalStorage: 'scde.lang', caches: ['localStorage'] },
  });

export default i18n;
