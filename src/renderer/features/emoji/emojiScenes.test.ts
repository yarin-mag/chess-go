import { describe, expect, it } from 'vitest';
import { ANCH, DEFAULT_EMOJI_KIND, EMOJI_KINDS, EMOJI_SCENES, emojiScene } from './emojiScenes';

describe('EMOJI_SCENES', () => {
  it('has every scene from the design handoff\'s Emoji.dc.html', () => {
    expect(EMOJI_KINDS.length).toBe(77);
  });

  it('every actor references a piece type with an anchor entry', () => {
    const pieceTypes = new Set(Object.keys(ANCH));
    for (const scene of Object.values(EMOJI_SCENES)) {
      for (const actor of scene.a) expect(pieceTypes.has(actor.p)).toBe(true);
    }
  });

  it('the default fallback kind is itself a real scene', () => {
    expect(EMOJI_SCENES[DEFAULT_EMOJI_KIND]).toBeDefined();
  });
});

describe('emojiScene', () => {
  it('resolves a known kind', () => {
    expect(emojiScene('brilliant').a[0].p).toBe('Q');
  });

  it('falls back to the default kind for an unknown/malformed value — never throws', () => {
    expect(emojiScene('<script>alert(1)</script>')).toBe(EMOJI_SCENES[DEFAULT_EMOJI_KIND]);
    expect(emojiScene('')).toBe(EMOJI_SCENES[DEFAULT_EMOJI_KIND]);
  });
});
