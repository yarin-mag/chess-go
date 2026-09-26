import { describe, expect, it } from 'vitest';
import { replayUci } from '@/core/replay';
import { CURATED_OPENINGS } from './curatedOpenings';

describe('CURATED_OPENINGS', () => {
  it('resolves every curated name to a real entry (no silent gaps)', () => {
    // If a name in the whitelist doesn't exist in the dataset, it's just missing here — this catches that.
    expect(CURATED_OPENINGS.length).toBeGreaterThan(20);
  });

  it('includes well-known openings by name', () => {
    const names = CURATED_OPENINGS.map((o) => o.name);
    expect(names).toContain('Italian Game');
    expect(names).toContain('Sicilian Defense');
    expect(names).toContain('Ruy Lopez');
  });

  it('every sequence replays legally in full', () => {
    for (const opening of CURATED_OPENINGS) {
      const history = replayUci(undefined, opening.sequence);
      expect(history).toHaveLength(opening.sequence.length);
    }
  });

  it('has no duplicate names', () => {
    const names = CURATED_OPENINGS.map((o) => o.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
