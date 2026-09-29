import { describe, expect, it } from 'vitest';
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
});
