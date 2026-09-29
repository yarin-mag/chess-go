import { afterEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import {
  biggestWeakness,
  phaseBreakdown,
  phaseOf,
  tagFrequency,
  tierCounts,
  type RecordedGame,
} from './weaknessStats';

// A locale-switch test that throws before its own restore call would otherwise leave every later
// test in this file running against the wrong locale — restore unconditionally instead.
afterEach(async () => {
  if (i18n.language !== 'en') await i18n.changeLanguage('en');
});

const game = (id: string, moves: RecordedGame['moves']): RecordedGame => ({ id, playedAt: '2026-01-01T00:00:00.000Z', moves });

describe('phaseOf', () => {
  it('buckets by ply', () => {
    expect(phaseOf(0)).toBe('opening');
    expect(phaseOf(9)).toBe('opening');
    expect(phaseOf(10)).toBe('middlegame');
    expect(phaseOf(29)).toBe('middlegame');
    expect(phaseOf(30)).toBe('endgame');
    expect(phaseOf(80)).toBe('endgame');
  });
});

describe('tierCounts', () => {
  it('counts every move across every game', () => {
    const games = [
      game('a', [
        { ply: 0, tier: 'best', tags: ['solid'] },
        { ply: 1, tier: 'blunder', tags: ['hangsPiece'] },
      ]),
      game('b', [{ ply: 0, tier: 'best', tags: ['solid'] }]),
    ];
    expect(tierCounts(games)).toMatchObject({ best: 2, blunder: 1, good: 0 });
  });

  it('is all zero for no games', () => {
    expect(tierCounts([])).toEqual({ brilliant: 0, best: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 });
  });
});

describe('phaseBreakdown', () => {
  it('computes a mistake rate per phase', () => {
    const games = [
      game('a', [
        { ply: 1, tier: 'blunder', tags: [] }, // opening
        { ply: 2, tier: 'best', tags: [] }, // opening
        { ply: 35, tier: 'mistake', tags: [] }, // endgame
      ]),
    ];
    const stats = phaseBreakdown(games);
    const opening = stats.find((s) => s.phase === 'opening')!;
    const endgame = stats.find((s) => s.phase === 'endgame')!;
    const middlegame = stats.find((s) => s.phase === 'middlegame')!;
    expect(opening.totalMoves).toBe(2);
    expect(opening.mistakeCount).toBe(1);
    expect(opening.mistakeRate).toBeCloseTo(0.5);
    expect(endgame.mistakeRate).toBe(1);
    expect(middlegame.totalMoves).toBe(0);
    expect(middlegame.mistakeRate).toBe(0); // no NaN from a 0/0 division
  });
});

describe('tagFrequency', () => {
  it('only counts tags from mistakes and blunders, most frequent first', () => {
    const games = [
      game('a', [
        { ply: 0, tier: 'best', tags: ['solid'] }, // not a mistake, excluded
        { ply: 1, tier: 'blunder', tags: ['hangsPiece'] },
        { ply: 2, tier: 'mistake', tags: ['hangsPiece'] },
        { ply: 3, tier: 'mistake', tags: ['ignoresCenter'] },
      ]),
    ];
    expect(tagFrequency(games)).toEqual([
      { tag: 'hangsPiece', count: 2 },
      { tag: 'ignoresCenter', count: 1 },
    ]);
  });
});

describe('biggestWeakness', () => {
  it('is null with too little data', () => {
    const games = [game('a', [{ ply: 0, tier: 'blunder', tags: ['hangsPiece'] }])];
    expect(biggestWeakness(games)).toBeNull();
  });

  it('names the worst phase and most common tag once there is enough data', () => {
    const moves: RecordedGame['moves'] = [];
    for (let i = 0; i < 10; i++) moves.push({ ply: i, tier: i < 4 ? 'blunder' : 'best', tags: i < 4 ? ['hangsPiece'] : [] });
    const summary = biggestWeakness([game('a', moves)]);
    expect(summary).toContain('Opening'); // stats:phase_opening is capitalized, unlike the internal GamePhase literal
    expect(summary).toContain('hanging');
  });

  it('is null when there is enough data but no mistakes at all', () => {
    const moves: RecordedGame['moves'] = Array.from({ length: 8 }, (_, i) => ({ ply: i, tier: 'best', tags: ['solid'] }));
    expect(biggestWeakness([game('a', moves)])).toBeNull();
  });

  it('composes the insight sentence through the active locale', async () => {
    const { default: i18n } = await import('@/i18n');
    const moves: RecordedGame['moves'] = [];
    for (let i = 0; i < 10; i++) moves.push({ ply: i, tier: i < 4 ? 'blunder' : 'best', tags: i < 4 ? ['hangsPiece'] : [] });
    const games = [game('a', moves)];
    const sentence = biggestWeakness(games)!;
    expect(sentence).toContain('struggle most');
    await i18n.changeLanguage('es');
    expect(biggestWeakness(games)).toContain('mayor dificultad');
    await i18n.changeLanguage('en');
  });
});
