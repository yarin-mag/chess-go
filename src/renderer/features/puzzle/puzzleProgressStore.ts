import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { nextStreak, todayString } from './streak';

interface PuzzleProgressState {
  furthestStage: number;
  furthestPuzzleIndex: number;
  solvedCount: number;
  currentStreak: number;
  longestStreak: number;
  /** 'YYYY-MM-DD' of the last day a puzzle was solved, or null before the first ever solve. */
  lastSolvedDate: string | null;
  /** Records a ladder solve and advances the "furthest reached" marker if (nextStage, nextPuzzleIndex) is further than before. */
  markSolved(nextStage: number, nextPuzzleIndex: number): void;
  /** Records a solve outside the ladder (the daily puzzle): counts toward the streak, doesn't move ladder progress. */
  recordDailySolve(): void;
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

        markSolved(nextStage, nextPuzzleIndex) {
          const { furthestStage, furthestPuzzleIndex } = get();
          const further = isFurther(nextStage, nextPuzzleIndex, furthestStage, furthestPuzzleIndex);
          bumpStreak();
          set({
            furthestStage: further ? nextStage : furthestStage,
            furthestPuzzleIndex: further ? nextPuzzleIndex : furthestPuzzleIndex,
          });
        },

        recordDailySolve() {
          bumpStreak();
        },
      };
    },
    { name: 'b-chess-puzzle-progress', storage: createJSONStorage(() => localStorage) },
  ),
);
