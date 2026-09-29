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
import statsEn from '@/locales/en/stats.json';
import statsHe from '@/locales/he/stats.json';
import statsEs from '@/locales/es/stats.json';
import puzzlesEn from '@/locales/en/puzzles.json';
import puzzlesHe from '@/locales/he/puzzles.json';
import puzzlesEs from '@/locales/es/puzzles.json';

i18n.use(initReactI18next).init({
  resources: {
    en: { common: commonEn, game: gameEn, tutor: tutorEn, stats: statsEn, puzzles: puzzlesEn },
    he: { common: commonHe, game: gameHe, tutor: tutorHe, stats: statsHe, puzzles: puzzlesHe },
    es: { common: commonEs, game: gameEs, tutor: tutorEs, stats: statsEs, puzzles: puzzlesEs },
  },
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  interpolation: { escapeValue: false }, // React already escapes; this avoids double-escaping
});

export default i18n;
export const t = i18n.t.bind(i18n);
