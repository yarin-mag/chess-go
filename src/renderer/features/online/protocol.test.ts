import { describe, expect, it } from 'vitest';
import { EMOJI_KINDS } from '@/features/emoji/emojiScenes';
import {
  randomRoomCode,
  REACTION_KEYS,
  isKnownReaction,
  EMOJI_REACTION_KEYS,
  PHRASE_REACTION_KEYS,
  SCENE_REACTION_KEYS,
  emojiSceneForReaction,
  sanitizeChatText,
  MAX_CHAT_LENGTH,
} from './protocol';

describe('randomRoomCode', () => {
  it('is 6 characters of A-Z and 0-9', () => {
    for (let i = 0; i < 50; i++) expect(randomRoomCode()).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('is not the same every time', () => {
    const codes = new Set(Array.from({ length: 20 }, () => randomRoomCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe('isKnownReaction', () => {
  it('accepts every key in REACTION_KEYS', () => {
    for (const k of REACTION_KEYS) expect(isKnownReaction(k)).toBe(true);
  });

  it('rejects anything not in the key list — including old-style display text', () => {
    expect(isKnownReaction('<script>alert(1)</script>')).toBe(false);
    expect(isKnownReaction('Nice move!')).toBe(false); // display text, not a key — the old wire format
    expect(isKnownReaction('')).toBe(false);
  });
});

describe('EMOJI_REACTION_KEYS / PHRASE_REACTION_KEYS', () => {
  it('partition REACTION_KEYS exactly, with no overlap', () => {
    const union = [...EMOJI_REACTION_KEYS, ...PHRASE_REACTION_KEYS].sort();
    expect(union).toEqual([...REACTION_KEYS].sort());
    const overlap = EMOJI_REACTION_KEYS.filter((k) => (PHRASE_REACTION_KEYS as readonly string[]).includes(k));
    expect(overlap).toEqual([]);
  });
});

describe('SCENE_REACTION_KEYS / emojiSceneForReaction', () => {
  it('every scene reaction key is a real REACTION_KEYS entry', () => {
    for (const key of SCENE_REACTION_KEYS) expect(isKnownReaction(key)).toBe(true);
  });

  it('every scene reaction key resolves to a real emoji scene', () => {
    for (const key of SCENE_REACTION_KEYS) {
      const scene = emojiSceneForReaction(key);
      expect(scene).toBeDefined();
      expect(EMOJI_KINDS).toContain(scene);
    }
  });

  it('a non-scene reaction key (e.g. a text phrase) has no emoji scene', () => {
    expect(emojiSceneForReaction('niceMove')).toBeUndefined();
  });
});

describe('sanitizeChatText', () => {
  it('trims whitespace and passes normal text through', () => {
    expect(sanitizeChatText('  gg, well played  ')).toBe('gg, well played');
  });

  it('rejects non-strings, empty strings, and whitespace-only strings', () => {
    expect(sanitizeChatText(undefined)).toBeNull();
    expect(sanitizeChatText(null)).toBeNull();
    expect(sanitizeChatText(42)).toBeNull();
    expect(sanitizeChatText({ text: 'gg' })).toBeNull();
    expect(sanitizeChatText('')).toBeNull();
    expect(sanitizeChatText('   ')).toBeNull();
  });

  it('truncates to MAX_CHAT_LENGTH', () => {
    const result = sanitizeChatText('a'.repeat(MAX_CHAT_LENGTH + 50));
    expect(result).toHaveLength(MAX_CHAT_LENGTH);
  });

  it('strips control characters a hostile peer could send', () => {
    expect(sanitizeChatText('hi\x00\x07there')).toBe('hithere');
  });
});
