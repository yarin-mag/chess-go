import { beforeEach, describe, expect, it } from 'vitest';
import { usePuzzleProgressStore } from './puzzleProgressStore';

describe('puzzleProgressStore', () => {
  beforeEach(() => {
    localStorage.clear();
    usePuzzleProgressStore.setState({ furthestStage: 0, furthestPuzzleIndex: 0, solvedCount: 0 });
  });

  it('starts at the very first puzzle', () => {
    const s = usePuzzleProgressStore.getState();
    expect(s.furthestStage).toBe(0);
    expect(s.furthestPuzzleIndex).toBe(0);
  });

  it('advances to the next puzzle in the same stage', () => {
    usePuzzleProgressStore.getState().markSolved(0, 3);
    expect(usePuzzleProgressStore.getState().furthestPuzzleIndex).toBe(3);
    expect(usePuzzleProgressStore.getState().furthestStage).toBe(0);
    expect(usePuzzleProgressStore.getState().solvedCount).toBe(1);
  });

  it('never moves progress backwards (e.g. replaying an earlier puzzle)', () => {
    usePuzzleProgressStore.getState().markSolved(2, 5);
    usePuzzleProgressStore.getState().markSolved(0, 1);
    expect(usePuzzleProgressStore.getState().furthestStage).toBe(2);
    expect(usePuzzleProgressStore.getState().furthestPuzzleIndex).toBe(5);
    expect(usePuzzleProgressStore.getState().solvedCount).toBe(2); // still counts every solve
  });
});
