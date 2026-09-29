import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import commonEn from '@/locales/en/common.json';
import commonHe from '@/locales/he/common.json';
import commonEs from '@/locales/es/common.json';
import gameEn from '@/locales/en/game.json';
import gameHe from '@/locales/he/game.json';
import gameEs from '@/locales/es/game.json';

i18n.use(initReactI18next).init({
  resources: {
    en: { common: commonEn, game: gameEn },
    he: { common: commonHe, game: gameHe },
    es: { common: commonEs, game: gameEs },
  },
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  interpolation: { escapeValue: false }, // React already escapes; this avoids double-escaping
});

export default i18n;
export const t = i18n.t.bind(i18n);
