import { describe, expect, it } from 'vitest';
import { BOARD_CATALOGUE, CRATE_ODDS, boardCatalogueEntry, rollCrate } from './catalogue';

describe('CRATE_ODDS', () => {
  it('sums to 100%', () => {
    expect(CRATE_ODDS.reduce((sum, o) => sum + o.percent, 0)).toBe(100);
  });
});

describe('boardCatalogueEntry', () => {
  it('finds an entry by theme', () => {
    expect(boardCatalogueEntry('gilded')?.rarity).toBe('legendary');
  });

  it('returns undefined for a theme not in the shop (e.g. a free default theme)', () => {
    expect(boardCatalogueEntry('classic')).toBeUndefined();
  });
});

describe('rollCrate', () => {
  it('always returns a catalogue entry', () => {
    for (let i = 0; i < 200; i++) {
      expect(BOARD_CATALOGUE).toContainEqual(rollCrate([], Math.random));
    }
  });

  it('reaches more than one rarity tier as the rng sweeps 0..1', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) seen.add(rollCrate([], () => i / 100).rarity);
    expect(seen.size).toBeGreaterThan(1);
  });

  it('excludes an owned board from its tier while an unowned one is still available', () => {
    // uncommon = [walnut, jade]; owning walnut must make every uncommon-tier roll land on jade.
    for (let i = 0; i < 50; i++) {
      const entry = rollCrate(['walnut'], Math.random);
      if (entry.rarity === 'uncommon') expect(entry.theme).toBe('jade');
    }
  });

  it('falls back to an owned board once every board in the rolled tier is owned', () => {
    const allUncommon = BOARD_CATALOGUE.filter((e) => e.rarity === 'uncommon').map((e) => e.theme);
    const entry = rollCrate(allUncommon, () => 0.3); // lands in the uncommon band (tiers renormalize once 'common' has no boards)
    expect(entry.rarity).toBe('uncommon'); // still returns a board, not nothing, once all are owned
  });
});
