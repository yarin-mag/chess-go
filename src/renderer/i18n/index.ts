import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { useSettingsStore } from '@/features/settings/settingsStore';
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
import onlineEn from '@/locales/en/online.json';
import onlineHe from '@/locales/he/online.json';
import onlineEs from '@/locales/es/online.json';

// Read once at module load, before init, so the very first render already uses whatever locale was
// persisted from a previous session — waiting for a component (SettingsPanel) to mount and sync it would
// mean the app boots in English (i18next's own default) until the player happens to open Settings.
const persistedLocale = useSettingsStore.getState().locale;

i18n.use(initReactI18next).init({
  resources: {
    en: { common: commonEn, game: gameEn, tutor: tutorEn, stats: statsEn, puzzles: puzzlesEn, online: onlineEn },
    he: { common: commonHe, game: gameHe, tutor: tutorHe, stats: statsHe, puzzles: puzzlesHe, online: onlineHe },
    es: { common: commonEs, game: gameEs, tutor: tutorEs, stats: statsEs, puzzles: puzzlesEs, online: onlineEs },
  },
  lng: persistedLocale,
  fallbackLng: 'en',
  defaultNS: 'common',
  interpolation: { escapeValue: false }, // React already escapes; this avoids double-escaping
});

/** Never mirrors the chess board itself — only surrounding UI (see Board.module.css's explicit override). */
function applyDirection(locale: string): void {
  if (typeof document === 'undefined') return; // no DOM under Vitest's 'node' test environment
  document.documentElement.dir = locale === 'he' ? 'rtl' : 'ltr';
}

applyDirection(persistedLocale);

// The single place that reacts to settingsStore.locale changing — SettingsPanel just calls `update`,
// it doesn't need its own effect duplicating this sync.
useSettingsStore.subscribe((state) => {
  if (state.locale !== i18n.language) void i18n.changeLanguage(state.locale);
  applyDirection(state.locale);
});

export default i18n;
export const t = i18n.t.bind(i18n);
