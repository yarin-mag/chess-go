import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { enqueueOfflineResult } from '@/features/sync/offlineQueueStore';
import { useAuthStore } from '@/features/auth/authStore';
import { nextStreak, todayString } from './streak';

export type RushDuration = '3' | '5';

interface PuzzleProgressState {
  furthestStage: number;
  furthestPuzzleIndex: number;
  solvedCount: number;
  currentStreak: number;
  longestStreak: number;
  /** 'YYYY-MM-DD' of the last day a puzzle was solved, or null before the first ever solve. */
  lastSolvedDate: string | null;
  /** Best Puzzle Rush score so far, per run duration (in minutes). */
  rushBest: Record<RushDuration, number>;
  /** Records a ladder solve and advances the "furthest reached" marker if (nextStage, nextPuzzleIndex) is further than before. */
  markSolved(nextStage: number, nextPuzzleIndex: number): void;
  /** Records a solve outside the ladder (the daily puzzle): counts toward the streak, doesn't move ladder progress. */
  recordDailySolve(): void;
  /** Records a Puzzle Rush run's score; returns true if it beat the previous best for that duration. */
  recordRushScore(duration: RushDuration, score: number): boolean;
}

const isFurther = (stage: number, index: number, curStage: number, curIndex: number) =>
  stage > curStage || (stage === curStage && index > curIndex);

export const usePuzzleProgressStore = create<PuzzleProgressState>()(
  persist(
    (set, get) => {
      /** Streak/solved-count bookkeeping shared by every kind of solve. */
      const bumpStreak = () => {
        const { solvedCount, currentStreak, longestStreak, lastSolvedDate } = get();
        const today = todayString();
        const streak = nextStreak(lastSolvedDate, today, currentStreak);
        set({
          solvedCount: solvedCount + 1,
          currentStreak: streak,
          longestStreak: Math.max(longestStreak, streak),
          lastSolvedDate: today,
        });
      };

      return {
        furthestStage: 0,
        furthestPuzzleIndex: 0,
        solvedCount: 0,
        currentStreak: 0,
        longestStreak: 0,
        lastSolvedDate: null,
        rushBest: { '3': 0, '5': 0 },

        markSolved(nextStage, nextPuzzleIndex) {
          const { furthestStage, furthestPuzzleIndex } = get();
          const further = isFurther(nextStage, nextPuzzleIndex, furthestStage, furthestPuzzleIndex);
          bumpStreak();
          set({
            furthestStage: further ? nextStage : furthestStage,
            furthestPuzzleIndex: further ? nextPuzzleIndex : furthestPuzzleIndex,
          });
          // Only a genuine advance is a real milestone — replaying an earlier puzzle (further === false)
          // isn't progress worth syncing, same spirit as gameStore.finish()'s offline-sync wiring.
          if (further && useAuthStore.getState().status === 'signedIn') {
            void enqueueOfflineResult({ kind: 'milestone', transcript: { stage: nextStage, puzzleIndex: nextPuzzleIndex } });
          }
        },

        recordDailySolve() {
          bumpStreak();
        },

        recordRushScore(duration, score) {
          const best = get().rushBest[duration];
          const isNewBest = score > best;
          if (isNewBest) set({ rushBest: { ...get().rushBest, [duration]: score } });
          return isNewBest;
        },
      };
    },
    { name: 'b-chess-puzzle-progress', storage: createJSONStorage(() => localStorage) },
  ),
);
