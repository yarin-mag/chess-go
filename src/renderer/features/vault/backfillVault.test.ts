import { describe, expect, it, vi, afterEach } from 'vitest';

vi.mock('./backgroundAnalysisQueue', () => ({ enqueueBackgroundAnalysis: vi.fn() }));

import { enqueueBackgroundAnalysis } from './backgroundAnalysisQueue';
import { useBlunderVaultStore } from './blunderVaultStore';
import { useSavedGamesStore } from '@/features/history/savedGamesStore';
import type { SavedGame } from '@/features/history/savedGamesStore';
import { UNTIMED } from '@/features/clock/presets';
import { backfillVaultIfEmpty, MAX_BACKFILL_GAMES } from './backfillVault';

const savedGame = (id: string): SavedGame => ({
  id,
  playedAt: '2026-01-01T00:00:00.000Z',
  config: { white: { type: 'human' as const }, black: { type: 'human' as const }, timeControl: UNTIMED },
  history: [{ from: 'e2', to: 'e4', san: 'e4', color: 'w' as const, fen: 'fen', flags: '', piece: 'p' as const }],
  result: { kind: 'checkmate' as const, winner: 'w' as const },
});

afterEach(() => {
  useBlunderVaultStore.setState({ entries: [], solvedIds: [] });
  useSavedGamesStore.setState({ games: [] });
  vi.mocked(enqueueBackgroundAnalysis).mockReset();
});

describe('backfillVaultIfEmpty', () => {
  it('does nothing when the vault already has entries', () => {
    useBlunderVaultStore.setState({ entries: [{ id: 'x' } as never], solvedIds: [] });
    useSavedGamesStore.setState({ games: [savedGame('a')] });
    backfillVaultIfEmpty();
    expect(enqueueBackgroundAnalysis).not.toHaveBeenCalled();
  });

  it('does nothing when there are no saved games', () => {
    backfillVaultIfEmpty();
    expect(enqueueBackgroundAnalysis).not.toHaveBeenCalled();
  });

  it('enqueues up to MAX_BACKFILL_GAMES most-recent saved games when the vault is empty', () => {
    const games = Array.from({ length: MAX_BACKFILL_GAMES + 5 }, (_, i) => savedGame(`g${i}`));
    useSavedGamesStore.setState({ games });
    backfillVaultIfEmpty();
    expect(enqueueBackgroundAnalysis).toHaveBeenCalledTimes(MAX_BACKFILL_GAMES);
    expect(vi.mocked(enqueueBackgroundAnalysis).mock.calls[0][0].sourceGameId).toBe('g0');
  });
});
