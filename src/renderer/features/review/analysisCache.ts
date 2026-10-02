import type { MoveAnalysis } from './analyzeGame';

/**
 * In-memory cache of a finished game's full move-by-move analysis, keyed by its saved-game id.
 * backgroundAnalysisQueue already runs this exact analysis once, right after every game ends, to find
 * blunder-vault entries — without this cache, opening Review for that same game (right away, or later
 * from Saved Games) threw that work away and recomputed it from scratch, every single time it was
 * opened. Deliberately not persisted: it only needs to survive within a session, and a full analysis
 * payload for every one of up to 100 saved games would be a meaningfully larger localStorage write than
 * anything else this app persists.
 */
const cache = new Map<string, MoveAnalysis[]>();

export function getCachedAnalysis(gameId: string): MoveAnalysis[] | undefined {
  return cache.get(gameId);
}

export function setCachedAnalysis(gameId: string, analysis: MoveAnalysis[]): void {
  cache.set(gameId, analysis);
}

export function clearAnalysisCache(): void {
  cache.clear();
}
