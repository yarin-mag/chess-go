import { describe, expect, it } from 'vitest';
import { randomRoomCode, REACTION_KEYS, isKnownReaction } from './protocol';

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
