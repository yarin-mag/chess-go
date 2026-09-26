import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface PuzzleProgressState {
  furthestStage: number;
  furthestPuzzleIndex: number;
  solvedCount: number;
  /** Records a solve and advances the "furthest reached" marker to (nextStage, nextPuzzleIndex) if that's further than before. */
  markSolved(nextStage: number, nextPuzzleIndex: number): void;
}

const isFurther = (stage: number, index: number, curStage: number, curIndex: number) =>
  stage > curStage || (stage === curStage && index > curIndex);

export const usePuzzleProgressStore = create<PuzzleProgressState>()(
  persist(
    (set, get) => ({
      furthestStage: 0,
      furthestPuzzleIndex: 0,
      solvedCount: 0,
      markSolved(nextStage, nextPuzzleIndex) {
        const { furthestStage, furthestPuzzleIndex, solvedCount } = get();
        const further = isFurther(nextStage, nextPuzzleIndex, furthestStage, furthestPuzzleIndex);
        set({
          solvedCount: solvedCount + 1,
          furthestStage: further ? nextStage : furthestStage,
          furthestPuzzleIndex: further ? nextPuzzleIndex : furthestPuzzleIndex,
        });
      },
    }),
    { name: 'b-chess-puzzle-progress', storage: createJSONStorage(() => localStorage) },
  ),
);
