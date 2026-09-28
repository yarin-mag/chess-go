import { describe, expect, it } from 'vitest';
import { randomRoomCode, REACTIONS, isKnownReaction } from './protocol';

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
  it('accepts every preset in REACTIONS', () => {
    for (const r of REACTIONS) expect(isKnownReaction(r)).toBe(true);
  });

  it('rejects text that is not in the preset list', () => {
    expect(isKnownReaction('<script>alert(1)</script>')).toBe(false);
    expect(isKnownReaction('Nice move! ')).toBe(false); // no fuzzy match — trailing space is a different string
    expect(isKnownReaction('')).toBe(false);
  });
});
