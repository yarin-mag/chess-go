import { create } from 'zustand';
import type { GameConfig } from '@/features/game/gameStore';
import type { MoveRecord } from '@/core/types';
import { useGameHistoryStore } from '@/features/history/gameHistoryStore';
import { abortBackgroundAnalysis } from '@/features/vault/backgroundAnalysisQueue';
import { getCachedAnalysis, setCachedAnalysis } from './analysisCache';
import { analyzeGame, type MoveAnalysis } from './analyzeGame';

interface StartOptions {
  /** False for a session that isn't a real played game (e.g. Opening Explorer's "Watch") — skips the weakness-dashboard log. */
  recordStats?: boolean;
  /** The saved game's own id — when given and already analyzed (backgroundAnalysisQueue computes this
   *  for every finished game, for the blunder vault), reuses that analysis instead of recomputing it
   *  from scratch, and caches a freshly computed one under this id for next time. */
  sourceGameId?: string;
}

interface ReviewState {
  status: 'idle' | 'analyzing' | 'ready';
  config: GameConfig | null;
  history: MoveRecord[];
  progress: { done: number; total: number };
  analysis: MoveAnalysis[];
  index: number;
  start(config: GameConfig, history: MoveRecord[], options?: StartOptions): void;
  goTo(index: number): void;
  next(): void;
  prev(): void;
  exit(): void;
}

let abortController: AbortController | null = null;

export const useReviewStore = create<ReviewState>((set, get) => ({
  status: 'idle',
  config: null,
  history: [],
  progress: { done: 0, total: 0 },
  analysis: [],
  index: -1,

  start(config, history, options = {}) {
    abortBackgroundAnalysis();
    const recordStats = options.recordStats ?? true;
    abortController?.abort();
    const controller = new AbortController();
    abortController = controller;
    // Show the final position immediately (what the player just experienced) rather than freezing on the
    // start position for the whole analysis; the tutor panel's per-move text fills in once grading is done.
    set({
      status: 'analyzing',
      config,
      history,
      analysis: [],
      progress: { done: 0, total: history.length },
      index: history.length - 1,
    });

    const cached = options.sourceGameId ? getCachedAnalysis(options.sourceGameId) : undefined;
    if (cached) {
      set({ status: 'ready', analysis: cached, progress: { done: history.length, total: history.length }, index: history.length - 1 });
      if (recordStats && cached.length > 0) {
        useGameHistoryStore.getState().recordGame(cached.map((a) => ({ ply: a.ply, tier: a.tier, tags: a.tags })));
      }
      return;
    }

    analyzeGame(
      config.fen,
      history,
      (done, total) => {
        if (controller.signal.aborted) return;
        set({ progress: { done, total } });
      },
      controller.signal,
    )
      .then((analysis) => {
        if (controller.signal.aborted) return;
        set({ status: 'ready', analysis, index: history.length - 1 });
        if (options.sourceGameId) setCachedAnalysis(options.sourceGameId, analysis);
        if (recordStats && analysis.length > 0) {
          useGameHistoryStore
            .getState()
            .recordGame(analysis.map((a) => ({ ply: a.ply, tier: a.tier, tags: a.tags })));
        }
      })
      .catch(() => {
        // Aborted by a new start() or exit() — nothing to report.
      });
  },

  goTo(index) {
    const max = get().history.length - 1;
    set({ index: Math.max(-1, Math.min(max, index)) });
  },

  next() {
    get().goTo(get().index + 1);
  },

  prev() {
    get().goTo(get().index - 1);
  },

  exit() {
    abortController?.abort();
    abortController = null;
    set({ status: 'idle', config: null, history: [], analysis: [], progress: { done: 0, total: 0 }, index: -1 });
  },
}));
