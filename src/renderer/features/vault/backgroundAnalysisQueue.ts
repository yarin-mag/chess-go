import type { Color, MoveRecord } from '@/core/types';
import { analyzeGame } from '@/features/review/analyzeGame';
import { setCachedAnalysis } from '@/features/review/analysisCache';
import { extractVaultEntries, useBlunderVaultStore } from './blunderVaultStore';

interface QueueItem {
  sourceGameId: string;
  fen: string | undefined;
  history: MoveRecord[];
  /** Which color(s) the human actually played — never the computer's or an opponent's mistakes. */
  humanColors: Color[];
}

let controller: AbortController | null = null;
let queue: QueueItem[] = [];
let running = false;

/** Cancels any in-flight or still-queued background analysis. Called before any foreground engine use
 *  (a new game, opening Review, opening a vault puzzle) so background work never competes with it. Once a
 *  review is `'ready'` (the only time exploring a move is possible), its own `reviewStore.start()` call
 *  already cleared the queue — exploring never needs its own abort call. */
export function abortBackgroundAnalysis(): void {
  controller?.abort();
  controller = null;
  queue = [];
  running = false;
}

export function enqueueBackgroundAnalysis(item: QueueItem): void {
  queue.push(item);
  void runNext();
}

async function runNext(): Promise<void> {
  if (running || queue.length === 0) return;
  running = true;
  const item = queue.shift()!;
  const localController = new AbortController();
  controller = localController;
  try {
    const analysis = await analyzeGame(item.fen, item.history, () => {}, localController.signal);
    if (localController.signal.aborted) return;
    // This is the only place this exact analysis ever gets computed for this game — caching it here is
    // what lets Review reuse it instead of recomputing it from scratch when opened later.
    setCachedAnalysis(item.sourceGameId, analysis);
    const entries = extractVaultEntries(item.sourceGameId, analysis, item.humanColors);
    if (entries.length > 0) useBlunderVaultStore.getState().addEntries(entries);
  } catch {
    // Aborted, or a worker error mid-analysis — a background run silently contributing nothing is fine,
    // the same tolerance reviewStore.start()'s own analyzeGame().catch() already has.
  } finally {
    running = false;
    if (controller === localController) controller = null;
    void runNext();
  }
}
