import { afterEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { reactionText } from './useOnlineSync';

// A locale-switch test that throws before its own restore call would otherwise leave every later
// test in this file running against the wrong locale — restore unconditionally instead.
afterEach(async () => {
  if (i18n.language !== 'en') await i18n.changeLanguage('en');
});

describe('reactionText (the receive path useOnlineSync.ts calls for every incoming reaction)', () => {
  it('resolves a known key in the receiver-side active locale, independent of what the sender used', async () => {
    // The wire only ever carries the key ('niceMove') — this proves the receiver renders it in *their
    // own* locale, which is the entire reason REACTIONS (display text) became REACTION_KEYS (a key).
    expect(reactionText('niceMove')).toBe('Nice move!');
    await i18n.changeLanguage('es');
    expect(reactionText('niceMove')).toBe('¡Buena jugada!');
    await i18n.changeLanguage('he');
    expect(reactionText('niceMove')).toBe('מהלך יפה!');
  });

  it('returns null for a key that is not a known preset — never renders raw untrusted peer text', () => {
    expect(reactionText('<script>alert(1)</script>')).toBeNull();
    expect(reactionText('')).toBeNull();
    expect(reactionText('Nice move!')).toBeNull(); // display text, not a key — the old wire format
  });
});
