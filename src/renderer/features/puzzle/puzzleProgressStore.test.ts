import { beforeEach, describe, expect, it } from 'vitest';
import { usePuzzleProgressStore } from './puzzleProgressStore';

describe('puzzleProgressStore', () => {
  beforeEach(() => {
    localStorage.clear();
    usePuzzleProgressStore.setState({
      furthestStage: 0,
      furthestPuzzleIndex: 0,
      solvedCount: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastSolvedDate: null,
    });
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

  it('starts a 1-day streak on the first ever solve', () => {
    usePuzzleProgressStore.getState().markSolved(0, 1);
    expect(usePuzzleProgressStore.getState().currentStreak).toBe(1);
    expect(usePuzzleProgressStore.getState().longestStreak).toBe(1);
  });

  it('does not grow the streak for a second solve the same day', () => {
    usePuzzleProgressStore.getState().markSolved(0, 1);
    usePuzzleProgressStore.getState().markSolved(0, 2);
    expect(usePuzzleProgressStore.getState().currentStreak).toBe(1);
  });

  it('tracks the longest streak separately from the current one after a reset', () => {
    usePuzzleProgressStore.setState({ currentStreak: 5, longestStreak: 5, lastSolvedDate: '2020-01-01' });
    usePuzzleProgressStore.getState().markSolved(0, 1); // huge gap since 2020 -> resets to 1
    expect(usePuzzleProgressStore.getState().currentStreak).toBe(1);
    expect(usePuzzleProgressStore.getState().longestStreak).toBe(5);
  });
});
