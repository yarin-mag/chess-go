import { describe, expect, it, beforeEach } from 'vitest';
import { extractVaultEntries, useBlunderVaultStore, type VaultEntry } from './blunderVaultStore';
import type { MoveAnalysis } from '@/features/review/analyzeGame';

const analysisMove = (
  ply: number,
  color: 'w' | 'b',
  tier: VaultEntry['tier'],
): Pick<MoveAnalysis, 'ply' | 'fenBefore' | 'bestMove' | 'bestSan' | 'move' | 'tier' | 'tags'> => ({
  ply,
  fenBefore: `fen-${ply}`,
  bestMove: { from: 'a1', to: 'a8' },
  bestSan: 'Ra8#',
  move: { from: 'h2', to: 'h3', san: 'h3', color, piece: 'p', flags: 'n', fen: `after-${ply}` } as MoveAnalysis['move'],
  tier,
  tags: [],
});

const entry = (id: string, fenBefore = '6k1/8/8/8/8/8/8/6K1 w - - 0 1'): VaultEntry => ({
  id,
  sourceGameId: 'game-1',
  ply: 4,
  fenBefore,
  bestMove: { from: 'a1', to: 'a8' },
  bestSan: 'Ra8#',
  playedSan: 'Kh2',
  tier: 'blunder',
  tags: ['missedMate'],
  capturedAt: '2026-09-30T00:00:00.000Z',
});

beforeEach(() => {
  useBlunderVaultStore.setState({ entries: [], solvedIds: [], hasBackfilled: false });
});

describe('extractVaultEntries', () => {
  it('keeps only blunder/mistake-tier moves played by one of the human colors', () => {
    const analysis = [
      analysisMove(0, 'w', 'blunder'), // human (white) blunder — kept
      analysisMove(1, 'b', 'blunder'), // opponent (black) blunder — dropped
      analysisMove(2, 'w', 'good'), // human but not a mistake tier — dropped
    ];
    const entries = extractVaultEntries('game-1', analysis, ['w']);
    expect(entries.map((e) => e.ply)).toEqual([0]);
  });

  it('keeps both colors for a local human-vs-human game', () => {
    const analysis = [analysisMove(0, 'w', 'mistake'), analysisMove(1, 'b', 'blunder')];
    const entries = extractVaultEntries('game-1', analysis, ['w', 'b']);
    expect(entries.map((e) => e.ply)).toEqual([0, 1]);
  });
});

describe('addEntries', () => {
  it('adds new entries, most recent first', () => {
    useBlunderVaultStore.getState().addEntries([entry('a', 'fen-a')]);
    useBlunderVaultStore.getState().addEntries([entry('b', 'fen-b')]);
    expect(useBlunderVaultStore.getState().entries.map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('dedupes by fenBefore — the same position is never stored twice', () => {
    useBlunderVaultStore.getState().addEntries([entry('a', 'fen-1')]);
    useBlunderVaultStore.getState().addEntries([entry('b', 'fen-1')]);
    expect(useBlunderVaultStore.getState().entries).toHaveLength(1);
    expect(useBlunderVaultStore.getState().entries[0].id).toBe('a'); // first one wins
  });

  it('caps at MAX_VAULT_ENTRIES, evicting the oldest', () => {
    const many = Array.from({ length: 65 }, (_, i) => entry(`e${i}`, `fen-${i}`));
    useBlunderVaultStore.getState().addEntries(many);
    const state = useBlunderVaultStore.getState();
    expect(state.entries).toHaveLength(60);
    expect(state.entries[0].id).toBe('e64'); // most recent kept
    expect(state.entries.find((e) => e.id === 'e0')).toBeUndefined(); // oldest evicted
  });

  it('prunes solvedIds for entries evicted by the cap, so localStorage never grows unbounded', () => {
    useBlunderVaultStore.getState().addEntries([entry('old', 'fen-old')]);
    useBlunderVaultStore.getState().markSolved('old');
    const many = Array.from({ length: 60 }, (_, i) => entry(`e${i}`, `fen-${i}`));
    useBlunderVaultStore.getState().addEntries(many); // evicts 'old' — it's now the 61st-oldest
    expect(useBlunderVaultStore.getState().solvedIds).not.toContain('old');
  });
});

describe('markSolved / pickNext', () => {
  it('prefers an unsolved entry', () => {
    useBlunderVaultStore.getState().addEntries([entry('a'), entry('b', 'fen-2')]);
    useBlunderVaultStore.getState().markSolved('a');
    expect(useBlunderVaultStore.getState().pickNext()?.id).toBe('b');
  });

  it('falls back to any entry once everything is solved', () => {
    useBlunderVaultStore.getState().addEntries([entry('a')]);
    useBlunderVaultStore.getState().markSolved('a');
    expect(useBlunderVaultStore.getState().pickNext()?.id).toBe('a');
  });

  it('returns null with no entries at all', () => {
    expect(useBlunderVaultStore.getState().pickNext()).toBeNull();
  });
});

describe('clear', () => {
  it('empties entries and solvedIds', () => {
    useBlunderVaultStore.getState().addEntries([entry('a')]);
    useBlunderVaultStore.getState().markSolved('a');
    useBlunderVaultStore.getState().clear();
    expect(useBlunderVaultStore.getState().entries).toEqual([]);
    expect(useBlunderVaultStore.getState().solvedIds).toEqual([]);
  });
});

describe('markBackfilled', () => {
  it('records that the one-time backfill ran, so it is never attempted again', () => {
    expect(useBlunderVaultStore.getState().hasBackfilled).toBe(false);
    useBlunderVaultStore.getState().markBackfilled();
    expect(useBlunderVaultStore.getState().hasBackfilled).toBe(true);
  });
});
