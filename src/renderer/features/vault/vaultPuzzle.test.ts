import { describe, expect, it } from 'vitest';
import { toPuzzleData } from './vaultPuzzle';
import type { VaultEntry } from './blunderVaultStore';

const entry: VaultEntry = {
  id: 'game-1-4',
  sourceGameId: 'game-1',
  ply: 4,
  fenBefore: '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1',
  bestMove: { from: 'a1', to: 'a8' },
  bestSan: 'Ra8#',
  playedSan: 'Kd2',
  tier: 'blunder',
  tags: ['missedMate'],
  capturedAt: '2026-09-30T00:00:00.000Z',
};

describe('toPuzzleData', () => {
  it('carries the position and a single-move solution ending immediately (no forced opponent reply)', () => {
    const puzzle = toPuzzleData(entry);
    expect(puzzle.fen).toBe(entry.fenBefore);
    expect(puzzle.solution).toEqual(['a1a8']);
    expect(puzzle.id).toBe(entry.id);
  });

  it('encodes a promotion move in the UCI solution', () => {
    const promo: VaultEntry = { ...entry, bestMove: { from: 'a7', to: 'a8', promotion: 'q' } };
    expect(toPuzzleData(promo).solution).toEqual(['a7a8q']);
  });
});
