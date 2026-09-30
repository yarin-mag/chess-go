import { useSavedGamesStore } from '@/features/history/savedGamesStore';
import { enqueueBackgroundAnalysis } from './backgroundAnalysisQueue';
import { humanColorsOf, useBlunderVaultStore } from './blunderVaultStore';

export const MAX_BACKFILL_GAMES = 20;

/** One-time, on-boot backfill: if the vault is empty but there's play history, seed it from the most
 *  recent saved games (each already has full replayable history) so returning players aren't starting
 *  from zero. No-ops instantly if the vault already has anything, or once `hasBackfilled` is set — the
 *  flag is set as soon as backfill is attempted, not only once it finds something, so a games set that
 *  happens to produce zero vault entries doesn't re-run this same 20-game analysis on every boot. */
export function backfillVaultIfEmpty(): void {
  const { entries, hasBackfilled, markBackfilled } = useBlunderVaultStore.getState();
  if (hasBackfilled || entries.length > 0) return;
  const { games } = useSavedGamesStore.getState();
  if (games.length === 0) return;
  markBackfilled();
  for (const game of games.slice(0, MAX_BACKFILL_GAMES)) {
    enqueueBackgroundAnalysis({
      sourceGameId: game.id,
      fen: game.config.fen,
      history: game.history,
      humanColors: humanColorsOf(game.config),
    });
  }
}
