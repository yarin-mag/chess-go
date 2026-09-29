import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import commonEn from '@/locales/en/common.json';
import commonHe from '@/locales/he/common.json';
import commonEs from '@/locales/es/common.json';

i18n.use(initReactI18next).init({
  resources: {
    en: { common: commonEn },
    he: { common: commonHe },
    es: { common: commonEs },
  },
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  interpolation: { escapeValue: false }, // React already escapes; this avoids double-escaping
});

export default i18n;
export const t = i18n.t.bind(i18n);
