import { useSavedGamesStore } from '@/features/history/savedGamesStore';
import { enqueueBackgroundAnalysis } from './backgroundAnalysisQueue';
import { useBlunderVaultStore } from './blunderVaultStore';

export const MAX_BACKFILL_GAMES = 20;

/** One-time, on-boot backfill: if the vault is empty but there's play history, seed it from the most
 *  recent saved games (each already has full replayable history) so returning players aren't starting
 *  from zero. No-ops instantly if the vault already has anything — never re-backfills. */
export function backfillVaultIfEmpty(): void {
  const { entries } = useBlunderVaultStore.getState();
  if (entries.length > 0) return;
  const { games } = useSavedGamesStore.getState();
  if (games.length === 0) return;
  for (const game of games.slice(0, MAX_BACKFILL_GAMES)) {
    enqueueBackgroundAnalysis({ sourceGameId: game.id, fen: game.config.fen, history: game.history });
  }
}
