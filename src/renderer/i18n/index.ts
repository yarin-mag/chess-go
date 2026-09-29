import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import commonEn from '@/locales/en/common.json';
import commonHe from '@/locales/he/common.json';
import commonEs from '@/locales/es/common.json';
import gameEn from '@/locales/en/game.json';
import gameHe from '@/locales/he/game.json';
import gameEs from '@/locales/es/game.json';
import tutorEn from '@/locales/en/tutor.json';
import tutorHe from '@/locales/he/tutor.json';
import tutorEs from '@/locales/es/tutor.json';

i18n.use(initReactI18next).init({
  resources: {
    en: { common: commonEn, game: gameEn, tutor: tutorEn },
    he: { common: commonHe, game: gameHe, tutor: tutorHe },
    es: { common: commonEs, game: gameEs, tutor: tutorEs },
  },
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  interpolation: { escapeValue: false }, // React already escapes; this avoids double-escaping
});

export default i18n;
export const t = i18n.t.bind(i18n);
