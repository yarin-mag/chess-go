import { describe, expect, it, beforeEach } from 'vitest';
import { useBlunderVaultStore, type VaultEntry } from './blunderVaultStore';

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
  useBlunderVaultStore.setState({ entries: [], solvedIds: [] });
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
