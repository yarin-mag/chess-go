import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n, { t } from './index';

describe('i18n', () => {
  it('defaults to English', () => {
    expect(i18n.language).toBe('en');
    expect(t('common:menu')).toBe('☰ Menu');
  });

  it('switches language and translates through the new locale', async () => {
    await i18n.changeLanguage('es');
    expect(t('common:menu')).toBe('☰ Menú');
    await i18n.changeLanguage('en'); // restore for other tests in the same process
  });

  it('falls back to English for a locale missing a key', async () => {
    await i18n.changeLanguage('he');
    // 'menu' exists in every locale; this just proves fallbackLng is wired — a genuinely-missing-key
    // case isn't reachable once all three files are complete, so we assert the mechanism via config.
    expect(i18n.options.fallbackLng).toEqual(['en']);
    await i18n.changeLanguage('en');
  });

  describe('Hebrew pluralization', () => {
    afterEach(async () => {
      await i18n.changeLanguage('en');
    });

    // CLDR Hebrew has a distinct "two" plural category (Intl.PluralRules('he').select(2) === 'two'),
    // not just one/other — i18next looks up the `_two` suffix and, without it, silently falls through
    // fallbackLng to the *English* `_other` string. This pins both call sites that hit it in normal use.
    it('uses a dedicated form for count === 2, not the English fallback', async () => {
      await i18n.changeLanguage('he');
      const savedGames = t('online:savedGamesCount', { count: 2 });
      expect(savedGames).not.toMatch(/[a-zA-Z]/); // no Latin letters — i.e. not an English fallback string

      const reviewed = t('stats:gamesReviewed', { count: 2, moves: 10 });
      expect(reviewed).not.toMatch(/reviewed|graded/);
    });
  });

  describe('boot-time locale sync', () => {
    // document.documentElement.dir is exercised live (Task 7's browser verification), not here — this
    // suite runs under Vitest's 'node' environment (see vitest.config.mts), which has no `document` at
    // all; i18n/index.ts's boot sync guards that access accordingly (same pattern as test/setup.ts's
    // localStorage polyfill note).
    afterEach(() => {
      localStorage.removeItem('b-chess-settings');
    });

    it('applies a persisted locale before anything renders, not just on Settings mount', async () => {
      localStorage.setItem('b-chess-settings', JSON.stringify({ state: { locale: 'he' }, version: 0 }));
      vi.resetModules();
      const { default: freshI18n } = await import('./index');
      expect(freshI18n.language).toBe('he');
    });

    it('applies a persisted non-RTL locale the same way', async () => {
      localStorage.setItem('b-chess-settings', JSON.stringify({ state: { locale: 'es' }, version: 0 }));
      vi.resetModules();
      const { default: freshI18n } = await import('./index');
      expect(freshI18n.language).toBe('es');
    });
  });
});
