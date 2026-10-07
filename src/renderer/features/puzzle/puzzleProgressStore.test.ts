import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePuzzleProgressStore } from './puzzleProgressStore';

vi.mock('@/features/sync/offlineQueueStore', () => ({ enqueueOfflineResult: vi.fn() }));

import { enqueueOfflineResult } from '@/features/sync/offlineQueueStore';
import { useAuthStore } from '@/features/auth/authStore';
import { useWalletStore } from '@/features/shop/walletStore';

describe('puzzleProgressStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useWalletStore.setState({ coins: 0 });
    usePuzzleProgressStore.setState({
      furthestStage: 0,
      furthestPuzzleIndex: 0,
      solvedCount: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastSolvedDate: null,
      rushBest: { '3': 0, '5': 0 },
    });
  });

  afterEach(() => {
    useAuthStore.setState({ status: 'signedOut', accountId: null, clerkUserId: null, hasEverAuthenticated: false });
    vi.mocked(enqueueOfflineResult).mockClear();
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

  it('enqueues a milestone sync record when signed in', () => {
    useAuthStore.setState({ status: 'signedIn', accountId: 'acct-1', clerkUserId: 'u1', hasEverAuthenticated: true });
    usePuzzleProgressStore.getState().markSolved(1, 0);
    expect(enqueueOfflineResult).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'milestone' }),
    );
  });

  it('does not enqueue a milestone when signed out', () => {
    usePuzzleProgressStore.getState().markSolved(1, 0);
    expect(enqueueOfflineResult).not.toHaveBeenCalled();
  });

  it('does not enqueue a milestone for a solve that does not advance progress', () => {
    useAuthStore.setState({ status: 'signedIn', accountId: 'acct-1', clerkUserId: 'u1', hasEverAuthenticated: true });
    usePuzzleProgressStore.getState().markSolved(2, 5);
    vi.mocked(enqueueOfflineResult).mockClear();
    usePuzzleProgressStore.getState().markSolved(0, 1); // replaying an earlier puzzle — no real progress
    expect(enqueueOfflineResult).not.toHaveBeenCalled();
  });

  describe('coin rewards', () => {
    it('pays a per-puzzle reward for a genuine solve', () => {
      usePuzzleProgressStore.getState().markSolved(0, 1);
      expect(useWalletStore.getState().coins).toBe(10);
    });

    it('does not pay for replaying an earlier puzzle', () => {
      usePuzzleProgressStore.getState().markSolved(2, 5);
      useWalletStore.setState({ coins: 0 });
      usePuzzleProgressStore.getState().markSolved(0, 1);
      expect(useWalletStore.getState().coins).toBe(0);
    });

    it('pays the stage bonus on top of the puzzle reward when reaching a new stage', () => {
      usePuzzleProgressStore.getState().markSolved(1, 0); // stage 0 -> 1
      expect(useWalletStore.getState().coins).toBe(10 + 100);
    });

    it('pays the daily-puzzle reward separately from ladder solves', () => {
      usePuzzleProgressStore.getState().recordDailySolve();
      expect(useWalletStore.getState().coins).toBe(25);
    });
  });

  describe('recordRushScore', () => {
    it('records the first score as the best, and reports it as a new best', () => {
      const isNewBest = usePuzzleProgressStore.getState().recordRushScore('3', 7);
      expect(isNewBest).toBe(true);
      expect(usePuzzleProgressStore.getState().rushBest['3']).toBe(7);
    });

    it('keeps the higher score and reports no new best for a lower one', () => {
      usePuzzleProgressStore.getState().recordRushScore('3', 10);
      const isNewBest = usePuzzleProgressStore.getState().recordRushScore('3', 4);
      expect(isNewBest).toBe(false);
      expect(usePuzzleProgressStore.getState().rushBest['3']).toBe(10);
    });

    it('tracks each duration independently', () => {
      usePuzzleProgressStore.getState().recordRushScore('3', 5);
      usePuzzleProgressStore.getState().recordRushScore('5', 12);
      expect(usePuzzleProgressStore.getState().rushBest['3']).toBe(5);
      expect(usePuzzleProgressStore.getState().rushBest['5']).toBe(12);
    });
  });
});
