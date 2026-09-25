import { describe, expect, it } from 'vitest';
import { lookupOpening } from './openings';

describe('lookupOpening', () => {
  it('finds an exact opening sequence', () => {
    const result = lookupOpening(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5']);
    expect(result?.name).toMatch(/Ruy Lopez/i);
  });

  it('falls back to the longest known prefix', () => {
    const short = lookupOpening(['e2e4', 'e7e5']);
    const longer = lookupOpening(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6']);
    expect(longer?.eco).toBeTruthy();
    expect(short?.eco).toBeTruthy();
  });

  it('falls back to a shorter known prefix rather than failing outright', () => {
    // Every first move is catalogued (ECO A00 covers irregular openings), so even an odd continuation
    // still resolves — to the longest prefix that IS book, not necessarily the full sequence.
    const result = lookupOpening(['a2a3', 'a7a6', 'h2h4', 'h7h5', 'a1a2']);
    expect(result?.eco).toBeTruthy();
  });

  it('returns null for an empty sequence', () => {
    expect(lookupOpening([])).toBeNull();
  });
});
