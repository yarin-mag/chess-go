import { create } from 'zustand';
import type { GameConfig } from '@/features/game/gameStore';
import type { MoveRecord } from '@/core/types';
import { analyzeGame, type MoveAnalysis } from './analyzeGame';

interface ReviewState {
  status: 'idle' | 'analyzing' | 'ready';
  config: GameConfig | null;
  history: MoveRecord[];
  progress: { done: number; total: number };
  analysis: MoveAnalysis[];
  index: number;
  start(config: GameConfig, history: MoveRecord[]): void;
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

  start(config, history) {
    abortController?.abort();
    const controller = new AbortController();
    abortController = controller;
    set({ status: 'analyzing', config, history, analysis: [], progress: { done: 0, total: history.length }, index: -1 });

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
